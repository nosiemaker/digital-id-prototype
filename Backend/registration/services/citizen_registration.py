# citizen_registration.py (Service)
# Business logic for citizen enrollment: creating enrollment requests,
# retrieving pending requests, and approving or rejecting them.
# All database mutations that touch multiple models are wrapped in
# atomic transactions to guarantee consistency.

import secrets
import datetime
import logging
from django.db import transaction
from fastapi import HTTPException, status
from admin_ops.models import SystemUser, UserRole
from admin_ops.services.otp_service import issue_otp, verify_otp
from admin_ops.schema import AccountCreateRequest, IdentitySubmitRequest
from citizens.models import Citizen, CitizenStatus, District, RegistrationOfficer
from registration.models import EnrollmentRequest, EnrollmentStatus
from registration.serializers import CitizenRegistrationRequestSerializer
from citizens.serializer import CitizenSerializer
from uuid import uuid4
from citizens.utilities.id_generation import generate_id
from Utils.audit_logger import audit
from Utils.auth import hash_password
from Utils.email_service import (
    send_identity_submitted_email,
    notify_officers_of_pending_review,
    send_enrollment_approved_email,
    send_enrollment_rejected_email
)

logger = logging.getLogger(__name__)

def _province_summary(province) -> dict | None:
    """Build ProvinceSummary dict from Province model instance."""
    if not province:
        return None
    return {
        "id": province.id,
        "name": province.name,
        "code": province.code,
    }


def _district_summary(district) -> dict | None:
    """Build DistrictSummary dict with nested province."""
    if not district:
        return None
    return {
        "id": district.id,
        "name": district.name,
        "code": district.code,
        "province": _province_summary(district.province),
    }


def _citizen_summary(citizen: Citizen) -> dict:
    """Build CitizenSummary — lightweight, used in lists and RO nesting."""
    return {
        "din": citizen.din or "",
        "full_name": citizen.full_name,
        "nrc": citizen.nrc or "",
        "status": citizen.status,
    }


def _citizen_response(citizen: Citizen) -> dict:
    """
    Build CitizenResponse — EVERY field the frontend review page needs.
    Called by all enrollment response builders so the citizen payload
    is always complete (district, gender, docs, crypto, etc.).
    """
    return {
        # Base fields
        "nrc": citizen.nrc or "",
        "full_name": citizen.full_name,
        "dob": citizen.dob,
        "phone": citizen.phone,
        "public_key": citizen.public_key,
        "language": citizen.language or "en",
        "nrc_front_url": citizen.nrc_front_url,
        "nrc_back_url": citizen.nrc_back_url,
        "face_image_url": citizen.face_image_url,
        # Status & IDs
        "din": citizen.din,
        "status": citizen.status,
        # Extended profile
        "gender": citizen.gender,
        "residential_address": citizen.residential_address,
        "district": _district_summary(citizen.district),
        "citizen_type": citizen.citizen_type or "ADULT",
        # Activation
        "activation_nonce": citizen.activation_nonce,
        "challenge_expires_at": citizen.challenge_expires_at,
        # Metadata
        "created_at": citizen.created_at,
        "updated_at": citizen.updated_at,
    }


def _ro_summary(ro_id: int | None) -> dict | None:
    """
    Resolve a SystemUser ID into RO profile details.
    Looks up RegistrationOfficer via citizen__user linkage.
    Falls back to SystemUser first_name if RO profile missing.
    """
    if not ro_id:
        return None
    try:
        ro = RegistrationOfficer.objects.select_related("user").get(
            id=ro_id
        )
        return {
            "id": ro_id,
            "employee_id": ro.employee_id,
            "citizen": _citizen_summary(ro.user.citizen) if hasattr(ro.user, 'citizen') else {
                "din": "",
                "full_name": f"{ro.user.first_name} {ro.user.last_name}",
                "nrc": "",
                "status": "ACTIVE",
            },
        }
    except RegistrationOfficer.DoesNotExist:
        # Fallback — RO may exist as SystemUser without officer profile
        try:
            user = SystemUser.objects.get(id=ro_id)
            return {
                "id": ro_id,
                "employee_id": f"USER-{ro_id}",
                "citizen": {
                    "din": "",
                    "full_name": getattr(user, "first_name", "Unknown") or "Unknown",
                    "nrc": "",
                    "status": "ACTIVE",
                },
            }
        except SystemUser.DoesNotExist:
            return None


def _enrollment_response(enrollment: EnrollmentRequest) -> dict:
    """
    Build EnrollmentRequestResponse — the single shape returned by
    get, list, approve, and reject operations.
    """
    return {
        "id": enrollment.id,
        "citizen": _citizen_response(enrollment.citizen),
        "submitted_at": enrollment.submitted_at,
        "reviewed_at": enrollment.reviewed_at,
        "status": enrollment.status,
        "rejection_reason": enrollment.rejection_reason,
        "ro_id": enrollment.ro_id,
        "ro": _ro_summary(enrollment.ro_id),
        "activation_challenge": enrollment.activation_challenge,
        "activation_challenge_expires_at": enrollment.activation_challenge_expires_at,
    }

def _unique_username(base: str) -> str:
    candidate = base
    counter = 1
    while SystemUser.objects.filter(username=candidate).exists():
        candidate = f"{base}{counter}"
        counter += 1
    return candidate

# ─── Phase 1: Account Creation ────────────────────────────────────────────────

def create_account(body: AccountCreateRequest) -> dict:
    """
    Creates an inactive SystemUser and fires an email OTP.
    Guard: reject duplicate emails immediately.
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
        email=body.email,
        password=hash_password(body.password),
        role=UserRole.CITIZEN,
        is_active=False,
        is_email_verified=False,
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
    """Verify the OTP. Delegates all logic to otp_service.verify_otp()."""
    verify_otp(email, raw_otp)
    return {
        "message": "Email verified successfully. You may now log in.",
        "is_email_verified": True,
    }


def resend_otp(email: str) -> dict:
    """Re-issue a fresh OTP for an unverified account."""
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
            detail="This account has already been verified.",
        )

    issue_otp(user)
    return {"message": f"A new OTP has been sent to {email}."}

def ro_create_citizen(body: IdentitySubmitRequest, ro_id: int) -> dict:
    """
    Unified RO-assisted registration endpoint.
    - Bypasses OTP
    - Assigns default password
    - Generates username from NRC
    - Auto-activates account & sets must_change_password flag
    """

    if Citizen.objects.filter(nrc=body.nrc).exists():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Citizen with this NRC already exists.")

    district = District.objects.filter(id=body.district_id, is_active=True).first()
    if not district:
        raise HTTPException(status_code=400, detail="Invalid or inactive district.")

    placeholder_email = f"citizen_{body.nrc}@zamren.com"

    dob = body.dob

    age = (datetime.date.today() - dob).days // 365
    if age < 16: citizen_type = "CHILD_UNDER_16"
    elif age < 18: citizen_type = "CHILD_ABOVE_16"
    elif age >= 60: citizen_type = "SENIOR"
    else: citizen_type = "ADULT"

    username_base = f"citizen_{body.nrc.replace('/', '_')}"
    username = _unique_username(username_base)
    default_password = "password123"
    password_hash = hash_password(default_password)

    with transaction.atomic():
        user = SystemUser.objects.create(
            username=username,
            email=placeholder_email,
            password=password_hash,
            role=UserRole.CITIZEN,
            is_active=True,
            is_email_verified=True,
        )

        citizen = Citizen.objects.create(
            user=user,
            nrc=body.nrc,
            full_name=body.full_name,
            dob=dob,
            phone=body.phone,
            gender=body.gender,
            district=district,
            residential_address=body.residential_address,
            nrc_front_url=body.nrc_front_url,
            nrc_back_url=body.nrc_back_url,
            face_image_url=body.face_image_url,
            public_key=body.public_key,
            language=body.language,
            status=CitizenStatus.PENDING,
            citizen_type=citizen_type,
        )

        user.first_name = citizen.full_name
        user.save(update_fields=["first_name"])

        enrollment = EnrollmentRequest.objects.create(
            citizen=citizen,
            status=EnrollmentStatus.PENDING,
            ro_id=ro_id
        )

        audit.log(
            actor_id=ro_id,
            actor_role=UserRole.REGISTRATION_OFFICER,
            action="RO_ASSISTED_REGISTRATION",
            target_id=citizen.id,
            target_type=UserRole.CITIZEN,
            meta={"nrc": body.nrc, "username": username}
        )

        return {
            "user_id": user.id,
            "citizen_id": citizen.id,
            "enrollment_request_id": enrollment.id,
            "username": username,
            "default_password": default_password,
            "must_change_password": True,
            "message": "Citizen registered successfully. Provide credentials to citizen for first login."
        }



# ─── Phase 2: Identity Submission ─────────────────────────────────────────────

def identity_submission(body: IdentitySubmitRequest, system_user_id: int) -> dict:
    """
    Called from the dashboard once the user is logged in and email-verified.

    Creates:
      • Citizen   (status=PENDING, no DIN — assigned on RO approval)
      • EnrollmentRequest  (status=PENDING)

    Guards:
      • User must be email-verified.
      • User must not already have a DIN (idempotency guard).
      • NRC must be unique.
      • district_id must exist and be active (if provided).
    """

    # ── Fetch user ──
    try:
        system_user = SystemUser.objects.get(id=system_user_id)
    except SystemUser.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="System user not found.",
        )

    # ── Guards ──
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

    # ── Resolve district ──
    district = None
    if body.district_id:
        district = District.objects.filter(id=body.district_id, is_active=True).first()
        if not district:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or inactive district specified.",
            )

    # ── Derive citizen_type from age ──
    age = (datetime.date.today() - body.dob).days // 365
    if age < 16:
        citizen_type = "CHILD_UNDER_16"
    elif age < 18:
        citizen_type = "CHILD_ABOVE_16"
    elif age >= 60:
        citizen_type = "SENIOR"
    else:
        citizen_type = "ADULT"

    with transaction.atomic():
        # 1. Create Citizen record
        citizen = Citizen.objects.create(
            user=system_user,
            nrc=body.nrc,
            full_name=body.full_name,
            dob=body.dob,
            phone=body.phone,
            gender=body.gender,
            district=district,
            residential_address=body.residential_address,
            nrc_front_url=body.nrc_front_url,
            nrc_back_url=body.nrc_back_url,
            face_image_url=body.face_image_url,
            public_key=body.public_key,
            language=body.language,
            status=CitizenStatus.PENDING,
            citizen_type=citizen_type,
        )

        system_user.first_name = citizen.full_name
        system_user.save(update_fields=["first_name"])

        # 2. Create linked EnrollmentRequest
        enrollment_request = EnrollmentRequest.objects.create(
            citizen=citizen,
            status=EnrollmentStatus.PENDING,
        )

        audit.log(
            actor_id=system_user_id,
            actor_role=system_user.role,
            action="NRC_SUBMITTED",
            target_id=citizen.id,
            target_type=UserRole.CITIZEN,
            meta={
                "nrc": body.nrc,
                "enrollment_request": enrollment_request.id,
                "district_id": district.id if district else None,
            },
        )

        logger.info(
            f"enrollment_request={enrollment_request.id}"
        )

        # Send notifications
        send_identity_submitted_email(system_user)
        notify_officers_of_pending_review(citizen.full_name)

        return {
            "enrollment_request_id": enrollment_request.id,
            "citizen_id": citizen.id,
            "message": "Identity submitted. An officer will review your request.",
        }


# ─── Enrollment Request Queries ───────────────────────────────────────────────

def get_all_pending():
    """Retrieves all enrollment requests currently in PENDING status."""
    enrollments = (
        EnrollmentRequest.objects.select_related("citizen")
        .order_by("-submitted_at")
    )
    return [_enrollment_response(e) for e in enrollments]


def get_single_pending(request_id: int):
    """Retrieves a single enrollment request by its primary key."""
    try:
        enrollment = EnrollmentRequest.objects.select_related(
            "citizen"
        ).get(id=request_id)
    except EnrollmentRequest.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment request not found.",
        )
    return _enrollment_response(enrollment)

# ─── Approve ──────────────────────────────────────────────────────────────────

def approve_citizen_registration(request_id: int, ro_id: int) -> dict:
    """
    Approves a citizen enrollment request.
    Generates a unique DIN, atomically marks the request APPROVED,
    and activates the citizen record.
    """
    try:
        enrollment = EnrollmentRequest.objects.select_related("citizen", "citizen__user").get(id=request_id)
    except EnrollmentRequest.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment request not found.",
        )
    valid_statuses = [EnrollmentStatus.REJECTED, EnrollmentStatus.PENDING]

    if enrollment.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Request is not PENDING (current status: {enrollment.status}).",
        )

    citizen = enrollment.citizen
    din = _generate_unique_din()

    activation_challenge = secrets.token_hex(32)
    challenge_expires = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)

    with transaction.atomic():

        # ── Update EnrollmentRequest ──
        enrollment.status = EnrollmentStatus.APPROVED
        enrollment.ro_id = ro_id
        enrollment.reviewed_at = datetime.datetime.now(datetime.timezone.utc)
        enrollment.activation_challenge = activation_challenge
        enrollment.activation_challenge_expires_at = challenge_expires
        enrollment.save()

        # ── Update Citizen ──
        citizen.din = din
        citizen.status = CitizenStatus.ACTIVE
        citizen.activation_nonce = activation_challenge
        citizen.challenge_expires_at = challenge_expires
        citizen.save()

        if citizen.user:
            citizen.user.first_name = citizen.full_name
            citizen.user.save(update_fields=["first_name"])

        audit.log(
            actor_id=ro_id,
            actor_role=UserRole.REGISTRATION_OFFICER,
            action="ENROLLMENT_APPROVED",
            target_id=enrollment.id,
            target_type="ENROLLED",
            meta={"enrollment_request_id": enrollment.id},
        )
        audit.log(
            actor_id=ro_id,
            actor_role=UserRole.REGISTRATION_OFFICER,
            action="DIN_ISSUED",
            target_id=citizen.id,
            target_type="DIN_ISSUED",
            meta={"din": din, "citizen_id": citizen.id, "nrc": citizen.nrc},
        )

        # Send approval email
        if citizen.user:
            logger.info(f"Sending approval email to {citizen.user.email} for DIN {din}")
            send_enrollment_approved_email(citizen.user, din)
        else:
            logger.warning(f"No user linked to citizen {citizen.id}, cannot send approval email.")

        return _enrollment_response(enrollment)

# ─── Reject ───────────────────────────────────────────────────────────────────

def reject_citizen_registration(request_id: int, ro_id: int, rejection_reason: str) -> dict:
    """
    Rejects a citizen enrollment request.
    Atomically marks the request and citizen record as REJECTED.
    """
    reason = (rejection_reason or "").strip()

    if len(reason) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rejection reason must be at least 10 characters.",
        )

    try:
        enrollment = EnrollmentRequest.objects.select_related("citizen", "citizen__user").get(id=request_id)
    except EnrollmentRequest.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment request not found.",
        )

    if enrollment.status != EnrollmentStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PENDING requests can be rejected.",
        )

    citizen = enrollment.citizen

    with transaction.atomic():

        enrollment.status = EnrollmentStatus.REJECTED
        enrollment.ro_id = ro_id
        enrollment.reviewed_at = datetime.datetime.now(datetime.timezone.utc)
        enrollment.rejection_reason = reason
        enrollment.save()

        citizen.status = CitizenStatus.REJECTED
        citizen.save()

        audit.log(
            actor_id=ro_id,
            actor_role=UserRole.REGISTRATION_OFFICER,
            action="ENROLLMENT_REJECTED",
            target_id=enrollment.id,
            target_type="CITIZEN_REGISTRATION",
            meta={
                "enrollment_request_id": enrollment.id,
                "rejection_reason": rejection_reason,
            },
        )

        # Send rejection email
        if citizen.user:
            logger.info(f"Sending rejection email to {citizen.user.email} for request {enrollment.id}")
            send_enrollment_rejected_email(citizen.user, reason)
        else:
            logger.warning(f"No user linked to citizen {citizen.id}, cannot send rejection email.")

        return _enrollment_response(enrollment)

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _unique_username(base: str) -> str:
    """Derive a unique username from the email prefix."""
    candidate = base
    counter = 1
    while SystemUser.objects.filter(username=candidate).exists():
        candidate = f"{base}{counter}"
        counter += 1
    return candidate


def _generate_unique_din(max_attempts: int = 5) -> str:
    """
    Generate a DIN that doesn't already exist in the Citizen table.
    Raises after max_attempts to prevent infinite loops under extreme load.
    """
    for attempt in range(max_attempts):
        candidate = generate_id(uuid4().bytes, "CITIZEN")
        if not Citizen.objects.filter(din=candidate).exists():
            return candidate
        logger.warning(f"DIN collision on attempt {attempt + 1}: {candidate}")

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to generate a unique DIN after multiple attempts. Please retry.",
    )