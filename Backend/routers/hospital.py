# hospital.py — FastAPI Router
#
# Defines the HTTP API for birth and death record management within the
# civil registration system. Split into two sub-routers:
#
#   birth_router  — mounted at (e.g.) /hospital/births/
#   death_router  — mounted at (e.g.) /hospital/deaths/
#
# Role-based access control is enforced on every endpoint via require_groups():
#   HEALTH_WORKER — submits new records
#   REGISTRAR     — reviews pending submissions, approves, rejects, and reads all records
#   CITIZEN       — retrieves their own approved certificates / permits
#
# All service functions are synchronous Django ORM calls wrapped in sync_to_async
# so they can be safely awaited inside FastAPI's async event loop.

from asgiref.sync import sync_to_async
from fastapi import APIRouter, Request
from fastapi.params import Depends
from dependencies.auth import require_groups, UserRole
from Backend.hospital.schema import (
    BirthRecordSubmission,
    MedicalCertificateCauseOfDeathCreate,
    NoticeOfDeathCreate,
    RecordRejection,
)
from Backend.hospital.services.birth_death_recording import (
    record_submission,
    death_record_approval,
    death_record_rejection,
    birth_record_rejection,
    birth_record_approval,
    get_all_death_records,
    get_single_death_record,
    get_single_birth_record,
    get_all_births_records,
    get_single_pending_birth,
    get_all_pending_births,
    get_all_pending_deaths,
    get_single_pending_death,
    submit_notice_of_death,
    get_birth_certificates_by_user,
    get_burial_permits_by_user,
    get_death_certificates_by_user,
)

birth_router = APIRouter()
death_router = APIRouter()


# ============================================================================
# BIRTH RECORD ENDPOINTS
# ============================================================================

@birth_router.post("/submit")
async def submit_birth_record(
    body: BirthRecordSubmission,
    request: Request,
    user=Depends(require_groups([UserRole.HEALTH_WORKER])),
):
    """
    POST /births/submit

    Submit a new birth record for review.

    Accepts a unified payload (BirthRecordSubmission) that combines:
        - Notice of Birth (Form VIII)
        - Record of Birth (M.F.2)

    The service layer creates both sub-documents and a BirthRecords tracker
    in PENDING status, then logs the submission via the audit service.

    Access: HEALTH_WORKER only.

    Returns: birth_records_id, notice_of_birth_id, record_of_birth_id, HTTP 201.
    """
    result = await sync_to_async(record_submission)(
        "birth", body.model_dump(), user_id=user["id"]
    )
    return result


@birth_router.get("/pending_submissions")
async def get_pending_birth_submissions(
    request: Request,
    user=Depends(require_groups([UserRole.REGISTRAR])),
):
    """
    GET /births/pending_submissions

    List all birth record submissions that are awaiting RO review (status=PENDING).

    Used to populate the Registrar Officer's work queue. Returns an empty list
    when no pending submissions exist.

    Access: REGISTRAR only.
    """
    result = await sync_to_async(get_all_pending_births)()
    return result


@birth_router.get("/submission/{submission_id}")
async def get_pending_birth_submission(
    submission_id: int,
    request: Request,
    user=Depends(require_groups([UserRole.REGISTRAR])),
):
    """
    GET /births/submission/{submission_id}

    Retrieve the detail of a single birth submission by its BirthRecords PK.

    Used when an RO opens a specific submission to review its full content
    before making an approval or rejection decision.

    Access: REGISTRAR only.

    Raises: 404 if the submission does not exist.
    """
    result = await sync_to_async(get_single_pending_birth)(submission_id)
    return result


@birth_router.get("/record/{record_id}")
async def get_birth_record(
    record_id: int,
    request: Request,
    user=Depends(require_groups([UserRole.REGISTRAR])),
):
    """
    GET /births/record/{record_id}

    Retrieve a single birth record by its BirthRecords PK (any status).

    Intended for RO audit views and admin lookups where the record may
    already be APPROVED or REJECTED (not just PENDING).

    Access: REGISTRAR only.

    Raises: 404 if the record does not exist.
    """
    result = await sync_to_async(get_single_birth_record)(record_id)
    return result


@birth_router.get("/all")
async def get_all_birth_records(
    request: Request,
    user=Depends(require_groups([UserRole.REGISTRAR])),
):
    """
    GET /births/all

    Return all birth record submissions regardless of status.

    Used for administrative overviews and reporting dashboards.

    Access: REGISTRAR only.
    """
    result = await sync_to_async(get_all_births_records)()
    return result


@birth_router.put("/{submission_id}/approve")
async def approve_birth_record(
    submission_id: int,
    request: Request,
    user=Depends(require_groups([UserRole.REGISTRAR])),
):
    """
    PUT /births/{submission_id}/approve

    Approve a pending birth record submission.

    On success the service layer:
        1. Creates a BirthCertificate from the linked NoticeOfBirth and RecordOfBirth.
        2. Creates an INACTIVE Citizen record for the child with the generated DIN.
        3. Updates the BirthRecords status to APPROVED.
        4. Emits an audit event.

    Access: REGISTRAR only.

    Raises:
        404 — Submission or registrar not found.
        409 — Submission is not PENDING, or duplicate certificate detected.
        400 — Required sub-documents missing.
    """
    result = await sync_to_async(birth_record_approval)(submission_id, user["id"])
    return result


@birth_router.put("/{submission_id}/reject")
async def reject_birth_record(
    submission_id: int,
    body: RecordRejection,
    request: Request,
    user=Depends(require_groups(["RO"])),
):
    """
    PUT /births/{submission_id}/reject

    Reject a pending birth record submission.

    The rejection_reason (minimum 10 chars) is stored on the BirthRecords entry
    and remains visible to the submitting Health Worker.

    Note: this endpoint uses the raw group string "RO" rather than UserRole.REGISTRAR —
    ensure the auth dependency maps this correctly to the intended role.

    Access: RO group only.

    Raises:
        404 — Submission not found.
        409 — Submission is not PENDING.
    """
    result = await sync_to_async(birth_record_rejection)(
        submission_id, user["id"], body.rejection_reason
    )
    return result


# ============================================================================
# DEATH RECORD ENDPOINTS
# ============================================================================

@death_router.post("/submit")
async def submit_death_record(
    body: MedicalCertificateCauseOfDeathCreate,
    request: Request,
    user=Depends(require_groups([UserRole.HEALTH_WORKER])),
):
    """
    POST /deaths/submit

    Submit a Medical Certificate of Cause of Death (MCCD).

    This is Step 1 of the death-registration pipeline. Creates:
        - A MedicalCertificateCauseOfDeath record.
        - A DeathRecords tracker in PENDING status (ready_for_review=False).

    The informant must then submit the Notice of Death via the endpoint below
    before the RO can process the case.

    Access: HEALTH_WORKER only.

    Returns: death_records_id, mccd_id, HTTP 201.
    """
    result = await sync_to_async(record_submission)(
        "death", body.model_dump(), user_id=user["id"]
    )
    return result


@death_router.post("/submit/{death_record_id}/notice_of_death")
async def submit_notice_of_death_endpoint(
    death_record_id: int,
    body: NoticeOfDeathCreate,
    request: Request,
    user=Depends(require_groups([UserRole.HEALTH_WORKER, UserRole.CITIZEN])),
):
    """
    POST /deaths/submit/{death_record_id}/notice_of_death

    Attach a Notice of Death (DNRPC form) to an existing death record.

    This is Step 2 of the death-registration pipeline. The authenticated user
    must be the informant recorded on the original MCCD submission.

    On success:
        - Creates a NoticeOfDeath record.
        - Links it to the DeathRecords entry.
        - Sets ready_for_review = True, making the case visible to the RO queue.

    Access: HEALTH_WORKER or CITIZEN (must be the informant on the MCCD).

    Raises:
        404 — DeathRecords not found or user not found.
        400 — Informant mismatch, Notice already attached, or validation errors.

    Returns: death_records_id, notice_of_death_id, HTTP 200.
    """
    result = await sync_to_async(submit_notice_of_death)(
        body.model_dump(), death_record_id, citizen_id=user["id"]
    )
    return result


@death_router.get("/pending_submissions")
async def get_pending_death_submissions(
    request: Request,
    user=Depends(require_groups([UserRole.REGISTRAR])),
):
    """
    GET /deaths/pending_submissions

    List all death record submissions awaiting RO review (status=PENDING).

    Access: REGISTRAR only.
    """
    result = await sync_to_async(get_all_pending_deaths)()
    return result


@death_router.get("/submission/{submission_id}")
async def get_pending_death_submission(
    submission_id: int,
    request: Request,
    user=Depends(require_groups([UserRole.REGISTRAR])),
):
    """
    GET /deaths/submission/{submission_id}

    Retrieve a single death submission by its DeathRecords PK.

    Used when an RO opens a specific submission to review before deciding.

    Access: REGISTRAR only.

    Raises: 404 if the submission does not exist.
    """
    result = await sync_to_async(get_single_pending_death)(submission_id)
    return result


@death_router.get("/record/{record_id}")
async def get_death_record(
    record_id: int,
    request: Request,
    user=Depends(require_groups([UserRole.REGISTRAR])),
):
    """
    GET /deaths/record/{record_id}

    Retrieve a single death record by its DeathRecords PK (any status).

    For audit views and admin lookups.

    Access: REGISTRAR only.

    Raises: 404 if the record does not exist.
    """
    result = await sync_to_async(get_single_death_record)(record_id)
    return result


@death_router.get("/all")
async def get_all_death_records_endpoint(
    request: Request,
    user=Depends(require_groups([UserRole.REGISTRAR])),
):
    """
    GET /deaths/all

    Return all death record submissions regardless of status.

    Access: REGISTRAR only.
    """
    result = await sync_to_async(get_all_death_records)()
    return result


@death_router.put("/{submission_id}/approve")
async def approve_death_record(
    submission_id: int,
    request: Request,
    user=Depends(require_groups([UserRole.REGISTRAR])),
):
    """
    PUT /deaths/{submission_id}/approve

    Approve a pending death record submission.

    On success the service layer:
        1. Generates a Death Certificate from the Notice of Death + MCCD.
        2. Generates a Burial Permit (Form XI).
        3. Links both to the DeathRecords entry and sets status = APPROVED.
        4. If the deceased has a DIN, updates their Citizen status to DECEASED.
        5. Emits an audit event.

    Access: REGISTRAR only.

    Raises:
        404 — Submission not found.
        409 — Submission is not PENDING.
        400 — Notice of Death not yet attached, or serialiser validation errors.
    """
    result = await sync_to_async(death_record_approval)(submission_id, user["id"])
    return result


@death_router.put("/{submission_id}/reject")
async def reject_death_record(
    submission_id: int,
    body: RecordRejection,
    request: Request,
    user=Depends(require_groups([UserRole.REGISTRAR])),
):
    """
    PUT /deaths/{submission_id}/reject

    Reject a pending death record submission.

    The rejection_reason is stored on the DeathRecords entry.

    Access: REGISTRAR only.

    Raises:
        404 — Submission not found.
        409 — Submission is not PENDING.
    """
    result = await sync_to_async(death_record_rejection)(
        submission_id, user["id"], body.rejection_reason
    )
    return result


# ============================================================================
# CITIZEN SELF-SERVICE — Certificate Retrieval
# ============================================================================

@birth_router.get("/my_certificates")
async def get_my_birth_certificates(
    request: Request,
    user=Depends(require_groups([UserRole.CITIZEN])),
):
    """
    GET /births/my_certificates

    Return all birth certificates where the authenticated Citizen is
    listed as either the mother or the father.

    Access: CITIZEN only.

    Returns: List of BirthCertificate records (or empty list).
    """
    result = await sync_to_async(get_birth_certificates_by_user)(user["id"])
    return result


@death_router.get("/my_burial_permits")
async def get_my_burial_permits(
    request: Request,
    user=Depends(require_groups([UserRole.CITIZEN])),
):
    """
    GET /deaths/my_burial_permits

    Return all burial permits associated with death registrations where
    the authenticated Citizen is the informant.

    Only returns permits from fully-approved submissions (i.e. those that
    have a linked BurialPermit record).

    Access: CITIZEN only.

    Returns: List of BurialPermit records (or empty list).
    """
    result = await sync_to_async(get_burial_permits_by_user)(user["id"])
    return result


@death_router.get("/my_certificates")
async def get_my_death_certificates(
    request: Request,
    user=Depends(require_groups([UserRole.CITIZEN])),
):
    """
    GET /deaths/my_certificates

    Return all death certificates associated with death registrations where
    the authenticated Citizen is the informant.

    Only returns certificates from fully-approved submissions (i.e. those that
    have a linked DeathCertificate record).

    Access: CITIZEN only.

    Returns: List of DeathCertificate records (or empty list).
    """
    result = await sync_to_async(get_death_certificates_by_user)(user["id"])
    return result