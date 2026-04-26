# hospital.py (Router)
# Defines the API endpoints for birth and death record management.
# Split into two sub-routers: birth_router and death_router.
# Health Workers submit records; Registration Officers and Supervisors
# review pending submissions; Citizens can view approved records.

from asgiref.sync import sync_to_async
from fastapi import APIRouter, Request
from fastapi.params import Depends
from dependencies.auth import require_groups, UserRole
from hospital.schema import BirthRecordBase,DeathRecordBase,RecordRejection
from hospital.services.birth_death_recording import record_submission, create_death_record,create_birth_record,death_record_approval,death_record_rejection,birth_record_rejection,birth_record_approval,get_all_death_records,get_single_death_record,get_single_birth_record,get_all_births_records,get_single_pending_birth,get_all_pending_births,get_all_pending_deaths,get_single_pending_death

birth_router = APIRouter()
death_router = APIRouter()

# Submits a new birth record for review.
# Only accessible to users with the HEALTH_WORKER role.
@birth_router.post("/submit")
async def create_birth_record(body:BirthRecordBase,request:Request, user= Depends(require_groups(["HEALTH_WORKER", "RO", "SUPERVISOR"]))):
    result = await sync_to_async(record_submission)("birth",body.model_dump(),user_id=user["id"])
    return result

# Submits a new death record for review.
# Only accessible to users with the HEALTH_WORKER role.
@death_router.post("/submit")
async def create_death_record(body:DeathRecordBase,request:Request, user= Depends(require_groups(["HEALTH_WORKER", "RO", "SUPERVISOR"]))):
    result = await sync_to_async(record_submission)("death",body.model_dump(),user_id=user["id"])
    return result

@birth_router.get("/pending_submissions")
async def get_all_pending_submissions(request:Request, user= Depends(require_groups(["RO", "SUPERVISOR"]))):
    result = await sync_to_async(get_all_pending_births)()
    return result

# Returns all death record submissions currently in PENDING status.
# Accessible to REGISTRATION_OFFICER and SUPERVISOR roles.
@death_router.get("/pending_submissions")
async def get_all_pending_submissions(request:Request, user= Depends(require_groups(["RO", "SUPERVISOR"]))):
    result = await sync_to_async(get_all_pending_deaths)()
    return result

# Returns an approved death record by its record ID.
# Accessible to REGISTRATION_OFFICER, SUPERVISOR, and CITIZEN roles.
@death_router.get("/record/{record_id}")
async def get_death_record(record_id : int,request:Request, user= Depends(require_groups(["RO", "SUPERVISOR","CITIZEN"]))):
    result = await sync_to_async(get_single_death_record)(record_id)
    return result

# Returns a single pending death record submission by its submission ID.
# Accessible to REGISTRATION_OFFICER, SUPERVISOR, and CITIZEN roles.
@death_router.get("/submission/{record_id}")
async def get_pending_death_record(record_id : int,request:Request, user= Depends(require_groups(["RO", "SUPERVISOR","CITIZEN"]))):
    result = await sync_to_async(get_single_pending_death)(record_id)
    return result

# Returns an approved birth record by its record ID.
# Accessible to REGISTRATION_OFFICER, SUPERVISOR, and CITIZEN roles.
@birth_router.get("/record/{record_id}")
async def get_birth_record(record_id : int,request:Request, user= Depends(require_groups(["RO", "SUPERVISOR","CITIZEN"]))):
    result = await sync_to_async(get_single_birth_record)(record_id)
    return result

# Returns a single pending birth record submission by its submission ID.
# Accessible to REGISTRATION_OFFICER, SUPERVISOR, and CITIZEN roles.
@birth_router.get("/submission/{record_id}")
async def get_pending_birth_record(record_id : int,request:Request, user= Depends(require_groups(["RO", "SUPERVISOR","CITIZEN"]))):
    result = await sync_to_async(get_single_pending_birth)(record_id)
    return result

# Rejects a pending birth record submission by its submission ID.
# Requires a rejection reason in the request body.
# Only accessible to users with the REGISTRATION_OFFICER role.
@birth_router.put("/{submission_id}/reject_submission")
async def reject(submission_id: int, request: Request,body:RecordRejection ,user= Depends(require_groups(["RO"]))):
    result =await sync_to_async(birth_record_rejection)(submission_id, user["id"], body.rejection_reason )
    return result

# Approves a pending birth record submission by its submission ID.
# Only accessible to users with the REGISTRATION_OFFICER role.
@birth_router.put("/{submission_id}/approve_submission")
async def approval(submission_id: int, request: Request,user= Depends(require_groups(["RO"]))):
    result = await sync_to_async(birth_record_approval)(submission_id, user["id"])
    return result

# Rejects a pending death record submission by its submission ID.
# Requires a rejection reason in the request body.
# Only accessible to users with the REGISTRATION_OFFICER role.
@death_router.put("/{submission_id}/reject_submission")
async def reject(submission_id: int, request: Request,body:RecordRejection,user= Depends(require_groups(["RO"]))):
    result = await sync_to_async(death_record_rejection)(submission_id, user["id"], body.rejection_reason )
    return result

# Approves a pending death record submission by its submission ID.
# Only accessible to users with the REGISTRATION_OFFICER role.
@death_router.put("/{submission_id}/approve_submission")
async def approval(submission_id: int, request: Request,user= Depends(require_groups(["RO"]))):
    result = await sync_to_async(death_record_approval)(submission_id, user["id"])
    return result
