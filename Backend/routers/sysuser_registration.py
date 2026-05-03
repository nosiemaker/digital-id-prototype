# sysuser_registration.py (Router)
# Defines the API endpoints for system user and third-party institution management.
# Split into two sub-routers: user_router for system user operations and
# third_party_router for third-party institution enrollment and review.

from django.db.models import Q
from admin_ops.models import SystemUser
from admin_ops.serializers import SystemUserSerializer
from asgiref.sync import sync_to_async
from fastapi import APIRouter, Request, Depends
from dependencies.auth import require_groups, UserRole
from admin_ops.schema import SystemUserCreatePassword, SystemUserUpdate, HealthWorkerRemove, SupervisorRemove, \
    RegistrarRemove, RegistrationOfficerRemove
from admin_ops.schema import (
    RegistrationOfficerCreate, RegistrarCreate, SupervisorCreate, HealthWorkerCreate,
    RegistrationOfficerRemove, RegistrarRemove, SupervisorRemove, HealthWorkerRemove
)
from admin_ops.services.user_management import (
    get_user_by_din, set_system_user_password, activate_system_user, get_user_by_email,
    approve_third_party_registration,
    third_party_registration_request, reject_third_party_registration, get_all_pending,
    get_single_pending, get_active_institutions, create_registration_officer, create_registrar, create_supervisor,
    create_health_worker, remove_registration_officer, remove_registrar, remove_supervisor,
    remove_health_worker
)
from kyc.schema import ThirdPartyInstitutionBase, ThirdPartyApprovalRequest, RejectionRequest

user_router = APIRouter()
third_party_router = APIRouter()


@user_router.get("/staff")
async def list_staff(request: Request, user=Depends(require_groups([UserRole.SUPERVISOR, UserRole.REGISTRAR]))):
    """Returns all Health worker and Registration officers."""
    def get_staff():
        qs = SystemUser.objects.filter(
        Q(role__icontains=UserRole.HEALTH_WORKER) | Q(role__icontains=UserRole.REGISTRAR)
        ).order_by("-date_joined")

        serializer = SystemUserSerializer(qs, many=True)

        return [dict(item) for item in serializer.data]

    try:
        staff = await sync_to_async(get_staff)()
        return {"details": "staff list retrieved", "staff": staff}
    except Exception as e:
        return {"details": "error retrieving staff", "error": str(e)}


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

# Submits a new third-party institution enrollment request.
# Open endpoint — no role restriction applied, as institutions self-register.
@third_party_router.post("/register")
async def register_third_party(body: ThirdPartyInstitutionBase,request: Request,):
    result = await sync_to_async(third_party_registration_request)(body.model_dump())
    return result

# Returns all third-party enrollment requests currently in PENDING status.
# Only accessible to users with the REGISTRAR or SUPERVISOR role.
@third_party_router.get("/pending")
async def list_pending(request: Request,user=Depends(require_groups([UserRole.REGISTRAR, UserRole.SUPERVISOR, UserRole.REGISTRATION_OFFICER]))):
    result = await sync_to_async(get_all_pending)()
    return result

# Returns a single third-party enrollment request by its ID.
# Only accessible to users with the REGISTRAR or SUPERVISOR role.
@third_party_router.get("/pending/{request_id}")
async def get_pending(request_id: int,request: Request,user=Depends(require_groups([UserRole.REGISTRAR, UserRole.SUPERVISOR, UserRole.REGISTRATION_OFFICER]))):
    result = await sync_to_async(get_single_pending)(request_id)
    return result

# Approves a pending third-party enrollment request by its ID.
# Expects the permitted data scope in the request body.
# Only accessible to users with the REGISTRAR role.
@third_party_router.put("/{request_id}/approve")
async def approve_third_party(request_id: int,body: ThirdPartyApprovalRequest,request: Request,user=Depends(require_groups([UserRole.REGISTRAR, UserRole.REGISTRATION_OFFICER]))):
    result = await sync_to_async(approve_third_party_registration)(request_id, user["id"], body.permitted_scope)
    return result

# Rejects a pending third-party enrollment request by its ID.
# Requires a rejection reason in the request body.
# Only accessible to users with the REGISTRAR role.
@third_party_router.put("/{request_id}/reject")
async def reject_third_party(request_id: int,body: RejectionRequest,request: Request,user=Depends(require_groups([UserRole.REGISTRAR, UserRole.REGISTRATION_OFFICER]))):
    result = await sync_to_async(reject_third_party_registration)(
        request_id, user["id"], body.rejection_reason
    )
    return result

# Returns all ACTIVE third-party institutions.
@third_party_router.get("/active")
async def list_active(request: Request):
    print("API: GET /third_party/active called")
    result = await sync_to_async(get_active_institutions)()
    return result


# -------------------------------------------------------------------
# Staff Role Management Endpoints
# -------------------------------------------------------------------

# Creates a new RegistrationOfficer linked to a Citizen.
# Only accessible to users with the REGISTRAR or SUPERVISOR role.
@user_router.put("/add_permission/registration-officer")
async def create_registration_officer_endpoint(body: RegistrationOfficerCreate, request: Request, user=Depends(require_groups([UserRole.SUPERVISOR, UserRole.REGISTRAR]))):
    result = await sync_to_async(create_registration_officer)(body.model_dump())
    return result


# Creates a new Registrar linked to a Citizen.
# Only accessible to users with the REGISTRAR or SUPERVISOR role.
@user_router.put("/add_permission/registrar")
async def create_registrar_endpoint(body: RegistrarCreate, request: Request, user=Depends(require_groups([UserRole.SUPERVISOR]))):
    result = await sync_to_async(create_registrar)(body.model_dump())
    return result


# Creates a new Supervisor linked to a Citizen.
# Only accessible to users with the REGISTRAR or SUPERVISOR role.
@user_router.put("/add_permission/supervisor")
async def create_supervisor_endpoint(body: SupervisorCreate, request: Request, user=Depends(require_groups([UserRole.SUPERVISOR]))):
    result = await sync_to_async(create_supervisor)(body.model_dump())
    return result


# Creates a new HealthWorker linked to a Citizen.
# Only accessible to users with the REGISTRAR or SUPERVISOR role.
@user_router.put("/add_permission/health-worker")
async def create_health_worker_endpoint(body: HealthWorkerCreate, request: Request, user=Depends(require_groups([UserRole.SUPERVISOR, UserRole.REGISTRAR]))):
    result = await sync_to_async(create_health_worker)(body.model_dump())
    return result

# Deactivates a RegistrationOfficer role instance linked to a system user.
# Only accessible to users with the SUPERVISOR role.
@user_router.put("/remove_permission/registration-officer")
async def remove_registration_officer_endpoint(body: RegistrationOfficerRemove, request: Request, user=Depends(require_groups([UserRole.SUPERVISOR, UserRole.REGISTRAR]))):
    result = await sync_to_async(remove_registration_officer)(body.model_dump())
    return result


# Deactivates a Registrar role instance linked to a system user.
# Only accessible to users with the SUPERVISOR role.
@user_router.put("/remove_permission/registrar")
async def remove_registrar_endpoint(body: RegistrarRemove, request: Request, user=Depends(require_groups([UserRole.SUPERVISOR]))):
    result = await sync_to_async(remove_registrar)(body.model_dump())
    return result


# Deactivates a Supervisor role instance linked to a system user.
# Only accessible to users with the SUPERVISOR role.
@user_router.put("/remove_permission/supervisor")
async def remove_supervisor_endpoint(body: SupervisorRemove, request: Request, user=Depends(require_groups([UserRole.SUPERVISOR]))):
    result = await sync_to_async(remove_supervisor)(body.model_dump())
    return result


# Deactivates a HealthWorker role instance linked to a system user.
# Only accessible to users with the SUPERVISOR role.
@user_router.put("/remove_permission/health-worker")
async def remove_health_worker_endpoint(body: HealthWorkerRemove, request: Request, user=Depends(require_groups([UserRole.SUPERVISOR, UserRole.REGISTRAR]))):
    result = await sync_to_async(remove_health_worker)(body.model_dump())
    return result