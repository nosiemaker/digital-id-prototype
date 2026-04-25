# user_management.py
# Service layer for system user and third-party institution management.
# Handles creation and activation of system users, third-party institution
# enrollment requests, and role/permission management for existing users.

import datetime
from django.db import transaction
from fastapi import HTTPException
from Utils.audit_logger import audit
from admin_ops.models import SystemUser,ThirdPartyEnrollmentRequest
from Utils.auth import hash_password
from rest_framework import status
from admin_ops.serializers import SystemUserSerializer, ThirdPartyInstitutionSerializer,ThirdPartyEnrollmentRequestSerializer
import secrets ,string
from citizens.serializer import CitizenSerializer
from citizens.utilities.id_generation import generate_id
from dependencies.auth import UserRole
from kyc.models import ThirdPartyInstitution, InstitutionStatus
from registration.models import EnrollmentStatus


# Creates a new system user record after checking for duplicate DINs.
# Validates the request body through SystemUserSerializer before persisting.
def create_system_user(request_body: dict) -> dict:
    citizen_din = request_body.get("din")
    # Guard: prevent duplicate system users tied to the same citizen DIN
    if SystemUser.objects.filter(citizen_din=citizen_din).exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this Digital ID already exists",
        )
    user_serializer = SystemUserSerializer(data=request_body)

    if not user_serializer.is_valid():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=user_serializer.errors,
        )
    user_serializer.save()
    return {
        "details": "User created successfully",
        "user": user_serializer.data,
        "status": status.HTTP_201_CREATED
    }

# Retrieves a system user by their citizen DIN.
# Raises 404 if no matching user is found.
def get_user_by_din(din: str) -> dict:
    try:
        user = SystemUser.objects.get(citizen_din=din)
    except SystemUser.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user_serializer = SystemUserSerializer(user)

    return {"details": "User found","user": user_serializer.data}

# Retrieves a system user by their email address.
# Raises 404 if no matching user is found.
def get_user_by_email(email: str) -> dict:
    try:
        user = SystemUser.objects.get(email=email)
    except SystemUser.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user_serializer = SystemUserSerializer(user)

    return {"details": "User found", "user": user_serializer.data}

# Initiates the account activation flow for a system user identified by DIN.
# Guards against activating an already-active account, then generates a
# 6-digit OTP token to be used in the password-setting step.
# NOTE: The token is currently returned directly in the response; in production
# it should be delivered via a secure out-of-band channel (e.g. SMS or email).
def activate_system_user(user_din: str) -> dict:
    try:
        user = SystemUser.objects.get(citizen_din=user_din)
    except SystemUser.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user_serializer = SystemUserSerializer(user)

    # Guard: skip activation if the user is already active
    if user_serializer.data["is_active"] == True:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already active",
        )

    # Generate a cryptographically secure 6-digit numeric OTP
    token = ''.join(secrets.choice(string.digits) for _ in range(6))

    return {"token": token}

# Completes the account activation by setting the user's password and
# marking them as active. Looks up the user by citizen DIN from the request body,
# hashes the provided password, then persists both fields via the serializer.
def set_system_user_password(request_body: dict) -> dict:
    try:
        user = SystemUser.objects.get(citizen_din=request_body.get("citizen_din"))
    except SystemUser.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user_serializer = SystemUserSerializer(
        instance=user,
        data = {
            "is_active": True,
            # Hash the plain-text password before storing
            "password_hash": hash_password(request_body.get("password"))
        }
    )

    if not user_serializer.is_valid():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=user_serializer.errors,
        )

    user_serializer.save()

    return {"details": "User Successfully Activated"}

# Submits a new third-party institution enrollment request.
# Validates and persists the institution data, then creates a linked
# ThirdPartyEnrollmentRequest in PENDING status.
def third_party_registration_request (request_body: dict):

    serializer = ThirdPartyInstitutionSerializer(data=request_body)
    if serializer.is_valid():
        third_party = serializer.save()
        # Link the newly created institution to the enrollment request
        new_request = {"third_party_institution": third_party.id}
        request_serializer = ThirdPartyEnrollmentRequestSerializer(data=new_request)
        if request_serializer.is_valid():
            request_serializer.save()
            return {"details": "Request Submitted","request":request_serializer.data ,"status": status.HTTP_201_CREATED }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=request_serializer.errors,
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=serializer.errors,
        )

# Approves a pending third-party institution enrollment request.
# Generates a unique institution ID from the registration number, checks for
# duplicates, then atomically marks the enrollment request as APPROVED,
# activates the institution with the granted scope, and creates a system user
# account for the institution.
def approve_third_party_registration(request_id: int, registrar_id:int, permitted_scope:list) -> dict:
    # Fetch the enrollment request along with its related institution in one query
    enrollment_request = (ThirdPartyEnrollmentRequest.objects.select_related("third_party_institution").get(id=request_id))

    # Guard: only PENDING requests can be approved
    if enrollment_request.status != EnrollmentStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Request is not pending",
        )
    third_party = enrollment_request.third_party_institution

    # Serialize the institution temporarily to access its registration number
    third_party_serializer_temp = ThirdPartyInstitutionSerializer(third_party)

    # Generate a deterministic institution ID from the registration number and type prefix
    institution_id = generate_id(third_party_serializer_temp.data.get("reg_number"),"THIRD_PARTY")

    # Check whether an institution with this ID already exists to prevent collisions
    try:
        third_party_check = ThirdPartyInstitution.objects.filter(institution_id = institution_id).first()
    except ThirdPartyInstitution.DoesNotExist:
        # No collision — safe to proceed with this institution ID
        pass
    else:
        # ID collision detected; auto-reject and clean up the orphaned institution record
        details = reject_third_party_registration(request_id,registrar_id,"Institution Already Registered")
        third_party.delete()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=details,
        )

    # Atomically update the enrollment request and activate the institution record
    with transaction.atomic():
        # Mark the enrollment request as APPROVED with reviewer and timestamp
        enrollment_serializer = ThirdPartyEnrollmentRequestSerializer(
            instance=enrollment_request,
            data = {
                "status": EnrollmentStatus.APPROVED,
                "registrar": registrar_id,
                "reviewed_at": datetime.datetime.now()
            },
            partial =True
        )

        if not enrollment_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=enrollment_serializer.errors,
            )

        enrollment_serializer.save()

        # Assign the generated institution ID, set status to ACTIVE, and store permitted scope
        third_party_serializer = ThirdPartyInstitutionSerializer(
            instance=third_party,
            data = {
                "institution_id": institution_id,
                "enrolled_by": registrar_id,
                "status": InstitutionStatus.ACTIVE,
                "permitted_scope": permitted_scope
            },
            partial=True
        )

        if not third_party_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=third_party_serializer.errors,
            )

        third_party_serializer.save()

        # Create a system user account for the institution so it can authenticate with the platform
        create_system_user({
            "role": UserRole.THIRD_PARTY,
            "email": third_party.email,
            "name": third_party.full_name,
            "institution_id": third_party.institution_id

        })
        # Log the approval event for audit trail
        audit.third_party_enrollment_approved(registrar_id,enrollment_serializer.data['id'], enrollment_serializer.data)
        return {"details": "Approval Successful","request": enrollment_serializer.data, "status": status.HTTP_200_OK}

# Rejects a pending third-party institution enrollment request.
# Validates the request exists and is still PENDING, then atomically marks
# both the enrollment request and the institution record as REJECTED,
# capturing the rejection reason and reviewer details.
def reject_third_party_registration(request_id: int, registrar_id : int, rejection_reason:str) -> dict:

    try:
        # Fetch the enrollment request along with its related institution in one query
        enrollment_request = (ThirdPartyEnrollmentRequest.objects.select_related("third_party_institution").get(id=request_id))
    except ThirdPartyEnrollmentRequest.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request Is Not Found",
        )
    # Guard: only PENDING requests can be rejected
    if enrollment_request.status != EnrollmentStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request Is Not Pending",
        )

    third_party = enrollment_request.third_party_institution

    # Atomically update the enrollment request and the institution record to REJECTED
    with transaction.atomic():
        # Mark the enrollment request as REJECTED with reviewer, timestamp, and reason
        serializer = ThirdPartyEnrollmentRequestSerializer(
            instance=enrollment_request,
            data={
                "status": EnrollmentStatus.REJECTED,
                "registrar": registrar_id,
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

        # Set the institution's status to REJECTED to reflect the failed enrollment
        third_party_serializer = ThirdPartyInstitutionSerializer(
            instance=third_party,
            data={
                "status": InstitutionStatus.REJECTED,
            },
            partial=True
        )

        if not third_party_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=third_party_serializer.errors,
            )

        third_party_serializer.save()
        # Log the rejection event for audit trail
        audit.third_party_enrollment_rejected(registrar_id, serializer.data['id'],serializer.data )
        return {"details": "Request Successfully Rejected",
                "request": serializer.data,
                "status": status.HTTP_200_OK}

# Retrieves a single third-party enrollment request by its primary key.
# Note: Does not filter by status — returns requests in any state.
def get_single_pending(request_id: int):
    pending_enrollment = ThirdPartyEnrollmentRequest.objects.get(id=request_id)
    serializer = ThirdPartyEnrollmentRequestSerializer(pending_enrollment)
    return serializer.data

# Retrieves all third-party enrollment requests currently in PENDING status.
def get_all_pending():
    pending_enrollments = ThirdPartyEnrollmentRequest.objects.filter(status=EnrollmentStatus.PENDING)
    serializer = ThirdPartyEnrollmentRequestSerializer(pending_enrollments, many=True)
    return serializer.data

# Adds a new role to an existing system user's permission set.
# Fetches the current roles, appends the new role, and persists the updated
# comma-separated role string via the serializer.
def add_user_permissions(user_id: int,request_body:dict):

    try:
        system_user = SystemUser.objects.get(citizen_din= request_body['citizen_din'])
        # Fetch the current serialized user data to read existing roles
        temp_serializer =SystemUserSerializer(system_user)
    except SystemUser.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Citizen Not Found",
        )

    # Convert the current role string to a list so the new role can be appended
    old_perms= list(temp_serializer.data.role)

    old_perms.append(request_body["role"])

    # Rejoin the updated roles into a comma-separated string for storage
    updated_perms = ','.join(old_perms)

    serializer = SystemUserSerializer(
        instance=system_user,
        data= {
            "role": updated_perms
        },
        partial=True
    )

    if not serializer.is_valid():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=serializer.errors,
        )
    serializer.save()

    return {"details": "Roles Successfully Updated"}

# Removes a specific role from an existing system user's permission set.
# Fetches current roles, filters out the role to be removed, checks it
# actually existed, then persists the updated role string.
# NOTE: The existence check occurs after the filtered list is already built,
# meaning the role is removed before the guard runs — consider reordering.
def remove_user_permissions(user_id:int,request_body:dict):

    try:
        # NOTE: "citize_din" appears to be a typo — should likely be "citizen_din"
        system_user = SystemUser.objects.get(citizen_din= request_body['citizen_din'])
        # Fetch the current serialized user data to read existing roles
        temp_serializer =SystemUserSerializer(system_user)
    except SystemUser.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Citizen Not Found",
        )

    # Convert the current role string to a list for filtering
    old_perms= list(temp_serializer.data.role)
    updated_perms = []

    # Build a new list excluding the role to be removed
    for perm in old_perms:
        if perm != request_body.role:
            updated_perms.append(perm)

    # Rejoin the updated roles into a comma-separated string for storage
    perms = ','.join(updated_perms)

    # Guard: raise an error if the role being removed was never assigned
    # NOTE: This check runs after the list has already been filtered above
    if request_body.get("role") not in old_perms:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Citizen Already Does Not Have That Permission",
        )

    serializer = SystemUserSerializer(
        instance=system_user,
        data= {
            "role": perms
        },
        partial=True
    )

    if not serializer.is_valid():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=serializer.errors,
        )

    serializer.save()

    return {"details": "Roles Successfully Updated"}
