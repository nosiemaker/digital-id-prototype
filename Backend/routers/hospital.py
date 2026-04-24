from asgiref.sync import sync_to_async
from fastapi import APIRouter, Request
from fastapi.params import Depends
from dependencies.auth import require_groups, UserRole
from hospital.schema import BirthRecordBase,DeathRecordBase,RecordRejection
from hospital.services.birth_death_recording import record_submission, create_death_record,create_birth_record,death_record_approval,death_record_rejection,birth_record_rejection,birth_record_approval,get_all_death_records,get_single_death_record,get_single_birth_record,get_all_births_records,get_single_pending_birth,get_all_pending_births,get_all_pending_deaths,get_single_pending_death
0
birth_router = APIRouter()
death_router = APIRouter()

@birth_router.post("/submit")
async def create_birth_record(body:BirthRecordBase,request:Request, user= Depends(require_groups([UserRole.HEALTH_WORKER]))):
    result = await sync_to_async(record_submission)("birth",body.model_dump(),user_id=user["id"])
    return result

@death_router.post("/submit")
async def create_death_record(body:DeathRecordBase,request:Request, user= Depends(require_groups([UserRole.HEALTH_WORKER]))):
    result = await sync_to_async(record_submission)("death",body.model_dump(),user_id=user["id"])
    return result

@birth_router.get("/pending_submissions")
async def get_all_pending_submissions(request:Request, user= Depends(require_groups([UserRole.REGISTRATION_OFFICER, UserRole.SUPERVISOR]))):
    result = await sync_to_async(get_all_pending_births)()
    return result

@death_router.get("/pending_submissions")
async def get_all_pending_submissions(request:Request, user= Depends(require_groups([UserRole.REGISTRATION_OFFICER, UserRole.SUPERVISOR]))):
    result = await sync_to_async(get_all_pending_deaths)()
    return result

@death_router.get("/record/{record_id}")
async def get_death_record(record_id : int,request:Request, user= Depends(require_groups([UserRole.REGISTRATION_OFFICER, UserRole.SUPERVISOR,UserRole.CITIZEN]))):
    result = await sync_to_async(get_single_death_record)(record_id)
    return result

@death_router.get("/submission/{record_id}")
async def get_pending_death_record(record_id : int,request:Request, user= Depends(require_groups([UserRole.REGISTRATION_OFFICER, UserRole.SUPERVISOR,UserRole.CITIZEN]))):
    result = await sync_to_async(get_single_pending_death)(record_id)
    return result

@birth_router.get("/record/{record_id}")
async def get_birth_record(record_id : int,request:Request, user= Depends(require_groups([UserRole.REGISTRATION_OFFICER, UserRole.SUPERVISOR,UserRole.CITIZEN]))):
    result = await sync_to_async(get_single_birth_record)(record_id)
    return result

@birth_router.get("/submission/{record_id}")
async def get_pending_birth_record(record_id : int,request:Request, user= Depends(require_groups([UserRole.REGISTRATION_OFFICER, UserRole.SUPERVISOR,UserRole.CITIZEN]))):
    result = await sync_to_async(get_single_pending_birth)(record_id)
    return result

@birth_router.put("/{submission_id}/reject_submission")
async def reject(submission_id: int, request: Request,body:RecordRejection ,user= Depends(require_groups([UserRole.REGISTRATION_OFFICER]))):
    result =await sync_to_async(birth_record_rejection)(submission_id, user["id"], body.rejection_reason )
    return result

@birth_router.put("/{submission_id}/approve_submission")
async def approval(submission_id: int, request: Request,user= Depends(require_groups([UserRole.REGISTRATION_OFFICER]))):
    result = await sync_to_async(birth_record_approval)(submission_id, user["id"])
    return result

@death_router.put("/{submission_id}/reject_submission")
async def reject(submission_id: int, request: Request,body:RecordRejection,user= Depends(require_groups([UserRole.REGISTRATION_OFFICER]))):
    result = await sync_to_async(death_record_rejection)(submission_id, user["id"], body.rejection_reason )
    return result

@death_router.put("/{submission_id}/approve_submission")
async def approval(submission_id: int, request: Request,user= Depends(require_groups([UserRole.REGISTRATION_OFFICER]))):
    result = await sync_to_async(death_record_approval)(submission_id, user["id"])
    return result



