# citizen_registration.py (Service)
# Business logic for citizen enrollment: creating enrollment requests,
# retrieving pending requests, and approving or rejecting them.
# All database mutations that touch multiple models are wrapped in
# atomic transactions to guarantee consistency.

import datetime
import logging
from django.db import transaction
from fastapi import HTTPException, status
from admin_ops.models import SystemUser, UserRole
from admin_ops.services.otp_service import issue_otp, verify_otp
from admin_ops.schema import ( AccountCreateRequest, IdentitySubmitRequest)
from citizens.models import Citizen, CitizenStatus
from registration.models import EnrollmentRequest,EnrollmentStatus
from registration.serializers import CitizenRegistrationRequestSerializer
from citizens.serializer import CitizenSerializer
from uuid import uuid4
from citizens.utilities.id_generation import generate_id
from Utils.audit_logger import audit
from Utils.auth import hash_password

logging = logging.getLogger(__name__)

# Phase 1 - Account Creation

def create_account(body: AccountCreateRequest) -> dict:
    """
    Creates an inactive SystemUser and fires an email OTP.

    Guard: reject duplicate emails immediately so the caller can fix their
    input rather than discovering it at OTP-verify time.
    """
    if SystemUser.objects.filter(email=body.email).exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email address already exists.",
        )

    username_base = body.email.split("@")[0]
    username = _unique_username(username_base)

    user = SystemUser.objects.create(
        username=username,
        email= body.email,
        password= hash_password(body.password),
        role = UserRole.CITIZEN,
        is_active= False,
        is_email_verified= False,
    )

    audit.log(
        actor_id=user.id,
        actor_role=user.role,
        action="ACCOUNT_CREATED",
        target_type="SYSTEM_USER",
        target_id=user.id,
        meta={"email": user.email},
    )

    issue_otp(user)

    return {
        "user_id": user.id,
        "email": user.email,
        "message": "OTP sent to your email address. Please verify to activate your account.",
    }

def verify_email_otp(email: str, raw_otp: str) -> dict:
    """
       Verify the OTP.  Delegates all logic to otp_service.verify_otp().
       """
    user = verify_otp(email, raw_otp)

    return {
        "message": "Email verified successfully. You may now log in.",
        "is_email_verified": True,
    }

def resend_otp(email: str) -> dict:
    """
       Re-issue a fresh OTP for an unverified account.
    """

    try:
        user = SystemUser.objects.get(email=email)
    except SystemUser.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with that email address.",
        )

    if user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No account found with that email address.",
        )

    issue_otp(user)
    return {"message": f"A new OTP has been sent to {email}."}

# Phase 2 - Identity Submission

def identity_submission(body: IdentitySubmitRequest, system_user_id) -> dict:
    """
    Called from the dashboard once the user is logged in and email-verified.

    Creates:
      • Citizen   (status=PENDING, no DIN — assigned on RO approval)
      • EnrollmentRequest  (status=PENDING)

    Guards:
      • User must be email-verified.
      • User must not already have a citizen_din (idempotency guard).
      • NRC must be unique.
    """

    try:
        system_user = SystemUser.objects.get(id=system_user_id)
    except SystemUser.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="System user not found.")

    if not system_user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address must be verified before submitting identity documents.",
        )

    if Citizen.objects.filter(user=system_user, din__isnull=False).exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A DIN is already assigned to this account. Identity already enrolled.",
        )

    if Citizen.objects.filter(nrc=body.nrc).exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An enrollment record with that NRC already exists.",
        )

    citizen_data = {
        "user": system_user.id,
        "nrc": body.nrc,
        "full_name": body.full_name,
        "dob": body.dob.isoformat(),
        "phone": body.phone,
        "gender": body.gender,
        "province": body.province,
        "nrc_front_url": body.nrc_front_url,
        "nrc_back_url": body.nrc_back_url,
        "face_image_url": body.face_image_url,
        "public_key": body.public_key,
        "language": body.language,
        "status": CitizenStatus.PENDING,
    }

    with transaction.atomic():
        #1. Create Citizen record
        citizen_serializer = CitizenSerializer(data=citizen_data)
        if not citizen_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=citizen_serializer.errors)
        citizen = citizen_serializer.save()

        system_user.first_name = citizen.full_name
        system_user.save(update_fields=["first_name"])

        # 2. Create Linked EnrollmentRequest
        er_serializer = CitizenRegistrationRequestSerializer(data={"citizen": citizen.id})
        if not er_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=er_serializer.errors)
        enrollment_request = er_serializer.save()

        audit.log(
        actor_id   = system_user_id,
        actor_role = system_user.role,
        action     = "NRC_SUBMITTED",
        target_id  = citizen.id,
        target_type=UserRole.CITIZEN,
        details    = {
            "nrc":                body.nrc,
            "enrollment_request": enrollment_request.id,
            },
        )

        logging.info(
        f"Identity submitted: user={system_user_id}, citizen={citizen.id}, "
        f"enrollment_request={enrollment_request.id}"
        )

        return {
        "enrollment_request_id": enrollment_request.id,
        "citizen_id":            citizen.id,
        "message": "Identity submitted. An officer will review your request.",
        }

# Retrieves all enrollment requests currently in PENDING status.
def get_all_pending():
    pending_enrollments = EnrollmentRequest.objects.filter(status=EnrollmentStatus.PENDING)
    serializer = CitizenRegistrationRequestSerializer(pending_enrollments, many=True)
    return serializer.data

# Retrieves a single enrollment request by its primary key.
# Note: Does not filter by status — returns requests in any state.
def get_single_pending(request_id: int):
    pending_enrollment = EnrollmentRequest.objects.get(id=request_id)
    serializer = CitizenRegistrationRequestSerializer(pending_enrollment)
    return serializer.data

# Approves a citizen enrollment request.
# Generates a unique DIN for the citizen, guards against duplicate registrations,
# then atomically marks the enrollment request as APPROVED and activates the citizen
# record by assigning the generated DIN and setting status to ACTIVE.
def approve_citizen_registration(request_id: int, ro_id:int) -> dict:
    # Fetch the enrollment request along with its related citizen in one query
    try:
        enrollment = EnrollmentRequest.objects.select_related("citizen").get(id=request_id)
    except EnrollmentRequest.DoesNotExist:
         raise HTTPException(
             status_code=status.HTTP_404_NOT_FOUND,
             detail="Enrollment request not found.",
         )

    if enrollment.status != EnrollmentStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Request is not PENDING (current status: {enrollment.status}).",
        )

    citizen = enrollment.citizen

    # Generate a candidate DIN using a random UUID as the seed
    din = _generate_unique_din()

    # Atomically update the enrollment request and activate the citizen record
    with transaction.atomic():

        # Mark the enrollment request as APPROVED with reviewer and timestamp
        enrollment_serializer = CitizenRegistrationRequestSerializer(
            instance=enrollment,
            data = {
                "status": EnrollmentStatus.APPROVED,
                "ro": ro_id,
                "reviewed_at": datetime.datetime.now(datetime.timezone.utc),
            },
            partial =True
        )

        if not enrollment_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=enrollment_serializer.errors,
            )

        enrollment_serializer.save()

        # Assign the generated DIN to the citizen and set their status to ACTIVE
        citizen_serializer = CitizenSerializer(
            instance=citizen,
            data = {
                "din": din,
                "status": CitizenStatus.ACTIVE,
            },
            partial=True
        )

        if not citizen_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=citizen_serializer.errors,
            )

        citizen_serializer.save()
        if citizen.user:
            citizen.user.first_name = citizen.full_name
            citizen.user.save(update_fields=["first_name"])

        # == Audit ==
        audit.log(
            actor_id=ro_id,
            actor_role=UserRole.REGISTRATION_OFFICER,
            action="ENROLLMENT_APPROVED",
            target_id=enrollment.id,
            details={"enrollment_request_id": enrollment.id},
        )

        audit.log(
            actor_id=ro_id,
            actor_role=UserRole.REGISTRATION_OFFICER,
            action="DIN_ISSUED",
            target_id=citizen.id,
            details={"din": din, "citizen_id": citizen.id, "nrc": citizen.nrc},
        )

        return {
            "details": "Approval successful.",
            "din": din,
            "request": enrollment_serializer.data,
            "status": status.HTTP_200_OK,
        }

# Rejects a citizen enrollment request.
# Validates the request exists and is still PENDING, then atomically marks
# both the enrollment request and the citizen record as REJECTED, storing
# the provided rejection reason.
def reject_citizen_registration(request_id: int, ro_id: int, rejection_reason:str) -> dict:

    try:
        # Fetch the enrollment request along with its related citizen in one query
        enrollment = (EnrollmentRequest.objects.select_related("citizen").get(id=request_id))
    except EnrollmentRequest.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request Is Not Found",
        )

    # Guard: only PENDING requests can be rejected
    if enrollment.status != EnrollmentStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request Is Not Pending",
        )

    citizen = enrollment.citizen

    # Atomically update the enrollment request and the citizen record to REJECTED
    with transaction.atomic():
        # Mark the enrollment request as REJECTED with reviewer, timestamp, and reason
        serializer = CitizenRegistrationRequestSerializer(
            instance=enrollment,
            data={
                "status": EnrollmentStatus.REJECTED,
                "ro": ro_id,
                "reviewed_at": datetime.datetime.now(),
                "rejection_reason": rejection_reason,
            },
            partial=True
        )

        if not serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail= serializer.errors,
            )


        serializer.save()

        # Set the citizen's status to REJECTED to reflect the failed enrollment
        citizen_serializer = CitizenSerializer(
            instance=citizen,
            data={
                "status": CitizenStatus.REJECTED,
            },
            partial=True
        )

        if not citizen_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=citizen_serializer.errors,
            )

        citizen_serializer.save()

        audit.log(
            actor_id=ro_id,
            actor_role=UserRole.REGISTRATION_OFFICER,
            action="ENROLLMENT_REJECTED",
            target_id=enrollment.id,
            details={
                "enrollment_request_id": enrollment.id,
                "rejection_reason": rejection_reason,
            },
        )

        return {"details": "Request Successfully Rejected",
                "request": serializer.data,
                "status": status.HTTP_200_OK}


def _unique_username(base: str) -> str:
    """
    Derive a unique username from the email prefix.
    Appends a counter suffix if collisions occur.
    """
    candidate = base
    counter = 1
    while SystemUser.objects.filter(username=candidate).exists():
        candidate = f"{base}{counter}"
        counter += 1
    return candidate


def _generate_unique_din(max_attempts: int = 5) -> str:
    """
    Generate a DIN that doesn't already exist in the Citizen table.

    Uses generate_id() with a fresh UUID seed each attempt.
    Raises after max_attempts to prevent infinite loops under extreme load.
    """
    for attempt in range(max_attempts):
        candidate = generate_id(uuid4().bytes, "CITIZEN")
        if not Citizen.objects.filter(din=candidate).exists():
            return candidate
        logging.warning(f"DIN collision on attempt {attempt + 1}: {candidate}")

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to generate a unique DIN after multiple attempts. Please retry.",
    )
