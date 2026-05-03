from typing import Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Request, Depends
from pydantic import BaseModel
from asgiref.sync import sync_to_async
from django.utils import timezone

from kyc.service.services import KYCService, StatisticsService, PartnerLinkService
from kyc.models import KYCRequest
from kyc.schema import (
    KYCRequestCreate as KYCRequestInitiate,
    KYCRequestCitizenAction as CitizenResponse,
    KYCRequestResponse,
    ConsentRecordResponse,
    VerifiedPartnerResponse,
    PartnerLinkResponse,
    InstitutionLinkedCitizenResponse,
)
from Utils.rbac import (
    get_permission_dependency,
    Permission,
)
from Utils.audit_logger import audit

router = APIRouter()


class ApprovedCitizenDataResponse(BaseModel):
    """
    Response containing ONLY the fields the citizen approved for sharing.
    This implements selective data disclosure - institution receives no more data
    than what was explicitly consented to by the citizen.
    """
    kyc_request_id: int
    citizen_din: str
    approved_fields: dict[str, Any]  # Only fields in fields_granted
    decision: str
    timestamp: str


class StatisticsResponse(BaseModel):
    total_registered_citizens: int
    live_births_vs_deaths: dict[str, int]
    gender_ratio: dict[str, Any]
    regional_breakdown: list[dict[str, Any]]
    kyc_metrics: dict[str, Any]


@router.post("/request", response_model=KYCRequestResponse, status_code=status.HTTP_201_CREATED)
async def initiate_kyc_request(
    request_data: KYCRequestInitiate,
    request: Request,
    current_user: dict = Depends(get_permission_dependency(Permission.THIRD_PARTY_INITIATE_TRANSACTION)),
):
    """
    Third-party institution initiates a KYC request for a citizen.
    Requires THIRD_PARTY_INITIATE_TRANSACTION permission.
    """
    # Extract institution info from current user (assuming it's stored in user)
    institution_id = current_user.get("institution_id")
    if not institution_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not associated with any institution"
        )
    
    # Create KYC request
    kyc_request = await sync_to_async(KYCService.create_kyc_request)(
        institution_id=institution_id,
        citizen_din=request_data.citizen_din,
        fields_requested=request_data.fields_requested
    )
    
    # Log the action
    await audit.kyc_request_initiated(
        user_id=current_user.get("id"),
        institution_id=institution_id,
        citizen_din=request_data.citizen_din,
        kyc_request_id=kyc_request.id
    )
    
    return KYCRequestResponse(
        id=kyc_request.id,
        institution_name=kyc_request.institution.name,
        citizen_din=kyc_request.citizen_din,
        fields_requested=kyc_request.fields_requested,
        fields_granted=kyc_request.fields_granted or [],
        status=kyc_request.status,
        requested_at=kyc_request.requested_at.isoformat(),
        responded_at=kyc_request.responded_at.isoformat() if kyc_request.responded_at else None,
        expires_at=kyc_request.expires_at.isoformat() if kyc_request.expires_at else None
    )


@router.post("/{kyc_request_id}/respond", response_model=ConsentRecordResponse, status_code=status.HTTP_200_OK)
async def respond_to_kyc_request(
    kyc_request_id: int,
    response_data: CitizenResponse,
    request: Request,
    current_user: dict = Depends(get_permission_dependency(Permission.CITIZEN_READ_OWN_PROFILE)),
):
    """
    Citizen responds to a KYC request (approve/deny).
    Requires CITIZEN_READ_OWN_PROFILE permission (citizens can only respond to their own requests).
    """
    citizen_id = current_user.get("id")
    if not citizen_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to identify citizen"
        )
    
    # Validate decision
    if response_data.decision not in ['APPROVED', 'DENIED']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decision must be either 'APPROVED' or 'DENIED'"
        )
    
    # Process the response
    consent_record = await sync_to_async(KYCService.process_citizen_response)(
        kyc_request_id=kyc_request_id,
        decision=response_data.decision,
        citizen_id=citizen_id,
        fields_granted=response_data.fields_granted
    )
    
    # Log the action
    await audit.kyc_request_responded(
        user_id=citizen_id,
        kyc_request_id=kyc_request_id,
        decision=response_data.decision
    )
    
    return ConsentRecordResponse(
        id=consent_record.id,
        decision=consent_record.decision,
        fields_shared=consent_record.fields_shared,
        timestamp=consent_record.timestamp.isoformat()
    )


@router.get("/{kyc_request_id}/data", response_model=ApprovedCitizenDataResponse, status_code=status.HTTP_200_OK)
async def retrieve_approved_kyc_data(
    kyc_request_id: int,
    request: Request,
    current_user: dict = Depends(get_permission_dependency(Permission.THIRD_PARTY_INITIATE_TRANSACTION)),
):
    """
    Retrieve approved citizen data for an approved KYC request.
    
    SECURITY: Only returns fields that were explicitly approved by the citizen.
    This endpoint enforces selective data disclosure - the third-party institution
    receives ONLY the fields they requested AND the citizen approved.
    
    Requires THIRD_PARTY_INITIATE_TRANSACTION permission (institution must own the request).
    
    Returns:
        ApprovedCitizenDataResponse with only approved fields
        
    Raises:
        404: If KYC request not found or already expired
        403: If institution doesn't own this request or decision is DENIED
        400: If request status is not APPROVED
    """
    institution_id = current_user.get("institution_id")
    if not institution_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not associated with any institution"
        )
    
    # Fetch the KYC request
    try:
        kyc_request = await sync_to_async(lambda: KYCRequest.objects.select_related('citizen', 'consent_record').get(id=kyc_request_id))()
    except KYCRequest.DoesNotExist:
        await audit.alog(
            actor_id=institution_id,
            actor_role="THIRD_PARTY",
            action="KYC_DATA_RETRIEVAL_FAILED",
            target_type="KYC_REQUEST",
            target_id=str(kyc_request_id),
            outcome="FAILURE"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KYC request not found"
        )
    
    # Verify institution owns this request
    if kyc_request.institution_id != institution_id:
        await audit.alog(
            actor_id=institution_id,
            actor_role="THIRD_PARTY",
            action="KYC_DATA_RETRIEVAL_UNAUTHORIZED",
            target_type="KYC_REQUEST",
            target_id=str(kyc_request_id),
            outcome="FAILURE"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institution does not have access to this request"
        )
    
    # Verify request is approved
    if kyc_request.status != "APPROVED":
        await audit.alog(
            actor_id=institution_id,
            actor_role="THIRD_PARTY",
            action="KYC_DATA_RETRIEVAL_FAILED",
            target_type="KYC_REQUEST",
            target_id=str(kyc_request_id),
            outcome="FAILURE",
            meta={"reason": f"Status is {kyc_request.status}, not APPROVED"}
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"KYC request status is {kyc_request.status}, not APPROVED"
        )
    
    # Check if request has expired
    if kyc_request.expires_at and kyc_request.expires_at < timezone.now():
        await audit.alog(
            actor_id=institution_id,
            actor_role="THIRD_PARTY",
            action="KYC_DATA_RETRIEVAL_FAILED",
            target_type="KYC_REQUEST",
            target_id=str(kyc_request_id),
            outcome="FAILURE",
            meta={"reason": "KYC request has expired"}
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="KYC request has expired"
        )
    
    # Verify consent record exists and decision is APPROVED
    if not kyc_request.consent_record or kyc_request.consent_record.decision != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizen has not approved this request"
        )
    
    # Filter citizen data to only approved fields
    approved_data = await sync_to_async(KYCService.filter_citizen_data)(
        citizen=kyc_request.citizen,
        fields_requested=kyc_request.fields_granted or []
    )
    
    # Log successful data retrieval
    await audit.kyc_consent_granted(
        citizen_din=kyc_request.citizen_din,
        institution_id=institution_id,
        fields_shared=kyc_request.fields_granted
    )
    
    return ApprovedCitizenDataResponse(
        kyc_request_id=kyc_request.id,
        citizen_din=kyc_request.citizen_din,
        approved_fields=approved_data,
        decision="APPROVED",
        timestamp=kyc_request.responded_at.isoformat() if kyc_request.responded_at else ""
    )


@router.get("/statistics", response_model=StatisticsResponse, status_code=status.HTTP_200_OK)
async def get_kyc_statistics(
    request: Request,
    current_user: dict = Depends(get_permission_dependency(Permission.SUPERVISOR_SYSTEM_OVERVIEW)),
):
    """
    Get KYC and demographic statistics for government dashboard.
    Requires SUPERVISOR_SYSTEM_OVERVIEW permission (admin/supervisor level).
    
    Returns real-time aggregate statistics across:
    - Total registered citizens
    - Live births vs. recorded deaths (based on citizen status)
    - Gender ratio breakdown
    - Regional breakdown by Zambian provinces
    - KYC metrics (approval rates, pending requests)
    """
    user_id = current_user.get("id")
    user_role = current_user.get("role", "UNKNOWN")
    
    # Log access to statistics dashboard
    await audit.alog(
        actor_id=user_id,
        actor_role=user_role,
        action="STATISTICS_DASHBOARD_ACCESSED",
        target_type="SYSTEM_DASHBOARD",
        target_id="KYC_STATISTICS",
        meta={"endpoint": "GET /statistics"}
    )
    
    # Get all statistics
    total_citizens = await sync_to_async(StatisticsService.get_total_registered_citizens)()
    births_deaths = await sync_to_async(StatisticsService.get_live_births_vs_deaths)()
    gender_ratio = await sync_to_async(StatisticsService.get_gender_ratio)()
    regional_breakdown = await sync_to_async(StatisticsService.get_regional_breakdown)()
    kyc_metrics = await sync_to_async(StatisticsService.get_kyc_metrics)()
    
    return StatisticsResponse(
        total_registered_citizens=total_citizens,
        live_births_vs_deaths=births_deaths,
        gender_ratio=gender_ratio,
        regional_breakdown=regional_breakdown,
        kyc_metrics=kyc_metrics
    )


@router.get("/partners/verified", response_model=list[VerifiedPartnerResponse])
async def list_verified_partners(
    current_user: dict = Depends(get_permission_dependency(Permission.CITIZEN_READ_OWN_PROFILE)),
):
    """List all active third-party institutions."""
    partners = await sync_to_async(PartnerLinkService.get_verified_partners)()
    return [
        VerifiedPartnerResponse(
            id=p.id,
            name=p.name,
            institution_type=p.institution_type,
            email=p.email
        ) for p in partners
    ]


@router.post("/partners/{institution_id}/link", response_model=PartnerLinkResponse)
async def link_partner_account(
    institution_id: int,
    current_user: dict = Depends(get_permission_dependency(Permission.CITIZEN_READ_OWN_PROFILE)),
):
    """Link the current citizen account to a verified partner."""
    system_user_id = current_user.get("id")
    try:
        link = await sync_to_async(PartnerLinkService.link_account)(
            system_user_id=system_user_id,
            institution_id=institution_id
        )
        return PartnerLinkResponse(
            id=link.id,
            institution_id=link.institution.id,
            institution_name=link.institution.name,
            institution_type=link.institution.institution_type,
            linked_at=link.linked_at,
            is_active=link.is_active
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/partners/linked", response_model=list[PartnerLinkResponse])
async def list_linked_partners(
    current_user: dict = Depends(get_permission_dependency(Permission.CITIZEN_READ_OWN_PROFILE)),
):
    """List all institutions linked to the current citizen."""
    system_user_id = current_user.get("id")
    links = await sync_to_async(PartnerLinkService.get_linked_partners)(system_user_id=system_user_id)
    return [
        PartnerLinkResponse(
            id=l.id,
            institution_id=l.institution.id,
            institution_name=l.institution.name,
            institution_type=l.institution.institution_type,
            linked_at=l.linked_at,
            is_active=l.is_active
        ) for l in links
    ]


@router.get("/institution/linked-citizens", response_model=list[InstitutionLinkedCitizenResponse])
async def list_institution_linked_citizens(
    current_user: dict = Depends(get_permission_dependency(Permission.THIRD_PARTY_VERIFY_CITIZEN_ID)),
):
    """List all citizens linked to the current institution."""
    system_user_id = current_user.get("id")
    try:
        links = await sync_to_async(PartnerLinkService.get_institution_linked_citizens)(system_user_id=system_user_id)
        return [
            InstitutionLinkedCitizenResponse(
                link_id=l.id,
                citizen_din=l.citizen.din,
                citizen_name=l.citizen.full_name,
                citizen_nrc=l.citizen.nrc,
                linked_at=l.linked_at,
                is_active=l.is_active
            ) for l in links
        ]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Integration Example: Cascading Updates & Real-Time Statistics
# ============================================================================
#
# SCENARIO: A Citizen's death is recorded in the registry, and an RO approves
# the Death Record. The system automatically cascades the update to all related
# statistics endpoints.
#
# STEP 1: Death Record approval updates the Citizen's status
#   In hospital/routes.py (or wherever death records are processed):
#   
#   death_record = DeathRecord.objects.get(id=death_record_id)
#   citizen = death_record.citizen
#   citizen.status = CitizenStatus.DECEASED  # Status change
#   citizen.save()
#   
#   audit.log(
#       actor_id=ro_id,
#       actor_role="RO",
#       action="DEATH_RECORD_APPROVED",
#       target_type="DEATH_RECORD",
#       target_id=death_record.id,
#       meta={"citizen_din": citizen.din}
#   )
#
# STEP 2: GET /statistics immediately reflects the change
#   Because StatisticsService.get_live_births_vs_deaths() uses Django aggregates
#   that query the Citizen table in real-time:
#   
#   stats = Citizen.objects.aggregate(
#       live_births=Count('id', filter=Q(status=CitizenStatus.ACTIVE)),
#       recorded_deaths=Count('id', filter=Q(status=CitizenStatus.DECEASED))
#   )
#   
#   The death count automatically increments without any explicit trigger.
#
# STEP 3: Regional statistics also auto-update
#   Similarly, get_regional_breakdown() queries by province in real-time:
#   
#   province_stats = Citizen.objects.values('province').annotate(
#       count=Count('id')
#   )
#   
#   If the deceased citizen is from Lusaka, the Lusaka region's count
#   decreases automatically (since DECEASED citizens may be filtered out).
#
# STEP 4: Audit trail is preserved
#   All changes are logged via audit.log() or audit.alog() calls.
#   The DEATH_RECORD_APPROVED action stores the citizen DIN in metadata,
#   allowing downstream systems to trace: Death Record → Citizen Status → Statistics.
#
# ============================================================================