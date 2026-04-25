# birth_death_recording.py
# Service layer handling the creation, submission, approval, and rejection
# of birth and death records within the civil registration system.

import datetime
from django.db import transaction
from fastapi import HTTPException
from Utils.audit_logger import audit
from citizens.models import Citizen, CitizenStatus
from citizens.serializer import CitizenSerializer
from citizens.utilities.id_generation import generate_id, child_seed_generation
from hospital.models import BirthRecord, DeathRecord, DeathRecordSubmissions, BirthRecordSubmissions, RecordStatus
from hospital.serializers import DeathRecordSerializer,BirthRecordSerializer,DeathRecordRequestSerializer,BirthRecordRequestSerializer
from rest_framework import status

# Routes a record submission to the correct handler (birth or death)
# based on the record_type string, then creates the submission request
# and logs an audit entry.
def record_submission(record_type:str,request_body:dict,user_id:int):
    if record_type == "death":
        # Validate and persist the death record data
        partial_death_record = create_death_record(request_body)
        # If create_death_record returned an error dict, bubble it up directly
        if type(partial_death_record) == dict :
            return partial_death_record
        # Build the submission request linking the record to the submitting health worker
        new_request = {
            "record": partial_death_record.id,
            "health_worker": user_id
        }
        request_serializer = DeathRecordRequestSerializer(data=new_request)
        if request_serializer.is_valid():
            request_serializer.save()
            # Log the submission event for audit trail
            audit.death_record_submitted(user_id,request_serializer.data.id)
            return {"details": "Request Submitted","created_request": request_serializer.data ,"status": status.HTTP_201_CREATED}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=request_serializer.errors,
            )

    elif record_type == "birth":
        # Validate and persist the birth record data
        partial_birth_record = create_birth_record(request_body)
        # If create_birth_record returned an error dict, bubble it up directly
        if type(partial_birth_record) == dict:
            return partial_birth_record
        # Build the submission request linking the record to the submitting health worker
        new_birth_request = {
            "record": partial_birth_record.id,
            "health_worker": user_id
        }
        birth_request_serializer = BirthRecordRequestSerializer(data=new_birth_request)
        if birth_request_serializer.is_valid():
            birth_request_serializer.save()
            # Log the submission event for audit trail
            audit.birth_record_submitted(user_id, birth_request_serializer.data.id)
            return {"details": "Request Submitted", "created_request": birth_request_serializer.data,
                    "status": status.HTTP_201_CREATED}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=birth_request_serializer.errors,
            )

    else:
        # record_type is neither "birth" nor "death" — reject the request
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Request",
        )


# Validates and saves a new death record using the DeathRecordSerializer.
# Returns the saved record instance on success, raises HTTPException on failure.
def create_death_record (request_body: dict):
    serializer = DeathRecordSerializer(data=request_body)
    if serializer.is_valid():
        record = serializer.save()
        return record
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=serializer.errors,
        )


# Validates and saves a new birth record using the BirthRecordSerializer.
# Returns the saved record instance on success, raises HTTPException on failure.
def create_birth_record (request_body: dict):
    serializer = BirthRecordSerializer(data=request_body)
    if serializer.is_valid():
        record = serializer.save()
        return record
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=serializer.errors,
        )


# Approves a pending death record submission.
# Validates that the submission exists and is still pending, verifies the
# deceased citizen exists in the registry and has no prior death certificate,
# then atomically updates the submission status, the record status, and
# marks the citizen as DECEASED.
def death_record_approval(request_id:int, ro_id: int) -> dict:
    try:
        # Fetch the submission along with the related record in a single query
        submission_request = (DeathRecordSubmissions.objects.select_related("record").get(id = request_id))
    except DeathRecordSubmissions.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request Not Found",
        )

    # Guard: only PENDING submissions can be approved
    if submission_request.status != RecordStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Request is not pending",
        )
    record = submission_request.record

    # Verify the deceased citizen exists in the system before approving
    try:
        citizen_to_update = Citizen.objects.get(din=record.deceased_din)
    except Citizen.DoesNotExist:
        # Auto-reject the submission and delete the orphaned record if the citizen is not found
        details = death_record_rejection(request_id, ro_id, "Citizen ID not found")
        record.delete()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=details,
        )

    # Prevent duplicate death certificates for the same citizen
    try:
        record_check = DeathRecord.objects.get(deceased_din=record.deceased_din)
    except DeathRecord.DoesNotExist:
        # No existing certificate — safe to proceed
        pass
    else:
        # A certificate already exists; auto-reject and clean up
        details = death_record_rejection(request_id, ro_id, "Certificate Already Exists")
        record.delete()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=details,
        )

    # Atomically update the submission, the record, and the citizen status
    with transaction.atomic():
        # Mark the submission request as APPROVED with reviewer details
        record_submission_serializer = DeathRecordRequestSerializer(
            instance=submission_request,
            data={
                "status": RecordStatus.APPROVED,
                "ro": ro_id,
                "reviewed_at": datetime.datetime.now()
            },
            partial=True
        )

        if not record_submission_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=record_submission_serializer.errors,
            )

        record_submission_serializer.save()

        # Update the death record with the resolved citizen DIN and approved status
        record_serializer = DeathRecordSerializer(
            instance=record,
            data={
                "deceased": citizen_to_update.din,
                "status": RecordStatus.APPROVED,
            },
            partial=True
        )

        if not record_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=record_serializer.errors,
            )

        record_serializer.save()

        # Update the citizen's status to DECEASED in the citizens registry
        citizen_serializer = CitizenSerializer(
            instance=citizen_to_update,
            data={
                "status": CitizenStatus.DECEASED,
            },
            partial=True

        )
        if not citizen_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=citizen_serializer.errors,
            )
        citizen_serializer.save()
        # Log the approval for audit trail
        audit.death_record_approved(ro_id, record_serializer.data.id)
        return {"details": "Approval Successful","request": record_serializer.data ,"status": status.HTTP_200_OK}

# Rejects a pending death record submission.
# Validates that the submission exists and is still pending, then atomically
# updates both the submission and the underlying record to REJECTED status,
# capturing the rejection reason and reviewer details.
def death_record_rejection(request_id: int, ro_id: int, rejection_reason:str) -> dict :

    try:
        # Fetch the submission along with the related record in a single query
        submission_request = (DeathRecordSubmissions.objects.select_related("record").get(id = request_id))
    except DeathRecordSubmissions.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record Request Not Found",
        )

    # Guard: only PENDING submissions can be rejected
    if submission_request.status != RecordStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Request is not pending",
        )

    record = submission_request.record

    # Atomically update the submission and the record to REJECTED
    with transaction.atomic():

        # Mark the submission as REJECTED with reviewer details and rejection reason
        record_submission_serializer = DeathRecordRequestSerializer(
            instance=submission_request,
            data={
                "status": RecordStatus.REJECTED,
                "ro": ro_id,
                "reviewed_at": datetime.datetime.now(),
                "rejection_reason": rejection_reason,
            },
            partial=True
        )

        if not record_submission_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=record_submission_serializer.errors,
            )

        record_submission_serializer.save()

        # Mark the underlying death record as REJECTED
        record_serializer = DeathRecordSerializer(
            instance=record,
            data={
                "status": RecordStatus.REJECTED,
            },
            partial=True
        )

        if not record_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=record_serializer.errors,
            )

        record_serializer.save()

        return {"details": "Request Rejected",
                "request": record_submission_serializer.data,
                "status": status.HTTP_200_OK}

# Approves a pending birth record submission.
# Validates the submission exists and is still pending, verifies the mother
# exists in the citizen registry, generates a unique DIN for the child,
# checks for duplicate birth certificates, then atomically updates the
# submission, the record, and creates a new INACTIVE citizen entry for the child.
def birth_record_approval(request_id:int, ro_id: int) -> dict:
    try:
        # Fetch the submission along with the related record in a single query
        submission_request = (BirthRecordSubmissions.objects.select_related("record").get(id = request_id))
    except BirthRecordSubmissions.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record Request Not Found",
        )

    # Guard: only PENDING submissions can be approved
    if submission_request.status != RecordStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Request is not pending",
        )


    record = submission_request.record

    # Verify the mother exists in the citizens registry before proceeding
    try:
        mother = Citizen.objects.get(din = record.mother_din)
    except Citizen.DoesNotExist:
        # Auto-reject and clean up if the mother's DIN cannot be resolved
        details = birth_record_rejection(request_id, ro_id, "Mother ID Not Found")
        record.delete()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=details,
        )

    # Generate a deterministic child DIN derived from child details and mother's DIN
    child_id = generate_id(
        child_seed_generation(record.child_full_name, record.child_dob, record.born_at, record.mother_din), "CITIZEN")

    # Prevent duplicate birth certificates for the same child
    try:
        child_check = BirthRecord.objects.get(child_din=child_id)
    except BirthRecord.DoesNotExist:
        # No existing certificate — safe to proceed
        pass
    else:
        # A certificate already exists; auto-reject and clean up
        details=birth_record_rejection(request_id, ro_id, "Certificate Already Exists")
        record.delete()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=details,
        )

    # Atomically update the submission, the record, and create the child citizen entry
    with transaction.atomic():
        # Mark the submission request as APPROVED with reviewer details
        record_submission_serializer = BirthRecordRequestSerializer(
            instance=submission_request,
            data={
                "status": RecordStatus.APPROVED,
                "ro": ro_id,
                "reviewed_at": datetime.datetime.now()
            },
            partial=True
        )

        if not record_submission_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=record_submission_serializer.errors,
            )

        record_submission_serializer.save()

        # Update the birth record with the generated child DIN, resolved mother DIN,
        # approved status, and creation timestamp
        record_serializer = BirthRecordSerializer(
            instance=record,
            data={
                "child_din": child_id,
                "mother": mother.din,
                "status": RecordStatus.APPROVED,
                "created_at": datetime.datetime.now()
            },
            partial=True
        )

        if not record_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=record_serializer.errors,
            )

        record_serializer.save()

        # Create a new citizen record for the child with INACTIVE status;
        # the child will need to go through full citizen registration to become ACTIVE
        citizen_serializer = CitizenSerializer(
            data={
                "din": child_id,
                "full_name": record.child_full_name,
                "dob": record.child_dob,
                "status": CitizenStatus.INACTIVE,
            },
        )

        if not citizen_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=citizen_serializer.errors,
            )
        citizen_serializer.save()
        # Log the approval for audit trail
        audit.birth_record_approved(ro_id,record_serializer.data.id)
        return {"details": "Approval Successful","request": record_serializer.data ,"status": status.HTTP_200_OK}

# Rejects a pending birth record submission.
# Validates the submission exists and is still pending, then atomically
# updates both the submission and the underlying record to REJECTED status,
# capturing the rejection reason and reviewer details.
def birth_record_rejection(request_id: int, ro_id: int, rejection_reason:str) -> dict :
    try:
        # Fetch the submission along with the related record in a single query
        submission_request = (BirthRecordSubmissions.objects.select_related("record").get(id = request_id))
    except BirthRecordSubmissions.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record Request Not Found",
        )

    # Guard: only PENDING submissions can be rejected
    if submission_request.status != RecordStatus.PENDING:
        raise HTTPException(
            status_code= status.HTTP_409_CONFLICT,
            detail="Request is not pending",
        )
    record = submission_request.record

    # Atomically update the submission and the record to REJECTED
    with transaction.atomic():

        # Mark the submission as REJECTED with reviewer details and rejection reason
        record_submission_serializer = BirthRecordRequestSerializer(
            instance=submission_request,
            data={
                "status": RecordStatus.REJECTED,
                "ro": ro_id,
                "reviewed_at": datetime.datetime.now(),
                "rejection_reason": rejection_reason,
            },
            partial=True
        )

        if not record_submission_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=record_submission_serializer.errors,
            )

        record_submission_serializer.save()

        # Mark the underlying birth record as REJECTED
        record_serializer = BirthRecordSerializer(
            instance=record,
            data={
                "status": RecordStatus.REJECTED,
            },
            partial=True
        )

        if not record_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=record_serializer.errors,
            )

        record_serializer.save()
        return {"details": "Request Rejected",
                "request": record_submission_serializer.data,
                "status": status.HTTP_200_OK}

# Retrieves all birth record submissions that are currently in PENDING status.
# Returns a labelled dict indicating whether any submissions were found.
def get_all_pending_births():
    pending_submissions = BirthRecordSubmissions.objects.filter(status=RecordStatus.PENDING)
    serializer = BirthRecordRequestSerializer(pending_submissions, many=True)
    if serializer.data:
        return {"details": "Submission Found", "pending_submissions": serializer.data}
    else:
        return {"details": "No Submissions Found", "pending_submissions": serializer.data}

# Retrieves all death record submissions that are currently in PENDING status.
# Returns a labelled dict indicating whether any submissions were found.
def get_all_pending_deaths():
    pending_submissions = DeathRecordSubmissions.objects.filter(status=RecordStatus.PENDING)
    serializer = DeathRecordRequestSerializer(pending_submissions, many=True)
    if serializer.data:
        return {"details": "Submission Found", "pending_submissions": serializer.data}
    else:
        return {"details": "No Submissions Found", "pending_submissions": serializer.data}

# Retrieves a single pending birth record submission by its ID.
# Raises 404 if the submission does not exist.
def get_single_pending_birth(request_id: int):
    try:
        pending_submission = BirthRecordSubmissions.objects.get(id=request_id).firtst()
    except BirthRecordSubmissions.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission Does Not Exist",
        )
    serializer = BirthRecordRequestSerializer(pending_submission)
    return {"details": "Submission Found", "pending_submission": serializer.data}

# Retrieves a single pending death record submission by its ID.
# Raises 404 if the submission does not exist.
def get_single_pending_death(request_id: int):
    try:
        pending_submission = DeathRecordSubmissions.objects.get(id=request_id).firtst()
    except DeathRecordSubmissions.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission Does Not Exist",
        )
    serializer = DeathRecordRequestSerializer(pending_submission)
    return {"details": "Submissions Found", "pending_submission": serializer.data}

# Retrieves a single approved birth record by its ID.
# Raises 404 if the record does not exist.
def get_single_birth_record(request_id: int):
    try:
        record = BirthRecord.objects.get(id=request_id).firtst()
    except BirthRecord.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record Does Not Exist",
        )
    serializer = BirthRecordSerializer(record)
    return {"details": "Record Found", "record": serializer.data}

# Retrieves a single approved death record by its ID.
# Raises 404 if the record does not exist.
def get_single_death_record(request_id: int):
    try:
        record = DeathRecord.objects.get(id=request_id)
    except DeathRecord.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record Does Not Exist",
        )
    serializer = DeathRecordSerializer(record)
    return {"details": "Record Found","record": serializer.data}

# Retrieves all birth records in the system regardless of status.
# Returns a labelled dict indicating whether any records were found.
def get_all_births_records():
    records = BirthRecord.objects.all()
    serializer = BirthRecordSerializer(records, many=True)
    if serializer.data:
        return {"details": "Records Found", "records": serializer.data}
    else:
        return {"details": "No Records Found", "records": serializer.data}

# Retrieves all death records in the system regardless of status.
# Returns a labelled dict indicating whether any records were found.
def get_all_death_records():
    records = DeathRecord.objects.all()
    serializer = DeathRecordSerializer(records, many=True)
    if serializer.data:
        return {"details": "Records Found", "records": serializer.data}
    else:
        return {"details": "No Records Found", "records": serializer.data}
