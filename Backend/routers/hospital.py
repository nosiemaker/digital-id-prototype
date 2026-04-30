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
from fastapi.responses import StreamingResponse
import os
import io
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
    review_birth_record,
    view_birth_certificate,
    review_death_documents,
    view_death_certificates,
    review_all_approved_death_documents,
    review_all_approved_birth_documents,
    get_all_approved_births_records,
    get_all_approved_death_records,
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


@birth_router.get("/all/approved")
async def get_all_approved_birth_records(
    request: Request,
    user=Depends(require_groups([UserRole.REGISTRAR])),
):
    """
    GET /births/all/approved

    Return only APPROVED birth record submissions.

    Filters the BirthRecords table to return submissions that have successfully
    passed Registrar review. Each approved record has an associated
    BirthCertificate, Notice of Birth, and Record of Birth.

    This endpoint is intended for:
        - Administrative dashboards showing completed registrations.
        - Auditing and statistical reporting on approved births.
        - Populating UI lists where the Registrar or Citizen can then drill
          into a specific record to retrieve the full document pack.

    Access: REGISTRAR only.

    Returns:
        200 — Dict with "details" message and "records" list (may be empty).
    """
    result = await sync_to_async(get_all_approved_births_records)()
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


@birth_router.get("/{birth_records_id}/review")
async def review_birth_submission(
    birth_records_id: int,
    request: Request,
    user=Depends(require_groups([UserRole.REGISTRAR])),
):
    """
    GET /births/{birth_records_id}/review

    Fetches a BirthRecords entry, validates that both NoticeOfBirth and
    RecordOfBirth are attached, generates PDFs for each document, and
    streams both back as a multipart/form-data response.

    If either document is missing, returns a 400 error listing what's missing.

    Access: REGISTRAR only.

    Raises:
        404 — BirthRecords not found.
        400 — Missing NoticeOfBirth or RecordOfBirth.
    """
    result = await sync_to_async(review_birth_record)(birth_records_id)

    notice_pdf = result["notice_of_birth_pdf"]
    record_pdf = result["record_of_birth_pdf"]

    if not os.path.exists(notice_pdf):
        return {"error": "Notice of Birth PDF generation failed"}
    if not os.path.exists(record_pdf):
        return {"error": "Record of Birth PDF generation failed"}

    with open(notice_pdf, "rb") as f1, open(record_pdf, "rb") as f2:
        notice_data = f1.read()
        record_data = f2.read()

    boundary = "birth-review-boundary"
    body = io.BytesIO()

    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="notice_of_birth"; filename="notice_of_birth.pdf"\r\n')
    body.write(b"Content-Type: application/pdf\r\n\r\n")
    body.write(notice_data)
    body.write(b"\r\n")

    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="record_of_birth"; filename="record_of_birth.pdf"\r\n')
    body.write(b"Content-Type: application/pdf\r\n\r\n")
    body.write(record_data)
    body.write(b"\r\n")

    body.write(f"--{boundary}--\r\n".encode())
    body.seek(0)

    return StreamingResponse(
        body,
        media_type=f"multipart/form-data; boundary={boundary}",
    )


@birth_router.get("/{birth_records_id}/view/certificate")
async def view_birth_certificate_endpoint(
    birth_records_id: int,
    request: Request,
    user=Depends(require_groups([UserRole.REGISTRAR,UserRole.CITIZEN])),
):
    """
    GET /births/{birth_records_id}/review/certificate

    Fetches a BirthRecords entry with its linked BirthCertificate,
    validates it exists, generates the Birth Certificate PDF, and
    streams it back as an application/pdf response.

    If the certificate has not been generated yet, returns a 400 error.

    Access: REGISTRAR only.

    Raises:
        404 — BirthRecords not found.
        400 — BirthCertificate not yet generated (record not approved).
    """
    result = await sync_to_async(view_birth_certificate)(birth_records_id)

    cert_pdf = result["birth_certificate_pdf"]

    if not os.path.exists(cert_pdf):
        return {"error": "Birth Certificate PDF generation failed"}

    with open(cert_pdf, "rb") as f:
        cert_data = f.read()

    return StreamingResponse(
        io.BytesIO(cert_data),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="birth_certificate_{birth_records_id}.pdf"'},
    )


@birth_router.get("/{birth_records_id}/review/full_pack")
async def review_all_approved_birth_documents_endpoint(
    birth_records_id: int,
    request: Request,
    user=Depends(require_groups([UserRole.REGISTRAR, UserRole.HEALTH_WORKER])),
):
    """
    GET /births/{birth_records_id}/review/full_pack

    Fetches an APPROVED BirthRecords entry and streams all three
    birth pipeline documents as a single multipart/form-data response:
        1. Birth Certificate    — filename: birth_certificate.pdf
        2. Notice of Birth      — filename: notice_of_birth.pdf
        3. Record of Birth      — filename: record_of_birth.pdf

    This is the comprehensive document retrieval endpoint for fully approved
    birth records. It generates all three official PDFs on-demand from the
    stored model data and delivers them in a single HTTP response.

    Document provenance:
        - Notice of Birth (Form VIII) and Record of Birth (M.F.2) are created
          during the submission phase by the Health Worker and reviewed by the
          Registrar before approval.
        - Birth Certificate (Reg-Gen Form No. IV) is generated at approval time
          from the data in the Notice of Birth and Record of Birth.

    The response uses multipart/form-data with a custom boundary
    ("birth-full-pack-boundary"). Each part includes:
        - Content-Disposition with the document name and suggested filename.
        - Content-Type: application/pdf.

    The frontend should parse the multipart response using a library such as
    `form-data` or `busboy` (Node.js) or `email.message` (Python) to extract
    each PDF part by its name field.

    Use cases:
        - Registrar downloading the complete birth case file for archival.
        - Parent (Citizen) retrieving all birth-related documents in one request.
        - Audit/compliance officers requesting the full document set.

    Access: REGISTRAR or CITIZEN.

    Raises:
        404 — BirthRecords not found.
        409 — Submission is not APPROVED (the full pack requires the
              Birth Certificate, which only exists after approval).
        400 — Missing any of the three required documents (lists which
              ones in the error detail).
    """
    result = await sync_to_async(review_all_approved_birth_documents)(birth_records_id)

    cert_pdf = result["birth_certificate_pdf"]
    notice_pdf = result["notice_of_birth_pdf"]
    record_pdf = result["record_of_birth_pdf"]

    for path, name in [(cert_pdf, "Birth Certificate"), (notice_pdf, "Notice of Birth"), (record_pdf, "Record of Birth")]:
        if not os.path.exists(path):
            return {"error": f"{name} PDF generation failed"}

    with open(cert_pdf, "rb") as f1, open(notice_pdf, "rb") as f2, open(record_pdf, "rb") as f3:
        cert_data = f1.read()
        notice_data = f2.read()
        record_data = f3.read()

    boundary = "birth-full-pack-boundary"
    body = io.BytesIO()

    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="birth_certificate"; filename="birth_certificate.pdf"\r\n')
    body.write(b"Content-Type: application/pdf\r\n\r\n")
    body.write(cert_data)
    body.write(b"\r\n")

    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="notice_of_birth"; filename="notice_of_birth.pdf"\r\n')
    body.write(b"Content-Type: application/pdf\r\n\r\n")
    body.write(notice_data)
    body.write(b"\r\n")

    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="record_of_birth"; filename="record_of_birth.pdf"\r\n')
    body.write(b"Content-Type: application/pdf\r\n\r\n")
    body.write(record_data)
    body.write(b"\r\n")

    body.write(f"--{boundary}--\r\n".encode())
    body.seek(0)

    return StreamingResponse(
        body,
        media_type=f"multipart/form-data; boundary={boundary}",
    )


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


@death_router.get("/all/approved")
async def get_all_approved_death_records_endpoint(
    request: Request,
    user=Depends(require_groups([UserRole.REGISTRAR])),
):
    """
    GET /deaths/all/approved

    Return only APPROVED death record submissions.

    Filters the DeathRecords table to return submissions that have successfully
    passed Registrar review. Each approved record has an associated
    DeathCertificate, Burial Permit, Notice of Death, and Medical Certificate
    of Cause of Death (MCCD).

    This endpoint is intended for:
        - Administrative dashboards showing completed death registrations.
        - Auditing and statistical reporting on approved deaths.
        - Populating UI lists where the Registrar or Citizen can then drill
          into a specific record to retrieve the full document pack.

    Access: REGISTRAR only.

    Returns:
        200 — Dict with "details" message and "records" list (may be empty).
    """
    result = await sync_to_async(get_all_approved_death_records)()
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


@death_router.get("/{death_records_id}/view")
async def view_death_submission(
    death_records_id: int,
    request: Request,
    user=Depends(require_groups([UserRole.REGISTRAR])),
):
    """
    GET /deaths/{death_records_id}/view

    Fetches a DeathRecords entry, validates that both MCCD and
    NoticeOfDeath are attached, generates PDFs for each document on-demand,
    and streams both back as a multipart/form-data response.

    This endpoint is used by the Registrar during the pre-approval review
    phase. It retrieves the two documents that exist at submission time:
        1. Medical Certificate of Cause of Death (MCCD) — submitted by the
           Health Worker in Step 1 of the death registration pipeline.
        2. Notice of Death (DNRPC Form) — submitted by the informant in
           Step 2; contains deceased particulars, informant details, and
           police/coroner fields for non-natural deaths.

    These documents are NOT pre-generated and stored as files. Instead,
    the PDFs are generated on-demand from the model data each time this
    endpoint is called, ensuring the output always reflects the latest
    stored data.

    The response uses multipart/form-data with two parts:
        1. "mccd"            — filename: mccd.pdf
        2. "notice_of_death" — filename: notice_of_death.pdf

    The frontend should parse the multipart response and handle each PDF
    part separately (e.g., display side-by-side in a review UI).

    This endpoint is distinct from the post-approval endpoints:
        - /view/certificates — retrieves Death Certificate + Burial Permit
          (only available after approval).
        - /review/full_pack  — retrieves all four documents (only available
          after approval).

    Access: REGISTRAR only.

    Raises:
        404 — DeathRecords not found.
        400 — Missing MCCD or NoticeOfDeath (the case cannot be reviewed
              until both documents are attached).
    """
    result = await sync_to_async(review_death_documents)(death_records_id)

    mccd_pdf = result["mccd_pdf"]
    notice_pdf = result["notice_of_death_pdf"]

    if not os.path.exists(mccd_pdf):
        return {"error": "MCCD PDF generation failed"}
    if not os.path.exists(notice_pdf):
        return {"error": "Notice of Death PDF generation failed"}

    with open(mccd_pdf, "rb") as f1, open(notice_pdf, "rb") as f2:
        mccd_data = f1.read()
        notice_data = f2.read()

    boundary = "death-review-boundary"
    body = io.BytesIO()

    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="mccd"; filename="mccd.pdf"\r\n')
    body.write(b"Content-Type: application/pdf\r\n\r\n")
    body.write(mccd_data)
    body.write(b"\r\n")

    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="notice_of_death"; filename="notice_of_death.pdf"\r\n')
    body.write(b"Content-Type: application/pdf\r\n\r\n")
    body.write(notice_data)
    body.write(b"\r\n")

    body.write(f"--{boundary}--\r\n".encode())
    body.seek(0)

    return StreamingResponse(
        body,
        media_type=f"multipart/form-data; boundary={boundary}",
    )


@death_router.get("/{death_records_id}/view/certificates")
async def view_death_certificates(
    death_records_id: int,
    request: Request,
    user=Depends(require_groups([UserRole.REGISTRAR, UserRole.CITIZEN])),
):
    """
    GET /deaths/{death_records_id}/view/certificates

    Fetches an APPROVED DeathRecords entry, validates that both
    DeathCertificate and BurialPermit are attached, generates PDFs
    on-demand, and streams both back as a multipart/form-data response.

    This endpoint retrieves the two post-approval documents that are
    generated during the Registrar's approval step:
        - Death Certificate — the legal proof of death issued by the
          Registrar-General, derived from the Notice of Death and MCCD.
        - Burial Permit (Form XI) — authorises burial or other disposal
          of the body, derived from the Notice of Death.

    These documents are NOT pre-generated and stored as files. Instead,
    the PDFs are generated on-demand from the model data each time this
    endpoint is called, ensuring the output always reflects the latest
    stored data and eliminating stale file accumulation.

    The response uses multipart/form-data with two parts:
        1. "death_certificate" — filename: death_certificate.pdf
        2. "burial_permit"     — filename: burial_permit.pdf

    The frontend should parse the multipart response and handle each PDF
    part separately (e.g., download both files or display in a viewer).

    Access: REGISTRAR or CITIZEN.
        - REGISTRAR — can view certificates for any approved death record.
        - CITIZEN   — can view certificates for records where they are the
          informant (no additional ownership check is enforced at this
          layer; consider adding one if needed).

    Raises:
        404 — DeathRecords not found.
        409 — Submission is not APPROVED (certificates only exist after approval).
        400 — Missing DeathCertificate or BurialPermit (should not occur for
              approved records, but guarded against).
    """
    result = await sync_to_async(view_death_certificates)(death_records_id)

    cert_pdf = result["death_certificate_pdf"]
    permit_pdf = result["burial_permit_pdf"]

    if not os.path.exists(cert_pdf):
        return {"error": "Death Certificate PDF generation failed"}
    if not os.path.exists(permit_pdf):
        return {"error": "Burial Permit PDF generation failed"}

    with open(cert_pdf, "rb") as f1, open(permit_pdf, "rb") as f2:
        cert_data = f1.read()
        permit_data = f2.read()

    boundary = "death-certificates-boundary"
    body = io.BytesIO()

    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="death_certificate"; filename="death_certificate.pdf"\r\n')
    body.write(b"Content-Type: application/pdf\r\n\r\n")
    body.write(cert_data)
    body.write(b"\r\n")

    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="burial_permit"; filename="burial_permit.pdf"\r\n')
    body.write(b"Content-Type: application/pdf\r\n\r\n")
    body.write(permit_data)
    body.write(b"\r\n")

    body.write(f"--{boundary}--\r\n".encode())
    body.seek(0)

    return StreamingResponse(
        body,
        media_type=f"multipart/form-data; boundary={boundary}",
    )


@death_router.get("/{death_records_id}/review/full_pack")
async def review_all_approved_death_documents_endpoint(
    death_records_id: int,
    request: Request,
    user=Depends(require_groups([UserRole.REGISTRAR, UserRole.HEALTH_WORKER])),
):
    """
    GET /deaths/{death_records_id}/review/full_pack

    Fetches an APPROVED DeathRecords entry and streams all four
    death pipeline documents as a single multipart/form-data response:
        1. Death Certificate    — filename: death_certificate.pdf
        2. Burial Permit        — filename: burial_permit.pdf
        3. Medical Certificate of Cause of Death — filename: mccd.pdf
        4. Notice of Death      — filename: notice_of_death.pdf

    This is the comprehensive document retrieval endpoint for fully approved
    death records. It generates all four official PDFs on-demand from the
    stored model data and delivers them in a single HTTP response.

    Document provenance:
        - MCCD and Notice of Death are created during the submission phase
          (Steps 1 and 2 of the death registration pipeline) and reviewed
          by the Registrar before approval.
        - Death Certificate and Burial Permit are generated at approval time
          (Step 3) from the data in the MCCD and Notice of Death.

    The response uses multipart/form-data with a custom boundary
    ("death-full-pack-boundary"). Each part includes:
        - Content-Disposition with the document name and suggested filename.
        - Content-Type: application/pdf.

    The frontend should parse the multipart response using a library such as
    `form-data` or `busboy` (Node.js) or `email.message` (Python) to extract
    each PDF part by its name field.

    Use cases:
        - Registrar downloading the complete case file for archival.
        - Citizen retrieving all death-related documents in one request.
        - Audit/compliance officers requesting the full document set.

    Access: REGISTRAR or CITIZEN.

    Raises:
        404 — DeathRecords not found.
        409 — Submission is not APPROVED (the full pack requires the
              Death Certificate and Burial Permit, which only exist
              after approval).
        400 — Missing any of the four required documents (lists which
              ones in the error detail).
    """
    result = await sync_to_async(review_all_approved_death_documents)(death_records_id)

    cert_pdf = result["death_certificate_pdf"]
    permit_pdf = result["burial_permit_pdf"]
    mccd_pdf = result["mccd_pdf"]
    notice_pdf = result["notice_of_death_pdf"]

    for path, name in [(cert_pdf, "Death Certificate"), (permit_pdf, "Burial Permit"), (mccd_pdf, "MCCD"), (notice_pdf, "Notice of Death")]:
        if not os.path.exists(path):
            return {"error": f"{name} PDF generation failed"}

    with open(cert_pdf, "rb") as f1, open(permit_pdf, "rb") as f2, open(mccd_pdf, "rb") as f3, open(notice_pdf, "rb") as f4:
        cert_data = f1.read()
        permit_data = f2.read()
        mccd_data = f3.read()
        notice_data = f4.read()

    boundary = "death-full-pack-boundary"
    body = io.BytesIO()

    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="death_certificate"; filename="death_certificate.pdf"\r\n')
    body.write(b"Content-Type: application/pdf\r\n\r\n")
    body.write(cert_data)
    body.write(b"\r\n")

    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="burial_permit"; filename="burial_permit.pdf"\r\n')
    body.write(b"Content-Type: application/pdf\r\n\r\n")
    body.write(permit_data)
    body.write(b"\r\n")

    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="mccd"; filename="mccd.pdf"\r\n')
    body.write(b"Content-Type: application/pdf\r\n\r\n")
    body.write(mccd_data)
    body.write(b"\r\n")

    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="notice_of_death"; filename="notice_of_death.pdf"\r\n')
    body.write(b"Content-Type: application/pdf\r\n\r\n")
    body.write(notice_data)
    body.write(b"\r\n")

    body.write(f"--{boundary}--\r\n".encode())
    body.seek(0)

    return StreamingResponse(
        body,
        media_type=f"multipart/form-data; boundary={boundary}",
    )


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