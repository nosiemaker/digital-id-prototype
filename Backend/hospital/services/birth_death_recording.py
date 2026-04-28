# birth_death_recording.py
# Service layer for the civil registration module.
#
# This module contains all business logic for creating, submitting, approving,
# and rejecting birth and death records. It is called exclusively from the
# FastAPI router (hospital.py) via sync_to_async wrappers.
#
# Death registration pipeline:
#   1. submit_mccd()            — Health Worker submits the MCCD; creates DeathRecords (PENDING)
#   2. submit_notice_of_death() — Citizen/HW attaches the Notice of Death; marks ready_for_review
#   3. death_record_approval()  — RO approves; generates BurialPermit + DeathCertificate
#   4. death_record_rejection() — RO rejects; stores rejection_reason
#
# Birth registration pipeline:
#   1. record_submission("birth", ...) — Health Worker submits; creates NoticeOfBirth,
#                                         RecordOfBirth, and BirthRecords (PENDING)
#   2. birth_record_approval()         — RO approves; generates BirthCertificate and
#                                         creates child Citizen (INACTIVE)
#   3. birth_record_rejection()        — RO rejects; stores rejection_reason
#
# Query helpers (used by list/detail endpoints):
#   get_all_pending_births / get_all_pending_deaths
#   get_single_pending_birth / get_single_pending_death
#   get_single_birth_record / get_single_death_record
#   get_all_births_records / get_all_death_records
#   get_birth_certificates_by_user / get_burial_permits_by_user / get_death_certificates_by_user

import datetime
from pathlib import Path
from django.db import models, transaction
from fastapi import HTTPException
from Utils.audit_logger import audit
#from Utils.certificate_generator import generate_certificate
from admin_ops.models import SystemUser
from citizens.models import Citizen, CitizenStatus
from citizens.serializer import CitizenSerializer
from citizens.utilities.id_generation import generate_id, child_seed_generation
from dependencies.auth import UserRole
from hospital.models import (
    BirthCertificate, DeathRecords, MedicalCertificateCauseOfDeath,
    BirthRecords, RecordStatus, NoticeOfBirth, RecordOfBirth,
    RegistrationStatusChoices, BurialPermit, DeathCertificate,
)
from hospital.serializers import (
    DeathRecordRequestSerializer, BirthRecordRequestSerializer,
    NoticeOfBirthSerializer, RecordOfBirthSerializer,
    MedicalCertificateCauseOfDeathSerializer, NoticeOfDeathSerializer,
    BurialPermitSerializer, DeathCertificateSerializer, BirthCertificateSerializer,
)
from rest_framework import status


# ============================================================================
# DEATH PIPELINE — Step 1: Submit Medical Certificate of Cause of Death
# ============================================================================

def submit_mccd(request_body: dict, health_worker_id: int) -> dict:
    """
    Creates a MedicalCertificateCauseOfDeath record and opens a new DeathRecords
    submission in PENDING status.

    Called internally by record_submission("death", ...) from the router.

    Steps:
        1. Validate that informant_din is present and resolves to a known Citizen.
        2. Resolve the Citizen to a SystemUser (needed for the DeathRecords FK).
        3. Enrich the request body with informant details from the Citizen record
           (name, phone, address), then strip the informant_din sentinel field.
        4. Validate and save the MCCD via its serializer.
        5. Create a DeathRecords entry linking the MCCD and the submitting health worker.
        6. Emit an audit event.

    Args:
        request_body:     Validated dict from MedicalCertificateCauseOfDeathCreate.
        health_worker_id: SystemUser ID of the authenticated Health Worker.

    Returns:
        Dict with details, death_records_id, mccd_id, and HTTP 201 status.

    Raises:
        HTTPException 400 — informant_din missing, Citizen not found, serialiser invalid.
        HTTPException 400 — SystemUser not found for resolved Citizen.
    """
    informant_din = request_body.get("informant_din")

    if not informant_din:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="informant_din is required",
        )

    # Resolve informant's DIN to a Citizen record
    try:
        informant = Citizen.objects.get(din=informant_din)
    except Citizen.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Informant with DIN '{informant_din}' not found in citizen registry",
        )

    # Enrich request data with informant details pulled from the Citizen record
    # so the MCCD model receives concrete values rather than just the DIN reference.
    enriched_data = request_body.copy()
    enriched_data["informant_name"]           = informant.full_name
    enriched_data["informant_contact_no"]     = informant.phone
    enriched_data["informant_postal_address"] = (
        getattr(informant, 'postal_address', None) or informant.residential_address
    )
    enriched_data.pop("informant_din", None)  # Remove the DIN sentinel — MCCD stores the resolved name

    # Resolve the Citizen to a SystemUser so we can set the informant FK on DeathRecords
    try:
        informant_sys = SystemUser.objects.get(citizen=informant)
    except SystemUser.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Informant with DIN '{informant_din}' not found in system registry",
        )

    # Validate and persist the MCCD
    mccd_serializer = MedicalCertificateCauseOfDeathSerializer(data=enriched_data)
    if not mccd_serializer.is_valid():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=mccd_serializer.errors,
        )
    mccd = mccd_serializer.save()

    # Create the submission tracker in PENDING state, linking the MCCD and submitter
    death_records = DeathRecords.objects.create(
        medical_certificate_of_death=mccd,
        health_worker_id=health_worker_id,
        informant=informant_sys,
        status=RegistrationStatusChoices.PENDING,
    )

    audit.death_record_submitted(health_worker_id, death_records.id)

    return {
        "details": "MCCD Submitted",
        "death_records_id": death_records.id,
        "mccd_id": mccd.id,
        "status": status.HTTP_201_CREATED,
    }


# ============================================================================
# DEATH PIPELINE — Step 2: Attach Notice of Death
# ============================================================================

def submit_notice_of_death(request_body: dict, death_record_id: int, citizen_id: int) -> dict:
    """
    Links a Notice of Death to an existing DeathRecords entry and marks the
    submission as ready_for_review so the RO can process it.

    Only the Citizen identified as the informant on the original MCCD submission
    is permitted to attach the Notice of Death. This is enforced by comparing
    the authenticated citizen_id to the informant FK on the DeathRecords entry.

    Steps:
        1. Validate the authenticated citizen_id resolves to a SystemUser.
        2. Fetch the DeathRecords entry and verify the informant match.
        3. Guard against attaching a second Notice of Death to the same record.
        4. Resolve informant_din → Citizen; enrich request body with informant details.
        5. Optionally resolve deceased_din → Citizen; enrich body with deceased details.
        6. Validate and save the NoticeOfDeath.
        7. Link it to the DeathRecords entry and set ready_for_review = True.

    Args:
        request_body:     Validated dict from NoticeOfDeathCreate.
        death_record_id:  PK of the DeathRecords entry created during MCCD submission.
        citizen_id:       SystemUser ID of the authenticated user (Citizen or Health Worker).

    Returns:
        Dict with details, death_records_id, notice_of_death_id, and HTTP 200 status.

    Raises:
        HTTPException 404 — SystemUser or DeathRecords not found.
        HTTPException 400 — Informant mismatch, Notice already linked, or serialiser errors.
    """
    # Verify the authenticated user is a valid SystemUser
    try:
        citizen_sys = SystemUser.objects.get(id=citizen_id)
    except SystemUser.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User Not Found")

    # Fetch the DeathRecords entry, including the informant relation for the ownership check
    try:
        death_records = DeathRecords.objects.select_related(
            "informant_that_submits_death_notice"
        ).get(id=death_record_id)
    except DeathRecords.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"DeathRecords with ID '{death_record_id}' not found",
        )

    # Ownership check: only the informant recorded on the MCCD may attach the notice
    if not citizen_sys.id == death_records.informant.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Death Record is not linked to this user",
        )

    # Guard against duplicate Notice of Death submissions for the same record
    if death_records.notice_of_death:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Notice of Death already linked to this record",
        )

    informant_din = request_body.get("informant_din")
    deceased_din  = request_body.get("deceased_din")

    if not informant_din:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="informant_din is required",
        )

    # Resolve informant DIN → Citizen and enrich the notice data
    try:
        informant = Citizen.objects.get(din=informant_din)
    except Citizen.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Informant with DIN '{informant_din}' not found in citizen registry",
        )

    enriched_data = request_body.copy()
    # Split full_name into surname (last part) and other_names (everything before the last part)
    enriched_data["informant_surname"]            = informant.full_name.split()[-1] if informant.full_name else ""
    enriched_data["informant_other_names"]        = " ".join(informant.full_name.split()[:-1]) if informant.full_name else ""
    enriched_data["informant_contact_no"]         = informant.phone
    enriched_data["informant_national_id"]        = informant.nrc
    enriched_data["informant_nationality"]        = informant.nationality
    enriched_data["informant_residential_address"] = informant.residential_address
    enriched_data["informant_postal_address"]     = (
        getattr(informant, 'postal_address', None) or informant.residential_address
    )
    # Remove sentinel DIN fields; the model stores resolved values instead
    enriched_data.pop("informant_din", None)
    enriched_data.pop("deceased_din", None)

    # If the deceased is a registered Citizen, auto-populate Section A from their profile.
    # If the DIN cannot be resolved, we silently continue — the caller must have
    # provided the manual deceased detail fields instead.
    if deceased_din:
        try:
            deceased = Citizen.objects.get(din=deceased_din)
            enriched_data["deceased_din"]        = deceased_din
            enriched_data["surname"]             = deceased.full_name.split()[-1] if deceased.full_name else ""
            enriched_data["other_names"]         = " ".join(deceased.full_name.split()[:-1]) if deceased.full_name else ""
            enriched_data["occupation"]          = deceased.occupation
            enriched_data["residential_address"] = deceased.residential_address
            enriched_data["date_of_birth"]       = deceased.dob
            enriched_data["sex"]                 = deceased.sex
            enriched_data["nationality"]         = deceased.nationality
            enriched_data["national_identity_no"] = deceased.nrc
            enriched_data["social_security_no"]  = deceased.social_id
            enriched_data["education_level"]     = deceased.education_level
        except Citizen.DoesNotExist:
            # Deceased not in registry; caller must have supplied manual fields
            pass

    # Validate and persist the Notice of Death
    notice_serializer = NoticeOfDeathSerializer(data=enriched_data)
    if not notice_serializer.is_valid():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=notice_serializer.errors,
        )
    notice_of_death = notice_serializer.save()

    # Link the notice to the DeathRecords entry and signal readiness for RO review
    death_records.notice_of_death   = notice_of_death
    death_records.ready_for_review  = True
    death_records.save(update_fields=["notice_of_death"])

    return {
        "details": "Notice of Death Linked",
        "death_records_id": death_records.id,
        "notice_of_death_id": notice_of_death.id,
        "status": status.HTTP_200_OK,
    }


# ============================================================================
# UNIFIED SUBMISSION DISPATCHER
# ============================================================================

def record_submission(record_type: str, request_body: dict, user_id: int):
    """
    Entry point for all new birth and death submissions from the router.

    Dispatches to the appropriate pipeline based on record_type:
        "death" → submit_mccd()
        "birth" → inline birth submission logic (see below)

    Birth submission logic (inline):
        1. Validate mother_din; optionally validate father_din.
        2. Resolve Citizen records for mother (and father if provided).
        3. Parse full_name strings into given_name / surname / other_names components.
        4. Build the NoticeOfBirth data dict, merging Citizen data with form-specific fields.
        5. Build the RecordOfBirth data dict.
        6. Validate and save NoticeOfBirth; on failure raise 400.
        7. Validate and save RecordOfBirth; on failure delete the NoticeOfBirth and raise 400
           (prevents orphan records).
        8. Create the BirthRecords submission tracker (PENDING).
        9. Emit an audit event.

    Args:
        record_type:  "birth" or "death".
        request_body: Validated dict from BirthRecordSubmission or
                      MedicalCertificateCauseOfDeathCreate.
        user_id:      SystemUser ID of the authenticated Health Worker.

    Returns:
        Dict with details, IDs of created records, and HTTP status.

    Raises:
        HTTPException 400 — missing/invalid DINs, serialiser validation errors.
        HTTPException 400 — invalid record_type.
    """
    if record_type == "death":
        return submit_mccd(request_body, user_id)

    elif record_type == "birth":
        # --- 1. Validate required parent DINs ---
        mother_din = request_body.get("mother_din")
        father_din = request_body.get("father_din")

        if not mother_din:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="mother_din is required",
            )

        # Resolve mother Citizen record (mandatory)
        try:
            mother_citizen = Citizen.objects.get(din=mother_din)
        except Citizen.DoesNotExist:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mother with DIN '{mother_din}' not found in citizen registry",
            )

        # Resolve father Citizen record (optional — only if father_din supplied)
        father_citizen = None
        if father_din:
            try:
                father_citizen = Citizen.objects.get(din=father_din)
            except Citizen.DoesNotExist:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Father with DIN '{father_din}' not found in citizen registry",
                )

        # --- 2. Name parsing helper ---
        def parse_full_name(full_name):
            """
            Splits a full_name string into its component parts.

            Returns a dict with:
                given_name  — first word
                surname     — last word
                other_names — everything in between (empty string if none)
            """
            if not full_name:
                return {"given_name": "", "surname": "", "other_names": ""}
            parts = full_name.strip().split()
            if len(parts) == 1:
                return {"given_name": parts[0], "surname": "", "other_names": ""}
            elif len(parts) == 2:
                return {"given_name": parts[0], "surname": parts[1], "other_names": ""}
            else:
                return {
                    "given_name": parts[0],
                    "surname": parts[-1],
                    "other_names": " ".join(parts[1:-1]),
                }

        # --- 3. Parse parent names from Citizen records ---
        mother_names = parse_full_name(mother_citizen.full_name)
        father_names = parse_full_name(father_citizen.full_name) if father_citizen else {}

        # --- 4. Build NoticeOfBirth data dict ---
        # Merges form-submitted fields with Citizen data; Citizen data takes precedence
        # for personal details (NRC, NAPSA, nationality, etc.) to ensure accuracy.
        notice_data = {
            # Form reference fields
            "serial_number":  request_body.get("notice_serial_number"),
            "district":       request_body.get("district"),
            "date_and_time":  request_body.get("date_and_time_of_birth_notification"),
            # Section 1: Birth details
            "date_of_birth":          request_body.get("date_of_birth"),
            "place_of_birth":         request_body.get("place_of_birth"),
            "health_facility_name":   request_body.get("health_facility_name"),
            "home_address":           request_body.get("home_address"),
            "other_place_specified":  request_body.get("other_place_specified"),
            "child_surname":          request_body.get("child_surname"),
            "child_given_name":       request_body.get("child_given_name"),
            "child_other_names":      request_body.get("child_other_names"),
            "sex":                    request_body.get("sex"),
            "birth_weight_kg":        request_body.get("birth_weight_kg"),
            # ===== Mother details — sourced from Citizen record =====
            "mother_surname":          mother_names["surname"],
            "mother_other_names":      mother_names["other_names"],
            "mother_maiden_surname":   mother_citizen.maiden_name,
            "mother_dob":              mother_citizen.dob,
            "mother_national_id":      mother_citizen.nrc,
            "mother_nationality":      mother_citizen.nationality or "ZAMBIAN",
            "mother_occupation":       mother_citizen.occupation,
            "mother_social_id":        mother_citizen.social_id,
            "mother_education":        mother_citizen.education_level,
            "mother_residential_address": mother_citizen.residential_address,
            # Tribal/village fields come from the form (not stored on Citizen)
            "mother_village_of_origin":        request_body.get("mother_village_of_origin"),
            "mother_chief":                    request_body.get("mother_chief"),
            "mother_district":                 request_body.get("mother_district"),
            "mother_tribe":                    request_body.get("mother_tribe"),
            "mother_usual_place_of_residence": request_body.get("mother_usual_place_of_residence"),
            # ===== Father details — sourced from Citizen record (None if no father) =====
            "father_surname":       father_names.get("surname", ""),
            "father_other_names":   father_names.get("other_names", ""),
            "father_dob":           father_citizen.dob if father_citizen else None,
            "father_national_id":   father_citizen.nrc if father_citizen else None,
            "father_occupation":    father_citizen.occupation if father_citizen else None,
            "father_social_id":     father_citizen.social_id if father_citizen else None,
            "father_nationality":   (father_citizen.nationality or "ZAMBIAN") if father_citizen else None,
            "father_village_of_origin": request_body.get("father_village_of_origin"),
            "father_chief":             request_body.get("father_chief"),
            "father_district":          request_body.get("father_district"),
            "father_tribe":             request_body.get("father_tribe"),
            "father_residential_address": father_citizen.residential_address if father_citizen else None,
            "father_contact_no":          father_citizen.phone if father_citizen else None,
            # ===== Form-specific sign-off fields =====
            "attendant_at_birth":              request_body.get("attendant_at_birth"),
            "attendant_other_specified":       request_body.get("attendant_other_specified"),
            "marital_status":                  request_body.get("marital_status"),
            "father_acknowledgement_signature": request_body.get("father_acknowledgement_signature"),
            "father_acknowledgement_date":     request_body.get("father_acknowledgement_date"),
            "mother_consent_signature":        request_body.get("mother_consent_signature"),
            "mother_consent_date":             request_body.get("mother_consent_date"),
        }

        notice_serializer = NoticeOfBirthSerializer(data=notice_data)
        if not notice_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=notice_serializer.errors,
            )
        notice_of_birth = notice_serializer.save()

        # --- 5. Build RecordOfBirth data dict ---
        # The Record of Birth (M.F.2) is the condensed facility summary form.
        record_data = {
            "serial_number":   request_body.get("record_of_birth_serial_number"),
            "file_number":     request_body.get("file_number"),
            "place_of_birth":  request_body.get("place_of_birth_text"),
            "child_surname":   request_body.get("child_surname"),
            "child_other_names": request_body.get("child_other_names"),
            "sex":             request_body.get("sex"),
            "birth_weight_kg": request_body.get("birth_weight_kg"),
            "date_of_birth":   request_body.get("date_of_birth"),
            "time_of_birth":   request_body.get("time_of_birth"),
            # Mother and father names come from the Citizen records
            "mother_name":          mother_citizen.full_name,
            "father_name":          father_citizen.full_name if father_citizen else None,
            "father_occupation":    father_citizen.occupation if father_citizen else None,
            "father_present_address": father_citizen.residential_address if father_citizen else None,
            # Officer sign-off fields
            "officer_in_charge":  request_body.get("officer_in_charge"),
            "official_stamp_ref": request_body.get("official_stamp_ref"),
            "date_signed":        request_body.get("date_signed"),
        }

        record_serializer = RecordOfBirthSerializer(data=record_data)
        if not record_serializer.is_valid():
            # Clean up the already-saved NoticeOfBirth to prevent orphan records
            notice_of_birth.delete()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=record_serializer.errors,
            )
        record_of_birth = record_serializer.save()

        # --- 6. Create the BirthRecords submission tracker ---
        birth_records = BirthRecords.objects.create(
            mother=mother_citizen,
            father=father_citizen,
            health_worker_id=user_id,
            status=RecordStatus.PENDING,
            notice_of_birth=notice_of_birth,
            record_of_birth=record_of_birth,
        )

        audit.birth_record_submitted(user_id, birth_records.id)

        return {
            "details": "Birth Record Submitted",
            "birth_records_id":    birth_records.id,
            "notice_of_birth_id":  notice_of_birth.id,
            "record_of_birth_id":  record_of_birth.id,
            "status": status.HTTP_201_CREATED,
        }

    else:
        # record_type is neither "birth" nor "death"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Request",
        )


# ============================================================================
# DEATH PIPELINE — Step 3: RO Approval
# ============================================================================

def death_record_approval(request_id: int, registrar_id: int) -> dict:
    """
    Approves a pending death registration, generating the Death Certificate
    and Burial Permit and optionally updating the deceased Citizen's status.

    Steps:
        1. Fetch the DeathRecords entry (with row-level lock to prevent race conditions).
        2. Guard: only PENDING submissions can be approved.
        3. Guard: a linked Notice of Death is required (proof that the informant filed it).
        4. Assemble Death Certificate data from the Notice of Death and MCCD.
        5. Assemble Burial Permit data.
        6. Validate both serialisers before starting the atomic block.
        7. If the deceased has a DIN, mark their Citizen status as DECEASED.
        8. Within an atomic transaction: save the certificate and permit, link them
           to the DeathRecords entry, and update its status to APPROVED.
        9. Emit an audit event.

    Args:
        request_id:   PK of the DeathRecords submission to approve.
        registrar_id: SystemUser ID of the authenticated Registrar Officer.

    Returns:
        Dict with details, death_records_id, death_certificate_id,
        burial_permit_id, and HTTP 200 status.

    Raises:
        HTTPException 404 — DeathRecords not found.
        HTTPException 409 — Submission is not PENDING.
        HTTPException 400 — Notice of Death missing or serialiser validation errors.
    """
    # Lock the row to prevent concurrent approval attempts on the same submission
    try:
        death_records = (
            DeathRecords.objects
            .select_for_update()
            .select_related("notice_of_death", "medical_certificate_of_death")
            .get(id=request_id)
        )
    except DeathRecords.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request Not Found")

    # Guard: only transition from PENDING
    if death_records.status != RegistrationStatusChoices.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Request is not pending",
        )

    # A Notice of Death must be attached before the case can be approved
    if not death_records.notice_of_death:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Notice of Death is required for approval",
        )

    notice = death_records.notice_of_death
    mccd   = death_records.medical_certificate_of_death

    # Derive deceased's full name and place of death for the output documents
    deceased_full_name = f"{notice.other_names} {notice.surname}".strip()
    place_of_death     = notice.place_of_death_name or notice.place_of_death_other or "Unknown"

    # Build multi-line cause of death string from the MCCD's Part I chain
    cause_of_death = ""
    if mccd:
        cause_of_death = mccd.cause_a
        if mccd.cause_b:
            cause_of_death += f"\n{mccd.cause_b}"
        if mccd.cause_c:
            cause_of_death += f"\n{mccd.cause_c}"

    # Generate a unique registration number for the death certificate
    from citizens.utilities.id_generation import generate_id
    death_cert_no = generate_id(f"death_{request_id}", "DEATH_CERT")

    # Assemble Death Certificate payload from the notice and MCCD data
    death_certificate_data = {
        "notice_of_death": notice.id,
        "mccd":            mccd.id if mccd else None,
        "registration_no": death_cert_no,
        "date_of_death":   notice.date_of_death,
        "district":        notice.district,
        "place_of_death":  place_of_death,
        "deceased_names_and_surname": deceased_full_name,
        "sex":             notice.sex,
        "age":             str(notice.age_at_death) if notice.age_at_death else "Unknown",
        "nationality":     notice.nationality,
        "occupation":      notice.occupation,
        "napsa_social_security_no": notice.social_security_no,
        "national_identity_no":     notice.national_identity_no,
        "cause_of_death":  cause_of_death,
        "informant_name":  f"{notice.informant_other_names} {notice.informant_surname}".strip(),
        "informant_relationship": notice.informant_relationship,
        "date_of_registration":   datetime.date.today(),
        "register_kept_at":       f"{notice.district} District Registry",
        "issued_date":            datetime.date.today(),
        "registrar_general_name": "Registrar",   # TODO: populate from the registrar's Citizen profile
    }

    death_cert_serializer = DeathCertificateSerializer(data=death_certificate_data)
    if not death_cert_serializer.is_valid():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=death_cert_serializer.errors,
        )

    # Assemble Burial Permit payload — minimal data needed for the Form XI
    burial_permit_data = {
        "notice_of_death":  notice.id,
        "deceased_name":    deceased_full_name,
        "place_of_death":   place_of_death,
        "date_of_death":    notice.date_of_death,
        "issuing_authority": "REGISTRAR",
        "issued_date":      datetime.date.today(),
    }

    burial_permit_serializer = BurialPermitSerializer(data=burial_permit_data)
    if not burial_permit_serializer.is_valid():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=burial_permit_serializer.errors,
        )

    # If the deceased is a registered Citizen, update their status to DECEASED
    # and retire their DIN. Failures here are non-blocking (e.g. unregistered persons).
    deceased_din = notice.deceased_din
    if deceased_din:
        try:
            deceased_citizen = Citizen.objects.get(din=deceased_din)
            citizen_serializer = CitizenSerializer(
                instance=deceased_citizen,
                data={"status": CitizenStatus.DECEASED},
                partial=True,
            )
            if citizen_serializer.is_valid():
                citizen_serializer.save()
        except Citizen.DoesNotExist:
            pass  # Deceased not in registry; proceed without updating citizen status

    # Atomically save all documents and update the DeathRecords status
    with transaction.atomic():
        death_certificate = death_cert_serializer.save()
        burial_permit     = burial_permit_serializer.save()
        death_records.death_certificate = death_certificate
        death_records.burial_permit     = burial_permit
        death_records.registrar_id      = registrar_id
        death_records.status            = RegistrationStatusChoices.APPROVED
        death_records.save()

    audit.death_record_approved(registrar_id, death_records.id)

    return {
        "details":            "Approval Successful",
        "death_records_id":   death_records.id,
        "death_certificate_id": death_certificate.id,
        "burial_permit_id":   burial_permit.id,
        "status": status.HTTP_200_OK,
    }


# ============================================================================
# DEATH PIPELINE — Step 3 (alternate): RO Rejection
# ============================================================================

def death_record_rejection(request_id: int, registrar_id: int, rejection_reason: str) -> dict:
    """
    Rejects a pending death registration and records the reason.

    The rejection is stored on the DeathRecords entry. No downstream
    documents (certificate, permit) are generated.

    Args:
        request_id:        PK of the DeathRecords submission to reject.
        registrar_id:      SystemUser ID of the authenticated Registrar Officer.
        rejection_reason:  Human-readable explanation for the rejection.

    Returns:
        Dict with details, death_records_id, rejection_reason, and HTTP 200 status.

    Raises:
        HTTPException 404 — DeathRecords not found.
        HTTPException 409 — Submission is not PENDING.
    """
    try:
        death_records = DeathRecords.objects.get(id=request_id)
    except DeathRecords.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record Request Not Found")

    # Guard: only PENDING submissions can be rejected
    if death_records.status != RegistrationStatusChoices.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request is not pending")

    # Atomically update the submission status
    with transaction.atomic():
        death_records.registrar_id     = registrar_id
        death_records.status           = RegistrationStatusChoices.REJECTED
        death_records.rejection_reason = rejection_reason
        death_records.save()

    return {
        "details":          "Request Rejected",
        "death_records_id": death_records.id,
        "rejection_reason": rejection_reason,
        "status": status.HTTP_200_OK,
    }


# ============================================================================
# BIRTH PIPELINE — Step 2: RO Approval
# ============================================================================

def birth_record_approval(request_id: int, registrar_id: int) -> dict:
    """
    Approves a pending birth registration, generating the Birth Certificate
    and creating an INACTIVE Citizen record for the child.

    Steps:
        1. Verify the registrar's SystemUser account exists.
        2. Fetch the BirthRecords entry (with row-level lock).
        3. Guard: only PENDING submissions can be approved.
        4. Verify both NoticeOfBirth and RecordOfBirth are linked.
        5. Verify the mother Citizen still exists; if not, auto-reject and raise.
        6. Derive child identity from the NoticeOfBirth.
        7. Generate the child's DIN via deterministic seed (name + dob + facility + mother DIN).
        8. Check for an existing BirthCertificate with the same reg_no to prevent duplicates.
        9. Within an atomic transaction:
               a. Resolve mother's and father's SystemUser accounts.
               b. Create the BirthCertificate with data from the notice and record.
               c. Update the BirthRecords submission to APPROVED.
               d. Create the child Citizen with status=INACTIVE.
       10. Emit an audit event.

    Args:
        request_id:   PK of the BirthRecords submission to approve.
        registrar_id: SystemUser ID of the authenticated Registrar Officer.

    Returns:
        Dict with details, certificate ID, and HTTP 200 status.

    Raises:
        HTTPException 404 — Registrar or BirthRecords not found.
        HTTPException 409 — Submission is not PENDING, or certificate already exists.
        HTTPException 400 — Missing related documents, invalid citizen data.
    """
    # Verify the registrar account exists and load their Citizen profile (for the cert)
    try:
        registrar = SystemUser.objects.select_related("citizen").get(id=registrar_id)
    except SystemUser.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registrar Not Found")

    # Lock the row to prevent concurrent approval attempts
    try:
        submission_request = (
            BirthRecords.objects
            .select_for_update()
            .select_related("notice_of_birth", "record_of_birth")
            .get(id=request_id)
        )
    except BirthRecords.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record Request Not Found")

    # Guard: only PENDING submissions can be approved
    if submission_request.status != RecordStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request is not pending")

    notice_of_birth = submission_request.notice_of_birth
    record_of_birth = submission_request.record_of_birth

    # Both sub-documents are required — they should always be present for valid submissions
    if not notice_of_birth or not record_of_birth:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Notice of Birth or Record of Birth not found for this submission",
        )

    mother = submission_request.mother
    father = submission_request.father

    # If the mother Citizen no longer exists, auto-reject and surface the error
    if not mother:
        details = birth_record_rejection(request_id, registrar_id, "Mother ID Not Found")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=details)

    # Extract child details from the notice for DIN generation and certificate fields
    child_full_name = f"{notice_of_birth.child_given_name} {notice_of_birth.child_surname}"
    child_dob       = notice_of_birth.date_of_birth
    born_at         = notice_of_birth.date_and_time
    sex             = notice_of_birth.sex
    birth_weight    = notice_of_birth.birth_weight_kg
    place_of_birth  = (
        notice_of_birth.health_facility_name
        or notice_of_birth.home_address
        or notice_of_birth.other_place_specified
    )

    # Generate a deterministic DIN for the child based on identity + mother's DIN
    child_id = generate_id(
        child_seed_generation(child_full_name, child_dob, born_at, mother.din),
        "CHILD",
    )

    # Prevent duplicate certificates: check if a cert with this reg_no already exists
    try:
        BirthCertificate.objects.get(reg_no=child_id)
    except BirthCertificate.DoesNotExist:
        pass  # No existing certificate — safe to proceed
    else:
        # A certificate already exists; auto-reject to clean up and surface the conflict
        details = birth_record_rejection(request_id, registrar_id, "Certificate Already Exists")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=details)

    # Atomic block: create all downstream records together or roll back entirely
    with transaction.atomic():

        # NOTE: Certificate PDF generation is currently commented out (see cert_info block above).
        # When re-enabled, generate_certificate() should be called here and its URL/hash stored.

        # Resolve SystemUser accounts for the mother and father (for certificate FK linking)
        mother_system_user = None
        father_system_user = None

        if mother:
            try:
                mother_system_user = SystemUser.objects.select_related(
                    "System_user_to_citizen"
                ).get(citizen=mother)
            except SystemUser.DoesNotExist:
                pass  # Certificate can still be created; FK will be null

        if father:
            try:
                father_system_user = SystemUser.objects.get(citizen=father)
            except SystemUser.DoesNotExist:
                pass

        mother_citizen = mother_system_user.citizen  # Used for informant address on the certificate

        # Create the BirthCertificate, populating all fields from the Notice of Birth
        birth_certificate = BirthCertificate.objects.create(
            mother_system_user=mother_system_user,
            father_system_user=father_system_user,
            reg_no=child_id,
            district=notice_of_birth.district,
            date_of_birth=child_dob,
            sex=sex,
            place_of_birth=place_of_birth,
            surname=notice_of_birth.child_surname,
            other_names=notice_of_birth.child_given_name,
            # Father details (may be blank if no father DIN was provided)
            father_name=f"{notice_of_birth.father_other_names or ''} {notice_of_birth.father_surname or ''}".strip(),
            father_occupation=notice_of_birth.father_occupation,
            father_nssf=notice_of_birth.father_social_id,
            father_nationality=notice_of_birth.father_nationality,
            father_nid=notice_of_birth.father_national_id,
            # Mother details
            mother_name=f"{notice_of_birth.mother_other_names or ''} {notice_of_birth.mother_surname or ''}".strip(),
            mother_maiden=notice_of_birth.mother_maiden_surname,
            mother_nssf=notice_of_birth.mother_social_id,
            mother_nationality=notice_of_birth.mother_nationality,
            mother_nid=notice_of_birth.mother_national_id,
            # Informant = mother (standard for facility births)
            informant_name=f"{notice_of_birth.mother_other_names or ''} {notice_of_birth.mother_surname or ''}".strip(),
            informant_address=mother_citizen.residential_address or "",
            postal_address="",
            date_of_registration=submission_request.submitted_at.date(),
            registrar_name=registrar.citizen.full_name,
        )

        # Update the BirthRecords submission to APPROVED and link the new certificate
        record_submission_serializer = BirthRecordRequestSerializer(
            instance=submission_request,
            data={
                "status":            RecordStatus.APPROVED,
                "registrar":         registrar_id,
                "reviewed_at":       datetime.datetime.now(),
                "birth_certificate": birth_certificate,
            },
            partial=True,
        )
        if not record_submission_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=record_submission_serializer.errors,
            )
        record_submission_serializer.save()

        # Create the child's Citizen record with INACTIVE status.
        # The child must go through the full citizen registration flow to become ACTIVE.
        citizen_serializer = CitizenSerializer(
            data={
                "din":       child_id,
                "full_name": child_full_name,
                "dob":       child_dob,
                "status":    CitizenStatus.INACTIVE,
            },
        )
        if not citizen_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=citizen_serializer.errors,
            )
        citizen_serializer.save()

    audit.birth_record_approved(registrar_id, birth_certificate.id)

    return {
        "details":     "Approval Successful",
        "certificate": birth_certificate.id,
        "status": status.HTTP_200_OK,
    }


# ============================================================================
# BIRTH PIPELINE — Step 2 (alternate): RO Rejection
# ============================================================================

def birth_record_rejection(request_id: int, registrar_id: int, rejection_reason: str) -> dict:
    """
    Rejects a pending birth registration and records the reason.

    Also called internally by birth_record_approval() to auto-reject
    when guard conditions fail (e.g. mother not found, duplicate certificate).

    Args:
        request_id:        PK of the BirthRecords submission to reject.
        registrar_id:      SystemUser ID of the Registrar Officer.
        rejection_reason:  Human-readable explanation for the rejection.

    Returns:
        Dict with details, serialised submission data, and HTTP 200 status.

    Raises:
        HTTPException 404 — BirthRecords not found.
        HTTPException 409 — Submission is not PENDING.
        HTTPException 400 — Serialiser validation errors.
    """
    try:
        submission_request = (
            BirthRecords.objects
            .select_related("notice_of_birth", "record_of_birth")
            .get(id=request_id)
        )
    except BirthRecords.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record Request Not Found")

    # Guard: only PENDING submissions can be rejected
    if submission_request.status != RecordStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request is not pending")

    with transaction.atomic():
        record_submission_serializer = BirthRecordRequestSerializer(
            instance=submission_request,
            data={
                "status":           RecordStatus.REJECTED,
                "registrar":        registrar_id,
                "reviewed_at":      datetime.datetime.now(),
                "rejection_reason": rejection_reason,
            },
            partial=True,
        )
        if not record_submission_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=record_submission_serializer.errors,
            )
        record_submission_serializer.save()

    return {
        "details": "Request Rejected",
        "request": record_submission_serializer.data,
        "status": status.HTTP_200_OK,
    }


# ============================================================================
# QUERY HELPERS — Pending Queues (RO review dashboard)
# ============================================================================

def get_all_pending_births():
    """
    Returns all BirthRecords submissions currently in PENDING status.
    Used to populate the Registrar Officer's review queue.
    """
    pending_submissions = BirthRecords.objects.filter(status=RecordStatus.PENDING)
    serializer = BirthRecordRequestSerializer(pending_submissions, many=True)
    if serializer.data:
        return {"details": "Submission Found", "pending_submissions": serializer.data}
    else:
        return {"details": "No Submissions Found", "pending_submissions": serializer.data}


def get_all_pending_deaths():
    """
    Returns all DeathRecords submissions currently in PENDING status.
    Used to populate the Registrar Officer's review queue.
    """
    pending_submissions = DeathRecords.objects.filter(status=RecordStatus.PENDING)
    serializer = DeathRecordRequestSerializer(pending_submissions, many=True)
    if serializer.data:
        return {"details": "Submission Found", "pending_submissions": serializer.data}
    else:
        return {"details": "No Submissions Found", "pending_submissions": serializer.data}


def get_single_pending_birth(request_id: int):
    """
    Returns a single BirthRecords submission by PK.
    Used when an RO needs to review the details of a specific pending submission.

    Raises:
        HTTPException 404 — BirthRecords not found.
    """
    try:
        pending_submission = BirthRecords.objects.get(id=request_id)
    except BirthRecords.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission Does Not Exist")
    serializer = BirthRecordRequestSerializer(pending_submission)
    return {"details": "Submission Found", "pending_submission": serializer.data}


def get_single_pending_death(request_id: int):
    """
    Returns a single DeathRecords submission by PK.
    Used when an RO needs to review the details of a specific pending submission.

    Raises:
        HTTPException 404 — DeathRecords not found.
    """
    try:
        pending_submission = DeathRecords.objects.get(id=request_id)
    except DeathRecords.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission Does Not Exist")
    serializer = DeathRecordRequestSerializer(pending_submission)
    return {"details": "Submissions Found", "pending_submission": serializer.data}


# ============================================================================
# QUERY HELPERS — Approved Record Detail (RO audit view)
# ============================================================================

def get_single_birth_record(request_id: int):
    """
    Returns a single BirthRecords entry (any status) by PK.
    Used for RO audit views and admin lookups.

    Raises:
        HTTPException 404 — BirthRecords not found.
    """
    try:
        record = BirthRecords.objects.get(id=request_id)
    except BirthRecords.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record Does Not Exist")
    serializer = BirthRecordRequestSerializer(record)
    return {"details": "Record Found", "record": serializer.data}


def get_single_death_record(request_id: int):
    """
    Returns a single DeathRecords entry (any status) by PK.
    Used for RO audit views and admin lookups.

    Raises:
        HTTPException 404 — DeathRecords not found.
    """
    try:
        record = DeathRecords.objects.get(id=request_id)
    except DeathRecords.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record Does Not Exist")
    serializer = DeathRecordRequestSerializer(record)
    return {"details": "Record Found", "record": serializer.data}


# ============================================================================
# QUERY HELPERS — All Records (RO list views)
# ============================================================================

def get_all_births_records():
    """Returns all BirthRecords submissions regardless of status."""
    records = BirthRecords.objects.all()
    serializer = BirthRecordRequestSerializer(records, many=True)
    if serializer.data:
        return {"details": "Records Found", "records": serializer.data}
    else:
        return {"details": "No Records Found", "records": serializer.data}


def get_all_death_records():
    """Returns all DeathRecords submissions regardless of status."""
    records = DeathRecords.objects.all()
    serializer = DeathRecordRequestSerializer(records, many=True)
    if serializer.data:
        return {"details": "Records Found", "records": serializer.data}
    else:
        return {"details": "No Records Found", "records": serializer.data}


# ============================================================================
# QUERY HELPERS — Citizen Self-Service (certificate retrieval)
# ============================================================================

def get_birth_certificates_by_user(user_id: int) -> dict:
    """
    Returns all BirthCertificates where the authenticated Citizen is
    listed as either the mother or the father.

    Uses an OR query so both parents can retrieve the same certificate.

    Args:
        user_id: SystemUser ID of the authenticated Citizen.

    Returns:
        Dict with details and serialised certificate list (or empty list).
    """
    certificates = BirthCertificate.objects.filter(
        models.Q(mother_system_user_id=user_id) | models.Q(father_system_user_id=user_id)
    )
    if certificates:
        serializer = BirthCertificateSerializer(certificates, many=True)
        return {"details": "Certificates Found", "certificates": serializer.data}
    else:
        return {"details": "No Certificates Found", "certificates": []}


def get_burial_permits_by_user(user_id: int) -> dict:
    """
    Returns all BurialPermits associated with death registrations where
    the authenticated Citizen is the informant.

    Filters out DeathRecords that have no linked burial_permit (i.e. not yet approved).

    Args:
        user_id: SystemUser ID of the authenticated Citizen.

    Returns:
        Dict with details and serialised permit list (or empty list).
    """
    death_records = DeathRecords.objects.filter(
        informant_id=user_id
    ).exclude(burial_permit_id__isnull=True)

    if death_records:
        permits = [dr.burial_permit for dr in death_records if dr.burial_permit]
        serializer = BurialPermitSerializer(permits, many=True)
        return {"details": "Burial Permits Found", "permits": serializer.data}
    else:
        return {"details": "No Burial Permits Found", "permits": []}


def get_death_certificates_by_user(user_id: int) -> dict:
    """
    Returns all DeathCertificates associated with death registrations where
    the authenticated Citizen is the informant.

    Filters out DeathRecords that have no linked death_certificate (i.e. not yet approved).

    Args:
        user_id: SystemUser ID of the authenticated Citizen.

    Returns:
        Dict with details and serialised certificate list (or empty list).
    """
    death_records = DeathRecords.objects.filter(
        informant_id=user_id
    ).exclude(death_certificate_id__isnull=True)

    if death_records:
        certificates = [dr.death_certificate for dr in death_records if dr.death_certificate]
        serializer = DeathCertificateSerializer(certificates, many=True)
        return {"details": "Death Certificates Found", "certificates": serializer.data}
    else:
        return {"details": "No Death Certificates Found", "certificates": []}