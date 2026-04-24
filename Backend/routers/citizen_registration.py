# citizen_registration.py (Router)
# Defines the API endpoints for citizen enrollment requests.
# Handles submission of new enrollment requests and review actions
# (approve / reject) performed by Registration Officers.

from fastapi import APIRouter, Request
from asgiref.sync import sync_to_async
from fastapi.params import Depends

from Utils.auth import create_access_token
from registration.schema import EnrollmentRejection
from citizens.schema import CitizenBase
from dependencies.auth import require_groups,UserRole
from registration.services.citizen_registration import approve_citizen_registration, reject_citizen_registration, \
    create_citizen_request, get_all_pending, get_single_pending

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

# Submits a new citizen enrollment request.
# Open endpoint — no authentication required for initial enrollment submission.
# NOTE: The response currently includes generated JWT tokens for testing purposes;
# these should be removed before deploying to production.
@router.post("/submit")
async def new_citizen_enrollment_request(body: CitizenBase, request: Request):
    result = await sync_to_async(create_citizen_request)(body.model_dump())
    # TODO: Remove test token generation below before going to production
    token_health = create_access_token(22,UserRole.HEALTH_WORKER,"example@gmail.com")
    token_ro = create_access_token(19,UserRole.REGISTRATION_OFFICER,"example@gmail.com")
    return {"result": result, "token_health":token_health, "token_ro":token_ro}

# Returns all enrollment requests that are currently in PENDING status.
# Only accessible to users with the REGISTRATION_OFFICER role.
@router.get("/pending_requests")
async def get_all_pending_requests(request: Request, user=Depends(require_groups([UserRole.REGISTRATION_OFFICER]))):
    result = await sync_to_async(get_all_pending)()
    return result

# Returns a single pending enrollment request by its ID.
# Only accessible to users with the REGISTRATION_OFFICER role.
@router.get("/pending_request/{request_id}")
async def get_single_pending_request(request_id: int, request: Request, user=Depends(require_groups([UserRole.REGISTRATION_OFFICER]))):
    result = await sync_to_async(get_single_pending)(request_id)
    return result
