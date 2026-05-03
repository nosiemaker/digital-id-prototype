# citizen_registration.py (Router)
# Defines the API endpoints for citizen enrollment requests.
# Handles submission of new enrollment requests and review actions
# (approve / reject) performed by Registration Officers.

from fastapi import APIRouter, Request, status, Depends, HTTPException
from asgiref.sync import sync_to_async

from registration.schema import EnrollmentRejection
from registration.services.citizen_registration import (approve_citizen_registration, reject_citizen_registration
, get_all_pending, get_single_pending)
from dependencies.auth import require_groups, UserRole
from admin_ops.schema import (
    AccountCreateResponse,
    AccountCreateRequest,
    OTPVerifyRequest,
    OTPVerifyResponse,
    ResendOTPRequest,
    IdentitySubmitRequest,
    IdentitySubmitResponse,
)

from registration.services.citizen_registration import (
 create_account,
 verify_email_otp,
 resend_otp as resend_otp_service,
 identity_submission,
)

router = APIRouter()

# Approves a citizen enrollment request identified by request_id.
# Only accessible to users with the REGISTRATION_OFFICER role.
@router.put("/{request_id}/request_approve")
async def approve(request_id: int, request: Request, user=Depends(require_groups([UserRole.REGISTRATION_OFFICER]))):
    result = await sync_to_async(approve_citizen_registration)(request_id, ro_id=user["id"])
    return result

# Rejects a citizen enrollment request identified by request_id.
# Requires a rejection reason in the request body.
# Only accessible to users with the REGISTRATION_OFFICER role.
@router.put("/{request_id}/request_reject")
async def reject(request_id: int, body: EnrollmentRejection, request: Request, user=Depends(require_groups([UserRole.REGISTRATION_OFFICER]))):
    result = await sync_to_async(reject_citizen_registration)(request_id, ro_id=user["id"], rejection_reason=body.rejection_reason)
    return result

@router.post("/register", response_model=AccountCreateResponse, status_code=status.HTTP_201_CREATED,
             summary="Step 1a — Create a new user account and send an email OTP")
async def register(body: AccountCreateRequest):
    """
    Creates a SystemUser record in an *inactive* state and emails a 6-digit OTP.
    The account remains locked (`is_active=False`) until the OTP is verified.

    No authentication required — this is the entry point for new users.
    """
    result = await sync_to_async(create_account)(body)
    return result

@router.post("/verify-otp", response_model=OTPVerifyResponse,
             summary="Step 1b — Verify the emailed OTP to activate the account")
async def verify_otp(body: OTPVerifyRequest):
    """
    Accepts the 6-digit code from the user's inbox.

    On success:
      • `is_email_verified` → True
      • `is_active`         → True
      • OTP fields cleared  (one-time use enforced)

    The client should then redirect to the login page.
    """

    results = await sync_to_async(verify_email_otp)(str(body.email), body.otp)
    return results

@router.post("/resend-otp", summary="Step 1b (retry) — Request a fresh OTP")
async def resend_otp(body: ResendOTPRequest):
    """
    Issues a new 6-digit OTP and invalidates the previous one.
    Only allowed for accounts that have NOT yet been verified.

    Rate-limiting should be applied at the gateway/nginx level in production.
    """
    results = await sync_to_async(resend_otp_service)(str(body.email))
    return results

# === Phase 2: Identity Submission ====
@router.post(
    "/submit-identity",
    response_model=IdentitySubmitResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Step 2 — Submit NRC, photos and public key to begin enrollment",
)
async def submit_identity(
        body: IdentitySubmitRequest,
        user=Depends(require_groups([UserRole.CITIZEN]))
):
    """
    Requires a valid JWT with `role=CITIZEN` and `is_email_verified=True`.

    Creates:
      • A `Citizen` record (status=PENDING, no DIN yet).
      • An `EnrollmentRequest` (status=PENDING) for RO review.

    The user's DIN will be assigned when an RO approves the request.

    Guards:
      • Rejected if email is not verified.
      • Rejected if a DIN is already assigned to this account.
      • Rejected if the NRC number already exists in the system.
    """
    user_id = int(user["id"])
    result = await sync_to_async(identity_submission)(body, user_id)
    return result

# Returns all enrollment requests that are currently in PENDING status.
# Only accessible to users with the REGISTRATION_OFFICER role.
@router.get("/pending_requests")
async def get_all_pending_requests(request: Request, user=Depends(require_groups([UserRole.REGISTRATION_OFFICER, UserRole.SUPERVISOR]))):
    result = await sync_to_async(get_all_pending)()
    return result

# Returns a single pending enrollment request by its ID.
# Only accessible to users with the REGISTRATION_OFFICER role.
@router.get("/pending_request/{request_id}")
async def get_single_pending_request(request_id: int, request: Request, user=Depends(require_groups([UserRole.REGISTRATION_OFFICER]))):
    result = await sync_to_async(get_single_pending)(request_id)
    return result
