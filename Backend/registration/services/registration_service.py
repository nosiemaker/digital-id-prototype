from typing import Optional
from datetime import datetime
from fastapi import HTTPException, status as http_status

from registration.models import EnrollmentRequest, EnrollmentStatus
from registration.schema import (
    EnrollmentRequestResponse,
    PaginatedEnrollmentList,
    EnrollmentApproval,
    EnrollmentRejection,
)
from Utils.audit_logger import audit


def enrollment_request_to_response(obj: EnrollmentRequest) -> EnrollmentRequestResponse:
    """Convert EnrollmentRequest model to EnrollmentRequestResponse schema."""
    return EnrollmentRequestResponse(
        id=obj.id,
        citizen_id=obj.citizen_id,
        submitted_at=obj.submitted_at,
        ro_id=obj.ro_id if obj.ro else None,
        reviewed_at=obj.reviewed_at,
        status=obj.status,
        rejection_reason=obj.rejection_reason,
        activation_challenge=obj.activation_challenge,
        activation_challenge_expires_at=obj.activation_challenge_expires_at,
    )


def list_enrollment_requests(
    status: Optional[EnrollmentStatus] = None,
    ro_id: Optional[int] = None,
    submitted_after: Optional[datetime] = None,
    submitted_before: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedEnrollmentList:
    """
    List enrollment requests with filtering and pagination.
    Used by Registration Officer Dashboard to see pending requests.
    """
    # Build queryset
    queryset = EnrollmentRequest.objects.all()

    # Apply filters
    if status:
        queryset = queryset.filter(status=status)
    if ro_id:
        queryset = queryset.filter(ro_id=ro_id)
    if submitted_after:
        queryset = queryset.filter(submitted_at__gte=submitted_after)
    if submitted_before:
        queryset = queryset.filter(submitted_at__lte=submitted_before)

    # Order by submission date (newest first)
    queryset = queryset.order_by("-submitted_at")

    # Pagination
    total = queryset.count()
    start = (page - 1) * page_size
    end = start + page_size
    enrollment_requests = queryset[start:end]

    # Convert to response models
    items = [enrollment_request_to_response(obj) for obj in enrollment_requests]

    return PaginatedEnrollmentList(
        total=total, page=page, page_size=page_size, items=items
    )


def approve_enrollment_request(
    enrollment_id: int,
    approval_data: EnrollmentApproval,
    current_user_id: int,
) -> EnrollmentRequestResponse:
    """
    Approve an enrollment request.
    Generates activation challenge and sets status to APPROVED.
    """
    try:
        enrollment_request = EnrollmentRequest.objects.get(id=enrollment_id)
    except EnrollmentRequest.DoesNotExist:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Enrollment request not found",
        )

    # Check if already processed
    if enrollment_request.status != EnrollmentStatus.PENDING:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Enrollment request is already {enrollment_request.status}",
        )

    # Update the enrollment request
    enrollment_request.status = EnrollmentStatus.APPROVED
    enrollment_request.ro_id = current_user_id
    enrollment_request.reviewed_at = datetime.now()
    enrollment_request.activation_challenge = approval_data.activation_challenge
    enrollment_request.activation_challenge_expires_at = (
        approval_data.activation_challenge_expires_at
    )
    enrollment_request.save()
    
    # Log the enrollment approval
    audit.enrollment_approved(current_user_id, enrollment_id)


    # This would involve updating the related Citizen record.
    # For now, we just update the enrollment request.

    return enrollment_request_to_response(enrollment_request)


def reject_enrollment_request(
    enrollment_id: int,
    rejection_data: EnrollmentRejection,
    current_user_id: int,
) -> EnrollmentRequestResponse:
    """
    Reject an enrollment request.
    Sets status to REJECTED and records rejection reason.
    """
    try:
        enrollment_request = EnrollmentRequest.objects.get(id=enrollment_id)
    except EnrollmentRequest.DoesNotExist:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Enrollment request not found",
        )

    # Check if already processed
    if enrollment_request.status != EnrollmentStatus.PENDING:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Enrollment request is already {enrollment_request.status}",
        )

    # Update the enrollment request
    enrollment_request.status = EnrollmentStatus.REJECTED
    enrollment_request.ro_id = current_user_id
    
    # Log the enrollment rejection
    audit.enrollment_rejected(current_user_id, enrollment_id, rejection_data.rejection_reason)
    enrollment_request.reviewed_at = datetime.now()
    enrollment_request.rejection_reason = rejection_data.rejection_reason
    enrollment_request.save()

    return enrollment_request_to_response(enrollment_request)
