"""digital_id/routes.py — Digital ID Packaging Endpoints
======================================================

Endpoints:
    GET /digital-id/{din}
        Citizen app fetches their signed Digital ID payload.
        The payload is what gets stored on-device and fed into QR generation.
        Requires: CITIZEN_READ_OWN_PROFILE (citizen) or RO_READ_CITIZEN_PROFILE (RO/Supervisor)

    GET /digital-id/server-public-key
        Returns the server's PEM public key.
        Public endpoint — no auth required.
        Used by verifiers (third parties, offline scanners) to verify signatures.
"""

from datetime import datetime, timedelta

from asgiref.sync import sync_to_async
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from Utils.audit_logger import audit
from citizens.schema import DigitalIDResponse, ServerPublicKeyResponse

from citizens.services.digital_id_service import (
    CitizenNotActiveError,
    CitizenNotFoundError,
    build_digital_id,
    get_server_public_key,
)
from dependencies.auth import require_groups, UserRole

router = APIRouter(prefix="/digital-id", tags=["digital-id"])


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get(
    "/server-public-key",
    response_model=ServerPublicKeyResponse,
    summary="Get ZDID server signing public key",
    description=(
        "Returns the server's ECDSA P-256 public key in PEM format. "
        "No authentication required. "
        "Use this to verify the `signature` field on any DigitalIDPayload."
    ),
)
async def get_public_key():
    """
    Public endpoint — no auth.
    Returns the server signing public key so verifiers can validate Digital ID signatures.
    """
    return ServerPublicKeyResponse(public_key_pem=get_server_public_key())


@router.get(
    "/{din}",
    response_model=DigitalIDResponse,
    summary="Get signed Digital ID for a citizen",
    description=(
        "Returns a signed DigitalIDPayload for the given DIN. "
        "Citizen can only fetch their own. RO and Supervisor can fetch any. "
        "Citizen must be ACTIVE — PENDING/SUSPENDED/DECEASED returns 403."
    ),
)
async def get_citizen_digital_id(
    din: str,
    current_user: dict = Depends(require_groups([UserRole.CITIZEN])),
):
    """
    GET /digital-id/{din}

    Authorization rules:
    - CITIZEN role: can only fetch their own DIN (enforced below)
    - REGISTRATION_OFFICER, REGISTRAR, SUPERVISOR: can fetch any DIN
    """

    try:
        payload = await sync_to_async(build_digital_id)(din)
        public_key = get_server_public_key()
    except CitizenNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No citizen found with DIN: {din}",
        )
    except CitizenNotActiveError as exc:
        # Map status → helpful message
        status_messages = {
            "PENDING": "Enrollment is still pending approval.",
            "SUSPENDED": "This citizen's account is suspended.",
            "DECEASED": "This citizen's record is marked as deceased.",
        }
        detail = status_messages.get(
            exc.status,
            f"Citizen is not active (status: {exc.status}).",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )

    # Audit — who fetched whose Digital ID
    await audit.alog(
        actor_id=current_user.get("id"),
        actor_role=current_user.get("role"),
        action="DIGITAL_ID_ISSUED",
        target_type="CITIZEN",
        target_id=din,
        meta={"requested_by_role": current_user.get("role")},
    )

    return DigitalIDResponse(
        payload=payload,
        server_public_key=public_key,
        valid_until=payload.issued_at + timedelta(days=1)
    )
