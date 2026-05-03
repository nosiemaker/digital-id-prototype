from fastapi import APIRouter, HTTPException, Request, status as http_status, Depends
from typing import Optional
import logging

from admin_ops.models import UserRole
from citizens.models import CitizenStatus, Language
from citizens.schema import (
    CitizenUpdate,
    CitizenResponse,
    CitizenSummary,
    BiometricRecordBase,
    BiometricRecordResponse,
    FamilyLinkBase,
    FamilyLinkResponse, CitizenLookupResponse,
)
from citizens.serializer import CitizenSerializer
from citizens.services import(
    citizen_service, biometric_service, family_service)
from citizens.services.citizen_service import lookup_citizen_for_form
from asgiref.sync import sync_to_async

from dependencies.auth import require_groups

router = APIRouter(prefix="/citizens", tags=["citizens"])
logger = logging.getLogger(__name__)

# Citizen CRUD Operations

@router.get("/{din}")
async def get_citizen(
    din: str,
    user = Depends(require_groups([UserRole.CITIZEN, UserRole.REGISTRATION_OFFICER, UserRole.REGISTRAR, UserRole.SUPERVISOR]))
):
    """
    Get citizen by DIN.
    Returns full citizen profile visible to self, RO, Supervisor.
    """
    # Citizens can only view their own profile
    citizen = await sync_to_async(citizen_service.get_citizen_by_din)(din=din.upper().strip())

    if not citizen:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Citizen not found")

    if user.get("role") != UserRole.CITIZEN:
        raise HTTPException(status_code=403, detail="Access denied")

    data = await sync_to_async(lambda: CitizenSerializer(citizen).data)()
    return data

@router.get("/lookup/{din}", response_model=CitizenLookupResponse)
async def look_citizen_for_autofill(
        din: str,
        user=Depends(require_groups([
            UserRole.HEALTH_WORKER,
            UserRole.REGISTRAR,
            UserRole.CITIZEN
        ]))
):
    """
    GET /citizens/lookup/{din}
    Lightweight citizen lookup for form auto-fill.
    Returns essential fields without full profile overhead.
    """
    result = await sync_to_async(lookup_citizen_for_form)(din)
    if not result:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Citizen with DIN '{din}' not found in registry"
        )
    return result


@router.patch("/{din}", response_model=CitizenResponse)
async def update_citizen(
    din: str,
    citizen_data: CitizenUpdate,
    request: Request,
    user = Depends(require_groups([UserRole.CITIZEN, UserRole.REGISTRATION_OFFICER, UserRole.SUPERVISOR, UserRole.REGISTRAR]))
):
    """
    Update citizen record.
    Used for language change, phone updates, etc.
    """
    # Citizens can only update their own profile
    citizen = await sync_to_async(citizen_service.get_citizen_by_din)(din)
    if not citizen:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Citizen not found"
        )

    # Update citizen
    updated_citizen = await sync_to_async(citizen_service.update_citizen)(din, citizen_data, actor_id=user["id"], actor_role=user["role"])

    logger.info(f"Updated citizen: {din}")
    return updated_citizen


@router.delete("/{din}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_citizen(
    din: str,
    user = Depends(require_groups([UserRole.REGISTRAR, UserRole.SUPERVISOR]))
):
    """
    Delete/retire citizen record.
    """
    # Check if citizen exists
    citizen = await sync_to_async(citizen_service.get_citizen_by_din)(din)
    if not citizen:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Citizen not found"
        )
    # Delete citizen
    await sync_to_async(citizen_service.delete_citizen)(din, actor_id=user["id"], actor_role=user["role"])
    
    logger.info(f"Deleted citizen: {din}")
    return None


# Additional endpoints for specific operations

@router.get("/{din}/biometrics", response_model=BiometricRecordResponse)
async def get_citizen_biometrics(
    din: str,
    user = Depends(require_groups([UserRole.CITIZEN, UserRole.REGISTRATION_OFFICER, UserRole.REGISTRAR, UserRole.SUPERVISOR, UserRole.REGISTRAR.SUPERVISOR]))
):
    """
    Get citizen biometric record.
    """
    # Citizens can only view their own biometrics
    if user['role'] == UserRole.CITIZEN:
        citizen = await sync_to_async(citizen_service.get_citizen_by_din)(din)
        if not citizen or citizen.din != user["din"]:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Citizens can only view their own biometrics.",
            )

    biometric_record = await sync_to_async(biometric_service.get_biometric_by_citizen_din)(citizen_din=din)
    if not biometric_record:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Biometric record not found"
        )
    return biometric_record


@router.post("/{din}/biometrics", response_model=BiometricRecordResponse)
async def create_citizen_biometrics(
    din: str,
    biometric_data: BiometricRecordBase,
    user=Depends(require_groups([UserRole.REGISTRATION_OFFICER]))
):
    """
    Create citizen biometric record.
    Used by Registration Officer to submit captured biometrics.
    """
    # Check if citizen exists
    citizen = await sync_to_async(citizen_service.get_citizen_by_din)(din)
    if not citizen:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Citizen not found"
        )

    # Create biometric record
    biometric_record = await sync_to_async(biometric_service.create_biometric_record)(
        din, biometric_data, actor_id=user["id"], actor_role=user["role"]
    )
    
    logger.info(f"Created biometric record for citizen: {din}")
    return biometric_record


@router.patch("/{din}/biometrics", response_model=BiometricRecordResponse)
async def update_citizen_biometrics(
    din: str,
    biometric_data: BiometricRecordBase,
    user=Depends(require_groups([UserRole.REGISTRAR, UserRole.REGISTRATION_OFFICER]))
):
    """
    Update citizen biometric record.
    Used for re-capture of biometrics (e.g. poor quality).
    """
    # Check if citizen exists
    citizen = await sync_to_async(citizen_service.get_citizen_by_din)(din)
    if not citizen:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Citizen not found"
        )

    # Update biometric record
    updated_biometric = await sync_to_async(biometric_service.update_biometric_record)(
        din, biometric_data, actor_id=user["id"], actor_role=user["role"]
    )
    
    logger.info(f"Updated biometric record for citizen: {din}")
    return updated_biometric


@router.post("/{din}/family-links", response_model=FamilyLinkResponse)
async def create_family_link(
    din: str,
    family_link_data: FamilyLinkBase,
    user = Depends(require_groups([UserRole.REGISTRAR, UserRole.REGISTRATION_OFFICER]))
):
    """
    Create family link for citizen.
    """
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
    user=Depends(require_groups([UserRole.CITIZEN, UserRole.SUPERVISOR, UserRole.REGISTRAR, UserRole.REGISTRATION_OFFICER]))
):
    """
    Get family tree for citizen.
    """
    if user["role"] == UserRole.CITIZEN:
        citizen = await sync_to_async(citizen_service.get_citizen_by_din)(din)
        if not citizen or citizen.din != user["din"]:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Citizens can only view their own family tree."
            )

    family_tree = await sync_to_async(family_service.get_family_tree)(din)
    return family_tree


# List citizens with filtering

@router.get("/", response_model=list[CitizenSummary])
async def list_citizens(
    user=Depends(require_groups([UserRole.REGISTRATION_OFFICER, UserRole.REGISTRAR, UserRole.SUPERVISOR])),
    status: Optional[CitizenStatus] = None,
    language: Optional[Language] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    """
    List citizens with filtering and pagination.
    """
    citizens = await sync_to_async(citizen_service.list_citizens)(
        status=status,
        language=language,
        search=search,
        page=page,
        page_size=page_size,
    )
    return citizens
