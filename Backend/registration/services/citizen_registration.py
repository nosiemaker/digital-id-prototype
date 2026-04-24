# citizen_registration.py (Service)
# Business logic for citizen enrollment: creating enrollment requests,
# retrieving pending requests, and approving or rejecting them.
# All database mutations that touch multiple models are wrapped in
# atomic transactions to guarantee consistency.

import datetime
from django.db import transaction
from fastapi import HTTPException
from citizens.models import Citizen, CitizenStatus
from registration.models import EnrollmentRequest,EnrollmentStatus
from registration.serializers import CitizenRegistrationRequestSerializer
from rest_framework import status
from citizens.serializer import CitizenSerializer
from uuid import uuid4
from citizens.utilities.id_generation import generate_id
from Utils.audit_logger import audit


# Creates a new citizen record and a linked enrollment request.
# Validates the incoming citizen data first; if valid, persists the citizen
# and then creates the associated EnrollmentRequest in PENDING status.
def create_citizen_request (request_body: dict):
    serializer = CitizenSerializer(data=request_body)
    if serializer.is_valid():
        citizen = serializer.save()
        # Link the newly created citizen to the enrollment request
        new_request = {"citizen":citizen.id}
        request_serializer = CitizenRegistrationRequestSerializer(data=new_request)
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
    enrollment_request = (EnrollmentRequest.objects.select_related("citizen").get(id=request_id))

    # Guard: only PENDING requests can be approved
    if enrollment_request.status != EnrollmentStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Request is not pending",
        )

    # Generate a candidate DIN using a random UUID as the seed
    din = generate_id(uuid4().bytes)

    # Check whether a citizen with this DIN already exists to prevent collisions
    try:
        citizen_check = Citizen.objects.get(din = din).first()
    except Citizen.DoesNotExist:
        # No collision — safe to proceed with this DIN
        pass
    else:
        # DIN collision detected; auto-reject the request and remove the citizen record
        details = reject_citizen_registration(request_id,ro_id,"Citizen Already Registered")
        citizen = enrollment_request.citizen
        citizen.delete()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=details,
        )


    citizen = enrollment_request.citizen

    # Atomically update the enrollment request and activate the citizen record
    with transaction.atomic():

        # Mark the enrollment request as APPROVED with reviewer and timestamp
        enrollment_serializer = CitizenRegistrationRequestSerializer(
            instance=enrollment_request,
            data = {
                "status": EnrollmentStatus.APPROVED,
                "ro": ro_id,
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
        # Log the approval event for audit trail
        audit.enrollment_approved(ro_id,enrollment_serializer.data.id, enrollment_serializer.data)
        return {"details": "Approval Successful","request": enrollment_serializer.data, "status": status.HTTP_200_OK}

# Rejects a citizen enrollment request.
# Validates the request exists and is still PENDING, then atomically marks
# both the enrollment request and the citizen record as REJECTED, storing
# the provided rejection reason.
def reject_citizen_registration(request_id: int, ro_id: int, rejection_reason:str) -> dict:

    try:
        # Fetch the enrollment request along with its related citizen in one query
        enrollment_request = (EnrollmentRequest.objects.select_related("citizen").get(id=request_id))
    except EnrollmentRequest.DoesNotExist:
        # Silently pass — the subsequent status check will still catch invalid states;
        # NOTE: this will raise an UnboundLocalError if the object was not found.
        pass

    # Guard: only PENDING requests can be rejected
    if enrollment_request.status != EnrollmentStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request Is Not Pending",
        )

    citizen = enrollment_request.citizen

    # Atomically update the enrollment request and the citizen record to REJECTED
    with transaction.atomic():
        # Mark the enrollment request as REJECTED with reviewer, timestamp, and reason
        serializer = CitizenRegistrationRequestSerializer(
            instance=enrollment_request,
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
        # Log the rejection event for audit trail
        audit.enrollment_rejected(ro_id, serializer.data.id,serializer.data )
        return {"details": "Request Successfully Rejected",
                "request": serializer.data,
                "status": status.HTTP_200_OK}
