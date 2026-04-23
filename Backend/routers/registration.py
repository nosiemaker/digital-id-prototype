from fastapi import APIRouter, Request, Depends
from typing import Optional
from datetime import datetime

from registration.schema import (
    EnrollmentRequestResponse,
    EnrollmentApproval,
    EnrollmentRejection,
    PaginatedEnrollmentList,
)
from registration.models import EnrollmentStatus
from registration.services.registration_service import (
    list_enrollment_requests as service_list_enrollment_requests,
    approve_enrollment_request as service_approve_enrollment_request,
    reject_enrollment_request as service_reject_enrollment_request,
)
from Utils.rbac import (
    get_permission_dependency,
    Permission,
)

router = APIRouter(prefix="/enrollments", tags=["enrollments"])


@router.get("/", response_model=PaginatedEnrollmentList)
async def list_enrollment_requests(
    request: Request,
    status: Optional[EnrollmentStatus] = None,
    ro_id: Optional[int] = None,
    submitted_after: Optional[datetime] = None,
    submitted_before: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 20,
    current_user: dict = Depends(get_permission_dependency(Permission.RO_READ_PENDING_ENROLLMENTS)),
):
    """
    List enrollment requests with filtering and pagination.
    Used by Registration Officer Dashboard to see pending requests.
    """
    return service_list_enrollment_requests(
        status=status,
        ro_id=ro_id,
        submitted_after=submitted_after,
        submitted_before=submitted_before,
        page=page,
        page_size=page_size,
    )


@router.patch("/{enrollment_id}/approve", response_model=EnrollmentRequestResponse)
async def approve_enrollment_request(
    enrollment_id: int,
    approval_data: EnrollmentApproval,
    request: Request,
    current_user: dict = Depends(get_permission_dependency(Permission.RO_APPROVE_ENROLLMENT)),
):
    """
    Approve an enrollment request.
    Generates activation challenge and sets status to APPROVED.
    """
    return service_approve_enrollment_request(
        enrollment_id=enrollment_id,
        approval_data=approval_data,
        current_user_id=current_user["id"],
    )


@router.patch("/{enrollment_id}/reject", response_model=EnrollmentRequestResponse)
async def reject_enrollment_request(
    enrollment_id: int,
    rejection_data: EnrollmentRejection,
    request: Request,
    current_user: dict = Depends(get_permission_dependency(Permission.RO_REJECT_ENROLLMENT)),
):
    """
    Reject an enrollment request.
    Sets status to REJECTED and records rejection reason.
    """
    return service_reject_enrollment_request(
        enrollment_id=enrollment_id,
        rejection_data=rejection_data,
        current_user_id=current_user["id"],
    )
