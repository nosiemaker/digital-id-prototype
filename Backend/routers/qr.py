"""
QR Code Endpoints
=================

What this router does:
    Provides endpoints for generating and verifying signed QR identity payloads.
    
    Two key flows:
    
    1. GENERATION (for citizens):
       - Citizen app calls POST /qr/{din}/generate with their own DIN
       - Server returns signed JSON payload
       - Citizen app encodes payload into QR image client-side (not server-side)
       - Payload is valid for 5 minutes
       
    2. VERIFICATION (for verifiers):
       - Mobile app or third-party verifier scans QR → decodes JSON
       - Verifier app does local signature check using cached server public key
       - Or: server endpoint /qr/verify for admin/testing use

Why render QR client-side?
    - No server-side image library dependency (qrcode, PIL, etc.)
    - Payload can be re-encoded at any QR error-correction level client needs
    - Citizen controls image format (PNG, SVG, embedded in wallet, etc.)
    - Smaller server resource footprint

Endpoints:
    POST /qr/{din}/generate
        Generate a signed QR payload for a citizen.
        Citizen can only generate their own. RO/Supervisor can generate for any DIN.
        
    POST /qr/verify
        Verify a scanned QR payload server-side (public endpoint).
        For testing, admin tools, or server-side scanner integrations.
"""

from asgiref.sync import sync_to_async
from fastapi import APIRouter, Depends, HTTPException, Request, status

from Utils.audit_logger import audit
from Utils.rbac import Permission, get_permission_dependency
from qr.schema import QRPayload, QRVerifyRequest, QRVerifyResponse
from qr.service import (
    CitizenNotActiveError,
    CitizenNotFoundError,
    QRExpiredError,
    QRInvalidSignatureError,
    generate_qr_payload,
    verify_qr_payload,
)

router = APIRouter(tags=["qr"])


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post(
    "/{din}/generate",
    response_model=QRPayload,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a signed QR payload for a citizen",
    description=(
        "Generates a signed QR payload for the given DIN. "
        "Citizens can only generate their own. "
        "Registration Officers and Supervisors can generate for any citizen. "
        "The returned JSON should be encoded into a QR image client-side "
        "using a library like qrcode.js or ZXing. "
        "QR is valid for 5 minutes by default (ZDID_QR_TTL_SECONDS). "
        "Citizen must be ACTIVE — PENDING/SUSPENDED/DECEASED returns 403."
    ),
)
async def generate_qr(
    din: str,
    request: Request,
    current_user: dict = Depends(get_permission_dependency(Permission.CITIZEN_READ_OWN_PROFILE)),
):
    """
    Generate a signed QR payload.

    Authorization rules:
    - CITIZEN role: can only generate their own DIN
    - REGISTRATION_OFFICER, REGISTRAR, SUPERVISOR: can generate for any DIN
    
    Returns: QRPayload with fields:
        - din: Identity anchor (what gets signed)
        - name: Display name (NOT signed)
        - nonce: Replay protection token
        - exp: Unix timestamp expiry
        - sig: base64url ECDSA P-256 signature
        
    Client app takes this JSON and encodes it into a QR image.
    """
    user_role = current_user.get("role")
    user_din = current_user.get("din")

    # Citizens can only generate their own QR
    if user_role == "CITIZEN" and user_din != din:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens can only generate their own QR code.",
        )

    try:
        payload = await sync_to_async(generate_qr_payload)(din)
    except CitizenNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No citizen found with DIN: {din}",
        )
    except CitizenNotActiveError as exc:
        # Provide helpful status messages
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

    # Audit — who generated a QR for which citizen
    await audit.alog(
        actor_id=current_user.get("id"),
        actor_role=user_role,
        action="QR_GENERATED",
        target_type="CITIZEN",
        target_id=din,
        meta={"exp": payload["exp"], "requested_by_role": user_role},
    )

    return payload


@router.post(
    "/verify",
    response_model=QRVerifyResponse,
    summary="Verify a scanned QR payload (server-side)",
    description=(
        "Verifies a QR payload server-side. "
        "This mirrors the offline verification logic the mobile verifier runs locally. "
        "Public endpoint — no authentication required by design. "
        "Use this for testing, admin tools, or server-side scanner integrations."
    ),
)
async def verify_qr(
    body: QRVerifyRequest,
):
    """
    Verify a scanned QR payload on the server.

    This endpoint is public (no auth) by design:
    - Third-party verifiers (hospitals, govt offices) may not have API credentials
    - Verification only checks signature + expiry — reveals no sensitive data
    - Nonce already prevents replay attacks
    
    Mobile verifiers use the same logic locally (see OFFLINE_VERIFY.md):
    1. Scan QR → decode JSON
    2. Check exp > now() 
    3. Reconstruct signed_bytes = f\"{din}.{nonce}.{exp}\".encode()
    4. Decode base64url sig → r, s → DER
    5. Verify DER signature using cached server public key
    
    Args:
        body: QRVerifyRequest with din, nonce, exp, sig
        
    Returns:
        QRVerifyResponse with verified, din, expires_in_seconds
        
    Errors:
        410 Gone: QR has expired
        401 Unauthorized: Signature is invalid (tampered QR)
    """
    try:
        result = await sync_to_async(verify_qr_payload)(
            din=body.din,
            nonce=body.nonce,
            exp=body.exp,
            sig=body.sig,
        )
    except QRExpiredError as exc:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=f"QR code has expired: {exc}",
        )
    except QRInvalidSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="QR signature is invalid. This code may have been tampered with.",
        )

    return result
