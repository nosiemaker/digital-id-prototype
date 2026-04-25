# sysuser_registration.py (Router)
# Defines the API endpoints for system user and third-party institution management.
# Split into two sub-routers: user_router for system user operations and
# third_party_router for third-party institution enrollment and review.

from asgiref.sync import sync_to_async
from fastapi import APIRouter, Request, Depends
from dependencies.auth import require_groups, UserRole
from admin_ops.schema import SystemUserCreatePassword, SystemUserUpdate, UpdateUserPermissions
from admin_ops.services.user_management import (
    get_user_by_din,set_system_user_password,activate_system_user,get_user_by_email,add_user_permissions,approve_third_party_registration,remove_user_permissions,third_party_registration_request,reject_third_party_registration,get_all_pending,get_single_pending
)
from kyc.schema import ThirdPartyInstitutionBase, ThirdPartyApprovalRequest, RejectionRequest

user_router = APIRouter()
third_party_router = APIRouter()

# Retrieves a system user by their citizen DIN.
# Only accessible to users with the REGISTRAR or SUPERVISOR role.
@user_router.get("/by-din/{din}")
async def get_user_din(din: str,request: Request,user=Depends(require_groups([UserRole.REGISTRAR, UserRole.SUPERVISOR]))):
    result = await sync_to_async(get_user_by_din)(din)
    return result

# Retrieves a system user by their email address.
# Only accessible to users with the REGISTRAR or SUPERVISOR role.
@user_router.get("/by-email/{email}")
async def get_user_email(email: str,request: Request,user=Depends(require_groups([UserRole.REGISTRAR, UserRole.SUPERVISOR]))):
    result = await sync_to_async(get_user_by_email)(email)
    return result

# Initiates account activation for a system user identified by DIN.
# Generates and returns an OTP token to be used in the set-password step.
# Open endpoint — no role restriction applied.
@user_router.post("/activate/{din}")
async def activate_user(din: str,request: Request):
    result = await sync_to_async(activate_system_user)(din)
    return result

# Completes account activation by setting the user's password.
# Expects citizen_din and the chosen password in the request body.
# Open endpoint — no role restriction applied.
@user_router.post("/set-password")
async def set_password(body: SystemUserCreatePassword,request: Request):
    result = await sync_to_async(set_system_user_password)(body.model_dump())
    return result

# Adds a role to a system user's permission set.
# Only accessible to users with the SUPERVISOR role.
@user_router.patch("/permissions/add")
async def add_permissions(body: UpdateUserPermissions,request: Request,user=Depends(require_groups([UserRole.SUPERVISOR]))):
    result = await sync_to_async(add_user_permissions)(user["id"], body.model_dump())
    return result

# Removes a role from a system user's permission set.
# Only accessible to users with the SUPERVISOR role.
@user_router.patch("/permissions/remove")
async def remove_permissions(body: UpdateUserPermissions,request: Request,user=Depends(require_groups([UserRole.SUPERVISOR]))):
    result = await sync_to_async(remove_user_permissions)(user["id"], body.model_dump())
    return result

# Submits a new third-party institution enrollment request.
# Open endpoint — no role restriction applied, as institutions self-register.
@third_party_router.post("/register")
async def register_third_party(body: ThirdPartyInstitutionBase,request: Request,):
    result = await sync_to_async(third_party_registration_request)(body.model_dump())
    return result

# Returns all third-party enrollment requests currently in PENDING status.
# Only accessible to users with the REGISTRAR or SUPERVISOR role.
@third_party_router.get("/pending")
async def list_pending(request: Request,user=Depends(require_groups([UserRole.REGISTRAR, UserRole.SUPERVISOR]))):
    result = await sync_to_async(get_all_pending)()
    return result

# Returns a single third-party enrollment request by its ID.
# Only accessible to users with the REGISTRAR or SUPERVISOR role.
@third_party_router.get("/pending/{request_id}")
async def get_pending(request_id: int,request: Request,user=Depends(require_groups([UserRole.REGISTRAR, UserRole.SUPERVISOR]))):
    result = await sync_to_async(get_single_pending)(request_id)
    return result

# Approves a pending third-party enrollment request by its ID.
# Expects the permitted data scope in the request body.
# Only accessible to users with the REGISTRAR role.
@third_party_router.put("/{request_id}/approve")
async def approve_third_party(request_id: int,body: ThirdPartyApprovalRequest,request: Request,user=Depends(require_groups([UserRole.REGISTRAR]))):
    result = await sync_to_async(approve_third_party_registration)(request_id, user["id"], body.permitted_scope)
    return result

# Rejects a pending third-party enrollment request by its ID.
# Requires a rejection reason in the request body.
# Only accessible to users with the REGISTRAR role.
@third_party_router.put("/{request_id}/reject")
async def reject_third_party(request_id: int,body: RejectionRequest,request: Request,user=Depends(require_groups([UserRole.REGISTRAR]))):
    result = await sync_to_async(reject_third_party_registration)(
        request_id, user["id"], body.rejection_reason
    )
    return result
