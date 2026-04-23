import datetime
from django.db import transaction
from citizens.models import Citizen, CitizenStatus
from citizens.serializer import CitizenSerializer
from citizens.utilities.id_generation import generate_id, child_seed_generation
from hospital.models import BirthRecord, DeathRecord, DeathRecordSubmissions, BirthRecordSubmissions, RecordStatus
from hospital.serializers import DeathRecordSerializer,BirthRecordSerializer,DeathRecordRequestSerializer,BirthRecordRequestSerializer
from rest_framework import status

def record_submission(record_type:str,request_body:dict,user_id:int):
    if record_type == "death":
        partial_death_record = create_death_record(request_body)
        if type(partial_death_record) == dict :
            return partial_death_record
        new_request = {
            "record": partial_death_record.id,
            "health_worker": user_id
        }
        request_serializer = DeathRecordRequestSerializer(data=new_request)
        if request_serializer.is_valid():
            request_serializer.save()
            return {"details": "Request Submitted","created_request": request_serializer.data ,"status": status.HTTP_201_CREATED}
        else:
            return {"details": request_serializer.errors, "created_request": None,"status": status.HTTP_400_BAD_REQUEST}
    elif record_type == "birth":
        partial_birth_record = create_birth_record(request_body)
        if type(partial_birth_record) == dict:
            return partial_birth_record
        new_birth_request = {
            "record": partial_birth_record.id,
            "health_worker": user_id
        }
        birth_request_serializer = BirthRecordRequestSerializer(data=new_birth_request)
        if birth_request_serializer.is_valid():
            birth_request_serializer.save()
            return {"details": "Request Submitted", "created_request": birth_request_serializer.data,
                    "status": status.HTTP_201_CREATED}
        else:
            return {"details": birth_request_serializer.errors, "created_request": None,
                    "status": status.HTTP_400_BAD_REQUEST}
    else:
        return{"details": "Invalid Request", "status": status.HTTP_400_BAD_REQUEST}

def create_death_record (request_body: dict):
    serializer = DeathRecordSerializer(data=request_body)
    if serializer.is_valid():
        record = serializer.save()
        return record
    else:
        return {"details": serializer.errors, "status": status.HTTP_400_BAD_REQUEST}

def create_birth_record (request_body: dict):
    serializer = BirthRecordSerializer(data=request_body)
    if serializer.is_valid():
        record = serializer.save()
        return record
    else:
        return {"details": serializer.errors, "status": status.HTTP_400_BAD_REQUEST}

def death_record_approval(request_id:int, ro_id: int) -> dict:
    try:
        submission_request = (DeathRecordSubmissions.objects.select_related("record").get(id = request_id))
    except DeathRecordSubmissions.DoesNotExist:
        return {"details": "Request Not Found", "status": status.HTTP_404_NOT_FOUND}

    if submission_request.status != RecordStatus.PENDING:
        return {"details": "Request is not pending", "status": status.HTTP_409_CONFLICT}
    record = submission_request.record

    try:
        citizen_to_update = Citizen.objects.get(din=record.deceased_din)
    except Citizen.DoesNotExist:
        record.delete()
        return {"details": "Citizen ID not found", "status": status.HTTP_400_BAD_REQUEST}

    try:
        record_check = DeathRecord.objects.get(deceased_din=record.deceased_din)
    except Citizen.DoesNotExist:
        record.delete()
        return {"details": "Certificate Already Exists", "status": status.HTTP_409_CONFLICT}

    with transaction.atomic():
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
            return {"details": record_submission_serializer.errors, "status": status.HTTP_400_BAD_REQUEST}

        record_submission_serializer.save()

        record_serializer = DeathRecordSerializer(
            instance=record,
            data={
                "deceased": citizen_to_update.din,
                "status": RecordStatus.APPROVED,
            },
            partial=True
        )

        if not record_serializer.is_valid():
            return {"details": record_serializer.errors, "status": status.HTTP_400_BAD_REQUEST}

        record_serializer.save()

        citizen_serializer = CitizenSerializer(
            instance=citizen_to_update,
            data={
                "status": CitizenStatus.DECEASED,
            },
            partial=True

        )
        if not citizen_serializer.is_valid():
            return {"details": citizen_serializer.errors, "status": status.HTTP_400_BAD_REQUEST}
        citizen_serializer.save()

        return {"details": "Approval Successful","request": record_serializer.data ,"status": status.HTTP_200_OK}

def death_record_rejection(request_id: int, ro_id: int, rejection_reason:str) -> dict :

    try:
        submission_request = (DeathRecordSubmissions.objects.select_related("record").get(id = request_id))
    except DeathRecordSubmissions.DoesNotExist:
        return {"details": "Record Request Not Found", "status": status.HTTP_404_NOT_FOUND}

    if submission_request.status != RecordStatus.PENDING:
        return {"details": "Request is not pending", "status": status.HTTP_409_CONFLICT}
    record = submission_request.record

    with transaction.atomic():

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
            return {"details": record_submission_serializer.errors, "status": status.HTTP_400_BAD_REQUEST}

        record_submission_serializer.save()

        record_serializer = DeathRecordSerializer(
            instance=record,
            data={
                "status": RecordStatus.REJECTED,
            },
            partial=True
        )

        if not record_serializer.is_valid():
            return {"details": record_serializer.errors, "status": status.HTTP_400_BAD_REQUEST}

        record_serializer.save()

        return {"details": "Request Successfully Rejected",
                "request": record_submission_serializer.data,
                "status": status.HTTP_200_OK}

def birth_record_approval(request_id:int, ro_id: int) -> dict:
    try:
        submission_request = (BirthRecordSubmissions.objects.select_related("record").get(id = request_id))
    except BirthRecordSubmissions.DoesNotExist:
        return {"details": "Record Request Not Found", "status": status.HTTP_404_NOT_FOUND}
    if submission_request.status != RecordStatus.PENDING:
        return {"details": "Request is not pending", "status": status.HTTP_409_CONFLICT}

    record = submission_request.record

    try:
        mother = Citizen.objects.get(din = record.mother_din)
    except Citizen.DoesNotExist:
        record.delete()
        return {"details": "Citizen ID not found", "status": status.HTTP_400_BAD_REQUEST}

    child_id = generate_id(
        child_seed_generation(record.child_full_name, record.child_dob, record.born_at, record.mother_din))

    try:
        child_check = BirthRecord.objects.get(child_din=child_id)
    except BirthRecord.DoesNotExist:
        pass
    else:
        details=birth_record_rejection(request_id, ro_id, "Certificate Already Exists")
        record.delete()
        return {"details": "Certificate Already Exists","request":details,"status": status.HTTP_409_CONFLICT}

    with transaction.atomic():
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
            return {"details": record_submission_serializer.errors, "status": status.HTTP_400_BAD_REQUEST}

        record_submission_serializer.save()

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
            return {"details": record_serializer.errors, "status": status.HTTP_400_BAD_REQUEST}

        record_serializer.save()

        citizen_serializer = CitizenSerializer(
            data={
                "din": child_id,
                "full_name": record.child_full_name,
                "dob": record.child_dob,
                "status": CitizenStatus.INACTIVE,
            },
        )

        if not citizen_serializer.is_valid():
            return {"details": citizen_serializer.errors, "status": status.HTTP_400_BAD_REQUEST}
        citizen_serializer.save()

        return {"details": "Approval Successful","request": record_serializer.data ,"status": status.HTTP_200_OK}

def birth_record_rejection(request_id: int, ro_id: int, rejection_reason:str) -> dict :
    try:
        submission_request = (BirthRecordSubmissions.objects.select_related("record").get(id = request_id))
    except BirthRecordSubmissions.DoesNotExist:
        return {"details": "Record Request Not Found", "status": status.HTTP_404_NOT_FOUND}

    if submission_request.status != RecordStatus.PENDING:
        return {"details": "Request is not pending", "status": status.HTTP_409_CONFLICT}
    record = submission_request.record

    with transaction.atomic():

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
            return {"details": record_submission_serializer.errors, "status": status.HTTP_400_BAD_REQUEST}

        updated_request = record_submission_serializer.save()

        record_serializer = BirthRecordSerializer(
            instance=record,
            data={
                "status": RecordStatus.REJECTED,
            },
            partial=True
        )

        if not record_serializer.is_valid():
            return {"details": record_serializer.errors, "status": status.HTTP_400_BAD_REQUEST}

        record_serializer.save()

        return {"details": "Request Successfully Rejected",
                "request": record_submission_serializer.data,
                "status": status.HTTP_200_OK}

def get_all_pending_births():
    pending_submissions = BirthRecordSubmissions.objects.filter(status=RecordStatus.PENDING)
    serializer = BirthRecordRequestSerializer(pending_submissions, many=True)
    if serializer.data:
        return {"details": "Submission Found", "pending_submissions": serializer.data}
    else:
        return {"details": "No Submissions Found", "pending_submissions": serializer.data}

def get_all_pending_deaths():
    pending_submissions = DeathRecordSubmissions.objects.filter(status=RecordStatus.PENDING)
    serializer = DeathRecordRequestSerializer(pending_submissions, many=True)
    if serializer.data:
        return {"details": "Submission Found", "pending_submissions": serializer.data}
    else:
        return {"details": "No Submissions Found", "pending_submissions": serializer.data}

def get_single_pending_birth(request_id: int):
    try:
        pending_submission = BirthRecordSubmissions.objects.get(id=request_id).firtst()
    except BirthRecordSubmissions.DoesNotExist:
        return {"details": "Record Does Not Exist", "record": None}
    serializer = BirthRecordRequestSerializer(pending_submission)
    return {"details": "Submission Found", "pending_submission": serializer.data}

def get_single_pending_death(request_id: int):
    try:
        pending_submission = DeathRecordSubmissions.objects.get(id=request_id).firtst()
    except DeathRecordSubmissions.DoesNotExist:
        return {"details": "Record Does Not Exist", "record": None}
    serializer = DeathRecordRequestSerializer(pending_submission)
    return {"details": "Submissions Found", "pending_submission": serializer.data}

def get_single_birth_record(request_id: int):
    try:
        record = BirthRecord.objects.get(id=request_id).firtst()
    except BirthRecord.DoesNotExist:
        return {"details": "Record Does Not Exist", "record": None}
    serializer = BirthRecordSerializer(record)
    return {"details": "Record Found", "record": serializer.data}

def get_single_death_record(request_id: int):
    try:
        record = DeathRecord.objects.get(id=request_id).firtst()
    except DeathRecord.DoesNotExist:
        return {"details":"Record Does Not Exist", "record": None}
    serializer = DeathRecordSerializer(record)
    return {"details": "Record Found","record": serializer.data}

def get_all_births_records():
    records = BirthRecord.objects.all()
    serializer = BirthRecordSerializer(records, many=True)
    if serializer.data:
        return {"details": "Records Found", "records": serializer.data}
    else:
        return {"details": "No Records Found", "records": serializer.data}

def get_all_death_records():
    records = DeathRecord.objects.all()
    serializer = DeathRecordSerializer(records, many=True)
    if serializer.data:
        return {"details": "Records Found", "records": serializer.data}
    else:
        return {"details": "No Records Found", "records": serializer.data}