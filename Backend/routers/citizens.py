from fastapi import APIRouter, HTTPException, Request, status as http_status, Depends
from typing import Optional
import logging

from citizens.models import CitizenStatus, Language
from citizens.schema import (
    CitizenUpdate,
    CitizenResponse,
    CitizenSummary,
    BiometricRecordBase,
    BiometricRecordResponse,
    FamilyLinkBase,
    FamilyLinkResponse,
)
from citizens.services import citizen_service, biometric_service, family_service
from Utils.rbac import (
    get_permission_dependency,
    Permission,
)
from Utils.audit_logger import audit
from Utils.rbac import has_permission, Permission
from asgiref.sync import sync_to_async

router = APIRouter(prefix="/citizens", tags=["citizens"])
logger = logging.getLogger(__name__)


def _check_auth(request: Request):
    """Helper to check authentication on all endpoints."""
    current_user = request.state.user
    if not current_user:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )

# Citizen CRUD Operations

@router.get("/{din}", response_model=CitizenResponse)
async def get_citizen(
    din: str,
    request: Request,
):
    """
    Get citizen by DIN.
    Returns full citizen profile visible to self, RO, Supervisor.
    """
    # Check authentication
    current_user = request.state.user

    if not current_user:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    
    # Check authorization
    user_role = current_user.get("role")
    user_id = current_user.get("id")
    
    # Citizens can only view their own profile
    get_func = sync_to_async(citizen_service.get_citizen_by_din)

    if user_role == "CITIZEN":
        # Get the citizen record to check if it matches the current user
        citizen = await get_func(din)

        if not citizen or citizen.id != user_id:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. Citizens can only view their own profile.",
            )
    # ROs, Registrars, and Supervisors can view any citizen profile
    elif user_role not in ["REGISTRATION_OFFICER", "REGISTRAR", "SUPERVISOR"]:
        # check permission for other roles
        if not has_permission(user_role, Permission.RO_READ_CITIZEN_PROFILE):
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {Permission.RO_READ_CITIZEN_PROFILE.value}",
            )
    
    citizen = await get_func(din)
    if not citizen:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Citizen not found"
        )
    return citizen


@router.patch("/{din}", response_model=CitizenResponse)
async def update_citizen(
    din: str,
    citizen_data: CitizenUpdate,
    request: Request,
):
    """
    Update citizen record.
    Used for language change, phone updates, etc.
    """
    # Check authentication
    current_user = request.state.user
    if not current_user:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    
    # Check authorization
    user_role = current_user.get("role")
    user_id = current_user.get("id")
    
    # Citizens can only update their own profile
    get_func = sync_to_async(citizen_service.get_citizen_by_din)    
    if user_role == "CITIZEN":
        # Get the citizen record to check if it matches the current user
        citizen = await get_func(din)
        if not citizen or citizen.id != user_id:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. Citizens can only update their own profile.",
            )
    # ROs, Registrars, and Supervisors can update any citizen profile
    elif user_role not in ["REGISTRATION_OFFICER", "REGISTRAR", "SUPERVISOR"]:
        # For other roles, check if they have the specific permission
        if not has_permission(user_role, Permission.RO_READ_CITIZEN_PROFILE):
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {Permission.RO_READ_CITIZEN_PROFILE.value}",
            )

    # Check if citizen exists
    citizen = await get_func(din)
    if not citizen:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Citizen not found"
        )

    # Update citizen
    updated_citizen = await sync_to_async(citizen_service.update_citizen)(din, citizen_data, actor_id=current_user.get("id"), actor_role=user_role)
    
    # Log the citizen update
    updated_fields = list(citizen_data.dict(exclude_unset=True).keys())

    await sync_to_async(audit.citizen_updated)(current_user.get("id"), user_role, din, fields=updated_fields)
    
    logger.info(f"Updated citizen: {din}")
    return updated_citizen


@router.delete("/{din}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_citizen(
    din: str,
    request: Request,
):
    """
    Delete/retire citizen record.
    """
    current_user = request.state.user
    if not current_user:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )

    # Check if citizen exists
    citizen = await sync_to_async(citizen_service.get_citizen_by_din)(din)
    if not citizen:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Citizen not found"
        )

    # Delete citizen
    await sync_to_async(citizen_service.delete_citizen)(din, actor_id=current_user.get("id"), actor_role=current_user.get("role"))
    
    # Log the deletion
    await sync_to_async(audit.citizen_deleted)(current_user.get("id"), current_user.get("role"), din)
    
    logger.info(f"Deleted citizen: {din}")
    return None


# Additional endpoints for specific operations

@router.get("/{din}/biometrics", response_model=BiometricRecordResponse)
async def get_citizen_biometrics(
    din: str,
    request: Request,
):
    """
    Get citizen biometric record.
    """
    # Check authentication
    current_user = request.state.user
    if not current_user:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    
    # Check authorization
    user_role = current_user.get("role")
    user_id = current_user.get("id")
    
    # Citizens can only view their own biometrics
    if user_role == "CITIZEN":
        # Get the citizen record to check if it matches the current user
        citizen = await sync_to_async(citizen_service.get_citizen_by_din)(din)
        if not citizen or citizen.id != user_id:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. Citizens can only view their own biometrics.",
            )
    # ROs can view any citizen's biometrics
    elif user_role != "REGISTRATION_OFFICER":
        # For other roles, check if they have the specific permission
        if not has_permission(user_role, Permission.RO_READ_CITIZEN_PROFILE):
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {Permission.RO_READ_CITIZEN_PROFILE.value}",
            )

    biometric_record = await sync_to_async(biometric_service.get_biometric_by_citizen_din)(din)
    if not biometric_record:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Biometric record not found"
        )
    return biometric_record


@router.post("/{din}/biometrics", response_model=BiometricRecordResponse)
async def create_citizen_biometrics(
    din: str,
    biometric_data: BiometricRecordBase,
    request: Request,
):
    """
    Create citizen biometric record.
    Used by Registration Officer to submit captured biometrics.
    """
    # Check authentication
    current_user = request.state.user
    if not current_user:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    
    # Check authorization - only Registration Officers can create biometrics
    user_role = current_user.get("role")
    if user_role != "REGISTRATION_OFFICER":
        if not has_permission(user_role, Permission.RO_CAPTURE_BIOMETRICS):
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {Permission.RO_CAPTURE_BIOMETRICS.value}",
            )

    # Check if citizen exists
    citizen = await sync_to_async(citizen_service.get_citizen_by_din)(din)
    if not citizen:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Citizen not found"
        )

    # Create biometric record
    biometric_record = await sync_to_async(biometric_service.create_biometric_record)(
        din, biometric_data, actor_id=current_user.get("id"), actor_role=user_role
    )
    
    # Log biometric capture
    await sync_to_async(audit.biometric_captured)(current_user.get("id"), din)
    
    logger.info(f"Created biometric record for citizen: {din}")
    return biometric_record


@router.patch("/{din}/biometrics", response_model=BiometricRecordResponse)
async def update_citizen_biometrics(
    din: str,
    biometric_data: BiometricRecordBase,
    request: Request,
):
    """
    Update citizen biometric record.
    Used for re-capture of biometrics (e.g. poor quality).
    """
    current_user = request.state.user
    if not current_user:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )

    # Check if citizen exists
    citizen = await sync_to_async(citizen_service.get_citizen_by_din)(din)
    if not citizen:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Citizen not found"
        )

    # Update biometric record
    updated_biometric = await sync_to_async(biometric_service.update_biometric_record)(
        din, biometric_data, actor_id=current_user.get("id"), actor_role=current_user.get("role")
    )
    
    # Log biometric update
    await sync_to_async(audit.biometric_updated)(current_user.get("id"), din)
    
    logger.info(f"Updated biometric record for citizen: {din}")
    return updated_biometric


@router.post("/{din}/family-links", response_model=FamilyLinkResponse)
async def create_family_link(
    din: str,
    family_link_data: FamilyLinkBase,
    request: Request,
):
    """
    Create family link for citizen.
    """
    _check_auth(request)

    # Check if citizen exists
    citizen = await sync_to_async(citizen_service.get_citizen_by_din)(din)
    if not citizen:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Citizen not found"
        )

    # Create family link
    family_link = await sync_to_async(family_service.create_family_link)(din, family_link_data)
    logger.info(f"Created family link for citizen: {din}")
    return family_link


@router.get("/{din}/family-tree")
async def get_family_tree(
    din: str,
    request: Request,
):
    """
    Get family tree for citizen.
    """
    _check_auth(request)

    family_tree = await sync_to_async(family_service.get_family_tree)(din)
    return family_tree


# List citizens with filtering

@router.get("/", response_model=list[CitizenSummary])
async def list_citizens(
    request: Request,
    status: Optional[CitizenStatus] = None,
    language: Optional[Language] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    """
    List citizens with filtering and pagination.
    """
    _check_auth(request)

    citizens = await sync_to_async(citizen_service.list_citizens)(
        status=status,
        language=language,
        search=search,
        page=page,
        page_size=page_size,
    )
    return citizens
