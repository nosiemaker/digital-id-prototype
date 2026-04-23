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

from datetime import datetime, timezone

from asgiref.sync import sync_to_async
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from Utils.audit_logger import audit
from Utils.rbac import Permission, get_permission_dependency
from citizens.schema import DigitalIDPayload

from citizens.services.digital_id_service import (
    CitizenNotActiveError,
    CitizenNotFoundError,
    build_digital_id,
    get_server_public_key,
)

router = APIRouter(prefix="/digital-id", tags=["digital-id"])


# ---------------------------------------------------------------------------
# Response schemas local to this router
# ---------------------------------------------------------------------------

class ServerPublicKeyResponse(BaseModel):
    """
    GET /digital-id/server-public-key
    Public key verifiers use to check Digital ID signatures.
    """
    public_key_pem: str
    algorithm: str = "ECDSA P-256"
    usage: str = "Verify Digital ID payload signatures issued by ZDID"


class DigitalIDResponse(BaseModel):
    """
    Wraps DigitalIDPayload with metadata the citizen app needs.
    """
    payload: DigitalIDPayload
    issued_at: datetime
    valid_for_seconds: int = 86400  # 24h — client should re-fetch daily


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
async def get_digital_id(
    din: str,
    request: Request,
    current_user: dict = Depends(get_permission_dependency(Permission.CITIZEN_READ_OWN_PROFILE)),
):
    """
    GET /digital-id/{din}

    Authorization rules:
    - CITIZEN role: can only fetch their own DIN (enforced below)
    - REGISTRATION_OFFICER, REGISTRAR, SUPERVISOR: can fetch any DIN
    """
    user_role = current_user.get("role")
    user_din = current_user.get("din")  # DIN stored on the JWT for citizens

    # Citizens can only fetch their own Digital ID
    if user_role == "CITIZEN" and user_din != din:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens can only retrieve their own Digital ID.",
        )

    try:
        digital_id_payload = await sync_to_async(build_digital_id)(din)
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
        actor_role=user_role,
        action="DIGITAL_ID_ISSUED",
        target_type="CITIZEN",
        target_id=din,
        meta={"requested_by_role": user_role},
    )

    return DigitalIDResponse(
        payload=digital_id_payload,
        issued_at=digital_id_payload.issued_at,
    )
