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
import hashlib
import os
from datetime import date, datetime, timezone
import secrets

from django.db import models, transaction
from fastapi import HTTPException, status
from Utils.audit_logger import audit
#from Utils.certificate_generator import generate_certificate
from admin_ops.models import SystemUser
from citizens.models import Citizen, CitizenStatus
from citizens.serializer import CitizenSerializer
from citizens.utilities.id_generation import generate_id, child_seed_generation
from hospital.Utils.mccd_generator import generate_mccd
from hospital.Utils.notice_of_death_generator import generate_notice_of_death
from hospital.Utils.birth_certificate_generator import generate_certificate
from hospital.Utils.notice_of_birth_generator import generate_notice_of_birth
from hospital.Utils.record_of_birth_generator import generate_record_of_birth
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
    request_body["medical_no"] = f"MED-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}{secrets.token_hex(3).upper()}"
    if not request_body.get("witness_date"):
        request_body["witness_date"] = datetime.now(timezone.utc)

    informant_din = request_body.get("informant_din")

    if not informant_din:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Informant Din is required",
        )

    # Resolve informant's DIN to a Citizen record
    informant = Citizen.objects.filter(din=informant_din.upper().strip()).first()

    if not informant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Citizen with DIN '{informant_din}' not found")

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
        informant_sys = SystemUser.objects.get(profile=informant)
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

    notice_of_death_url = f'http://localhost:3000/submit-notice/{informant_sys.id}'

    audit.death_record_submitted(health_worker_id, death_records.id)

    return {
        "details": "MCCD Submitted",
        "notice_of_death_url": death_records.id,
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
            "informant"
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

    # Fetch the linked MCCD to auto-populate Section B (cause of death) fields
    mccd = death_records.medical_certificate_of_death
    if not mccd:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No MCCD linked to this death record. MCCD must be submitted first.",
        )

    # Resolve the authenticated Citizen instance via the linked DIN on the informant field.
    # The informant is already validated to be the same as death_records.informant.
    try:
        informant = Citizen.objects.get(din=death_records.informant.din)
    except Citizen.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Informant Citizen record not found in registry",
        )

    deceased_din = request_body.get("deceased_din")

    enriched_data = request_body.copy()
    # Auto-generate unique serial_number and application_no
    import hashlib
    from citizens.utilities.id_generation import generate_id
    
    def _seed(s: str) -> bytes:
        return hashlib.sha256(s.encode()).digest()
    
    enriched_data["serial_number"] = generate_id(_seed(f"nod_{death_record_id}"), "NOD")
    enriched_data["application_no"] = generate_id(_seed(f"death_app_{death_record_id}"), "DEATH_APP")

    # Auto-populate Section A (Details of Deceased) from MCCD
    enriched_data["place_of_death"]      = "HEALTH_FACILITY"
    enriched_data["date_of_death"]       = mccd.death_date
    hw_profile = getattr(death_records.health_worker, 'health_worker_profile', None)
    enriched_data["place_of_death_name"] = hw_profile.facility_name if hw_profile else ""
    enriched_data["place_of_death_other"] = None
    import re as _re
    _age_match = _re.search(r'\d+', mccd.age_stated or "")
    enriched_data["age_at_death"] = int(_age_match.group()) if _age_match else None
    
    # Required fields: use request body or MCCD data as fallback
    enriched_data["date_and_time"] = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    # Try to resolve from deceased Citizen if deceased_din provided
    if deceased_din:
        try:
            deceased_citizen = Citizen.objects.get(din=deceased_din)
            # Fill any missing fields from Citizen record
            if not enriched_data.get("surname"):
                enriched_data["surname"] = deceased_citizen.full_name.split()[-1] if deceased_citizen.full_name else ""
            if not enriched_data.get("other_names"):
                enriched_data["other_names"] = " ".join(deceased_citizen.full_name.split()[:-1]) if deceased_citizen.full_name else ""
            if not enriched_data.get("occupation"):
                enriched_data["occupation"] = deceased_citizen.occupation
            if not enriched_data.get("residential_address"):
                enriched_data["residential_address"] = deceased_citizen.residential_address
            if not enriched_data.get("date_of_birth"):
                enriched_data["date_of_birth"] = deceased_citizen.dob
            if not enriched_data.get("sex"):
                enriched_data["sex"] = deceased_citizen.sex
            if not enriched_data.get("nationality"):
                enriched_data["nationality"] = deceased_citizen.nationality
            if not enriched_data.get("national_identity_no"):
                enriched_data["national_identity_no"] = deceased_citizen.nrc
            if not enriched_data.get("social_security_no"):
                enriched_data["social_security_no"] = deceased_citizen.social_id
            if not enriched_data.get("education_level"):
                enriched_data["education_level"] = deceased_citizen.education_level
        except Citizen.DoesNotExist:
            pass
    
    # Use MCCD data for name if still not provided
    if not enriched_data.get("surname") and mccd.attended_name:
        enriched_data["surname"] = mccd.attended_name.split()[-1]
    if not enriched_data.get("other_names") and mccd.attended_name:
        enriched_data["other_names"] = " ".join(mccd.attended_name.split()[:-1])
    
    # Ensure required fields have values with NIL fallback
    if not enriched_data.get("sex"):
        enriched_data["sex"] = "MALE"
    
    # Set NIL as fallback for optional fields not provided (excluding choice fields)
    nil_fields = ["occupation", "residential_address", "nationality", "national_identity_no", "social_security_no"]
    for field in nil_fields:
        if not enriched_data.get(field):
            enriched_data[field] = "NIL"

    # Auto-populate Section B (Cause of Death) from MCCD
    enriched_data["immediate_cause"]         = mccd.cause_a or ""
    enriched_data["immediate_cause_icd"]     = mccd.cause_a_icd_code or ""
    enriched_data["antecedent_cause"]        = mccd.cause_b or ""
    enriched_data["antecedent_cause_icd"]    = mccd.cause_b_icd_code or ""
    enriched_data["underlying_cause"]        = mccd.cause_c or ""
    enriched_data["underlying_cause_icd"]    = mccd.cause_c_icd_code or ""

    # Auto-populate Section C (Police / Brought-in-Dead) from Section A and MCCD
    enriched_data["deceased_surname_police"]     = enriched_data.get("surname", "")
    enriched_data["deceased_other_names_police"] = enriched_data.get("other_names", "")
    enriched_data["deceased_age_police"]         = enriched_data.get("age_at_death")
    enriched_data["passed_away_date"]            = enriched_data.get("date_of_death")
    enriched_data["passed_away_time"]            = mccd.death_time
    enriched_data["passed_away_place"]           = enriched_data.get("place_of_death_name", "")
    enriched_data["suddenly_suffering_from"]     = mccd.cause_a or ""
    enriched_data["treatment_was_at"]            = enriched_data.get("place_of_death_name", "")

    # Auto-set Section C sign-off and doctor remarks to None
    enriched_data["police_certifier_name"]             = None
    enriched_data["police_certifier_residence"]        = None
    enriched_data["police_certifier_relationship"]     = None
    enriched_data["is_natural_death"]                  = None
    enriched_data["is_sudden_death_postmortem_required"] = None
    enriched_data["police_no_and_rank"]                = None
    enriched_data["police_formation"]                  = None
    enriched_data["police_officer_name"]               = None
    enriched_data["police_officer_signed"]             = None
    enriched_data["police_officer_date"]               = None
    enriched_data["doctors_remarks"]                   = None
    enriched_data["pupils_dilated_and_fixed"]          = None
    enriched_data["certifying_doctor_name"]            = None
    enriched_data["certifying_doctor_signature"]       = None
    enriched_data["certifying_doctor_date"]            = None

    # Auto-populate Section E (Appendices checklist) and Informant's Declaration
    enriched_data["has_mccd"] = True
    enriched_data["has_informant_national_id"] = bool(informant.nrc)
    death_type = request_body.get("death_type", "")
    enriched_data["has_coroner_report"] = death_type in ("SUDDEN", "UNNATURAL")
    enriched_data["informant_declaration_name"]      = informant.full_name
    enriched_data["informant_declaration_signature"] = None
    enriched_data["informant_declaration_date"]      = date.today()

    # Auto-populate Section D (Informant Details) from authenticated Citizen
    enriched_data["informant_surname"]            = informant.full_name.split()[-1] if informant.full_name else ""
    enriched_data["informant_other_names"]        = " ".join(informant.full_name.split()[:-1]) if informant.full_name else ""
    enriched_data["informant_contact_no"]         = informant.phone
    enriched_data["informant_national_id"]        = informant.nrc
    enriched_data["informant_nationality"]        = informant.nationality
    enriched_data["informant_residential_address"] = informant.residential_address
    enriched_data["informant_postal_address"]     = (
        getattr(informant, 'postal_address', None) or informant.residential_address
    )
    enriched_data["date_of_registration"]         = date.today()

    # Remove sentinel DIN fields
    enriched_data.pop("informant_din", None)
    enriched_data.pop("deceased_din", None)

    # Auto-populate Section A from Citizen if deceased_din resolves
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
            "serial_number":  f'NB-{secrets.token_hex(4).upper()}', # Auto generated
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

        # Set NIL as fallback for optional fields not provided (excluding choice fields)
        nil_fields = [
            "father_village_of_origin", "father_chief", "father_district", "father_tribe",
            "father_national_id", "father_occupation", "father_social_id", "father_nationality",
        ]
        for field in nil_fields:
            if not notice_data.get(field):
                notice_data[field] = "NIL"

        notice_serializer = NoticeOfBirthSerializer(data=notice_data)
        if not notice_serializer.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=notice_serializer.errors,
            )
        notice_of_birth = notice_serializer.save()

        notif_time = request_body.get("date_and_time_of_birth_notification")
        parsed_time_string = None

        if notif_time:
            try:
                if isinstance(notif_time, datetime):
                    dt_obj = notif_time
                else:
                    dt_obj = datetime.fromisoformat(str(notif_time).replace('Z', '+00:00'))

                parsed_time_string = dt_obj.strftime("%H:%M")

            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid timestamp format: {notif_time}"
                )

        # --- 5. Build RecordOfBirth data dict ---
        # The Record of Birth (M.F.2) is the condensed facility summary form.
        record_data = {
            "serial_number":   f'RB-{secrets.token_hex(4).upper()}',
            "file_number":     request_body.get("file_number"),
            "place_of_birth":  request_body.get("place_of_birth"),
            "child_surname":   request_body.get("child_surname"),
            "child_other_names": request_body.get("child_other_names"),
            "sex":             request_body.get("sex"),
            "birth_weight_kg": request_body.get("birth_weight_kg"),
            "date_of_birth":   request_body.get("date_of_birth"),
            "time_of_birth":   parsed_time_string,
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

        # Set NIL as fallback for optional fields not provided
        if not record_data.get("father_name"):
            record_data["father_name"] = "NIL"
        if not record_data.get("father_occupation"):
            record_data["father_occupation"] = "NIL"
        if not record_data.get("father_present_address"):
            record_data["father_present_address"] = "NIL"

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

    def get_user_display(user: SystemUser) -> str:
        """
        Safely get a display name from any SystemUser, regardless of profile type.
        Priority: Citizen.full_name → SystemUser.first_name+last_name → username
        """
        # Try Citizen profile first (has full_name)
        citizen_profile = getattr(user, "profile", None)
        if citizen_profile and citizen_profile.full_name:
            return citizen_profile.full_name

        # Fallback to SystemUser fields for staff users
        name_parts = [user.first_name, user.last_name]
        full_name = " ".join(part for part in name_parts if part).strip()
        return full_name or user.username or "Unknown"

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
    def _seed(s: str) -> bytes:
        return hashlib.sha256(s.encode()).digest()
    
    death_cert_no = generate_id(_seed(f"death_{request_id}"), "DEATH_CERT")

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
        "date_of_registration":   date.today(),
        "register_kept_at":       f"{notice.district} District Registry",
        "issued_date":            date.today(),
        "registrar_general_name": "Registrar",
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
        "issued_date":      date.today(),
        "authorised_by_name": "Registrar",
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
    """

    # ── Helper: Safe name resolver for any SystemUser profile type ──
    def get_user_display_name(user: SystemUser) -> str:
        """
        Safely get a display name from any SystemUser, regardless of profile type.
        Priority: Citizen.full_name → SystemUser.first_name+last_name → username
        """
        # Try Citizen profile first (has full_name)
        citizen_profile = getattr(user, "profile", None)
        if citizen_profile and citizen_profile.full_name:
            return citizen_profile.full_name

        # Fallback to SystemUser fields for staff users
        name_parts = [user.first_name, user.last_name]
        full_name = " ".join(part for part in name_parts if part).strip()
        return full_name or user.username or "Unknown"

    # ──────────────────────────────────────────────────────────────

    # Verify the registrar account exists (no select_related on profile - not all users have one)
    try:
        registrar = SystemUser.objects.select_related("profile").get(id=registrar_id)
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

    # Both sub-documents are required
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
        or notice_of_birth.place_of_birth
        or "Unknown"
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

        # Resolve SystemUser accounts for the mother and father (for certificate FK linking)
        mother_system_user = None
        father_system_user = None

        if mother:
            try:
                mother_system_user = SystemUser.objects.select_related(
                    "profile"
                ).get(profile=mother)
            except SystemUser.DoesNotExist:
                pass  # Certificate can still be created; FK will be null

        if father:
            try:
                father_system_user = SystemUser.objects.get(profile=father)
            except SystemUser.DoesNotExist:
                pass

        mother_citizen = mother_system_user.profile if mother_system_user else None  # Used for informant address on the certificate

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
            informant_address=mother_citizen.residential_address if mother_citizen else " ",
            postal_address=" ",
            date_of_registration=submission_request.submitted_at.date(),
            registrar_name=registrar.profile.full_name,
        )

        # Update the BirthRecords submission to APPROVED and link the new certificate
        record_submission_serializer = BirthRecordRequestSerializer(
            instance=submission_request,
            data={
                "status":            RecordStatus.APPROVED,
                "registrar":         registrar_id,
                "reviewed_at":       datetime.now(),
                "birth_certificate": birth_certificate.id,
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
        citizen_serializer = CitizenSerializer(
            data={
                "din": child_id,
                "full_name": child_full_name,
                "dob": child_dob,
                "status": CitizenStatus.INACTIVE,
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
        "details": "Approval Successful",
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
                "reviewed_at":      datetime.now(),
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


def get_all_approved_births_records():
    """
    Returns only APPROVED BirthRecords submissions.

    Filters the BirthRecords queryset to return only submissions that have
    successfully passed Registrar review and been marked as APPROVED.
    This is the primary source for generating approved-certificate reports
    and for populating the citizen-facing certificate retrieval endpoints.

    Returns:
        Dict with details and serialised record list.
        Empty list if no approved records exist.
    """
    records = BirthRecords.objects.filter(status=RecordStatus.APPROVED)
    serializer = BirthRecordRequestSerializer(records, many=True)
    if serializer.data:
        return {"details": "Approved Records Found", "records": serializer.data}
    else:
        return {"details": "No Approved Records Found", "records": serializer.data}


def get_all_death_records():
    """Returns all DeathRecords submissions regardless of status."""
    records = DeathRecords.objects.all()
    serializer = DeathRecordRequestSerializer(records, many=True)
    if serializer.data:
        return {"details": "Records Found", "records": serializer.data}
    else:
        return {"details": "No Records Found", "records": serializer.data}


def get_all_approved_death_records():
    """
    Returns only APPROVED DeathRecords submissions.

    Filters the DeathRecords queryset to return only submissions that have
    successfully passed Registrar review and been marked as APPROVED.
    Approved death records have associated DeathCertificate and BurialPermit
    records generated at approval time.

    Returns:
        Dict with details and serialised record list.
        Empty list if no approved records exist.
    """
    records = DeathRecords.objects.filter(status=RegistrationStatusChoices.APPROVED)
    serializer = DeathRecordRequestSerializer(records, many=True)
    if serializer.data:
        return {"details": "Approved Records Found", "records": serializer.data}
    else:
        return {"details": "No Approved Records Found", "records": serializer.data}


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


# ============================================================================
# BIRTH RECORD REVIEW — Generate PDFs on Demand
# ============================================================================

def review_birth_record(birth_records_id: int) -> dict:
    """
    Fetches a BirthRecords entry, validates that both NoticeOfBirth and
    RecordOfBirth are attached, generates PDFs for each document, and
    returns the file paths for streaming.

    Steps:
        1. Fetch BirthRecords with related documents.
        2. Validate both NoticeOfBirth and RecordOfBirth exist.
        3. Build payloads from model instances.
        4. Call respective generators to create PDFs.
        5. Return paths to generated PDFs.

    Args:
        birth_records_id: PK of the BirthRecords submission.

    Returns:
        Dict with notice_of_birth_pdf and record_of_birth_pdf paths.

    Raises:
        HTTPException 404 — BirthRecords not found.
        HTTPException 400 — Missing NoticeOfBirth or RecordOfBirth.
    """
    try:
        birth_records = (
            BirthRecords.objects
            .select_related("notice_of_birth", "record_of_birth")
            .get(id=birth_records_id)
        )
    except BirthRecords.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Birth record not found",
        )

    notice_of_birth = birth_records.notice_of_birth
    record_of_birth = birth_records.record_of_birth

    missing_docs = []
    if not notice_of_birth:
        missing_docs.append("Notice of Birth")
    if not record_of_birth:
        missing_docs.append("Record of Birth")

    if missing_docs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required documents: {', '.join(missing_docs)}",
        )



    output_dir = os.path.join(os.path.dirname(__file__), "..", "..", "media", "generated_pdfs")
    os.makedirs(output_dir, exist_ok=True)

    notice_payload = {
        "form_serial_no": notice_of_birth.serial_number,
        "serial_no": notice_of_birth.serial_number,
        "district": notice_of_birth.district,
        "date_and_time": str(notice_of_birth.date_and_time) if notice_of_birth.date_and_time else "",
        "date_of_birth": str(notice_of_birth.date_of_birth),
        "place_of_birth": notice_of_birth.place_of_birth or "HEALTH_FACILITY",
        "health_facility_name": notice_of_birth.health_facility_name or "",
        "home_address": notice_of_birth.home_address or "",
        "other_specify": notice_of_birth.other_place_specified or "",
        "child_surname": notice_of_birth.child_surname,
        "child_given_name": notice_of_birth.child_given_name,
        "child_other_names": notice_of_birth.child_other_names or "",
        "birth_weight": str(notice_of_birth.birth_weight_kg),
        "sex": notice_of_birth.sex,
        "father_surname": notice_of_birth.father_surname or "",
        "father_other_names": notice_of_birth.father_other_names or "",
        "father_dob": str(notice_of_birth.father_dob) if notice_of_birth.father_dob else "",
        "father_national_id": notice_of_birth.father_national_id or "",
        "father_occupation": notice_of_birth.father_occupation or "",
        "father_social_id": notice_of_birth.father_social_id or "",
        "father_village": notice_of_birth.father_village_of_origin or "",
        "father_chief": notice_of_birth.father_chief or "",
        "father_district": notice_of_birth.father_district or "",
        "father_tribe": notice_of_birth.father_tribe or "",
        "father_nationality": notice_of_birth.father_nationality or "",
        "father_residential_address": notice_of_birth.father_residential_address or "",
        "father_contact_no": notice_of_birth.father_contact_no or "",
        "mother_surname": notice_of_birth.mother_surname,
        "mother_other_names": notice_of_birth.mother_other_names or "",
        "mother_maiden_surname": notice_of_birth.mother_maiden_surname or "",
        "mother_dob": str(notice_of_birth.mother_dob) if notice_of_birth.mother_dob else "",
        "mother_national_id": notice_of_birth.mother_national_id or "",
        "mother_nationality": notice_of_birth.mother_nationality or "",
        "mother_occupation": notice_of_birth.mother_occupation or "",
        "mother_social_id": notice_of_birth.mother_social_id or "",
        "mother_village": notice_of_birth.mother_village_of_origin or "",
        "mother_chief": notice_of_birth.mother_chief or "",
        "mother_district": notice_of_birth.mother_district or "",
        "mother_tribe": notice_of_birth.mother_tribe or "",
        "mother_education": notice_of_birth.mother_education or "",
        "mother_residential_address": notice_of_birth.mother_residential_address or "",
        "mother_usual_residence": notice_of_birth.mother_usual_place_of_residence or "",
        "attendant_type": notice_of_birth.attendant_at_birth or "",
        "attendant_other": notice_of_birth.attendant_other_specified or "",
        "marital_status": notice_of_birth.marital_status or "",
        "father_acknowledgement_name": "",
        "father_acknowledgement_date": str(notice_of_birth.father_acknowledgement_date) if notice_of_birth.father_acknowledgement_date else "",
        "mother_consent_name": "",
        "mother_consent_date": str(notice_of_birth.mother_consent_date) if notice_of_birth.mother_consent_date else "",
    }

    record_payload = {
        "serial_number": record_of_birth.serial_number,
        "place_of_birth": record_of_birth.place_of_birth,
        "file_number": record_of_birth.file_number or "",
        "child_surname": record_of_birth.child_surname,
        "sex": record_of_birth.sex,
        "child_other_names": record_of_birth.child_other_names or "",
        "birth_weight_kg": str(record_of_birth.birth_weight_kg),
        "date_of_birth": str(record_of_birth.date_of_birth),
        "time_of_birth": str(record_of_birth.time_of_birth),
        "father_name": record_of_birth.father_name or "",
        "father_occupation": record_of_birth.father_occupation or "",
        "father_address": record_of_birth.father_present_address or "",
        "mother_name": record_of_birth.mother_name,
        "officer_in_charge": record_of_birth.officer_in_charge or "",
        "date_signed": str(record_of_birth.date_signed) if record_of_birth.date_signed else "",
    }

    notice_pdf_path = os.path.join(output_dir, f"notice_of_birth_{birth_records_id}.pdf")
    record_pdf_path = os.path.join(output_dir, f"record_of_birth_{birth_records_id}.pdf")

    generate_notice_of_birth(notice_payload, notice_pdf_path)
    generate_record_of_birth(record_payload, record_pdf_path)

    return {
        "notice_of_birth_pdf": notice_pdf_path,
        "record_of_birth_pdf": record_pdf_path,
        "birth_records_id": birth_records_id,
    }


# ============================================================================
# BIRTH CERTIFICATE REVIEW — Generate PDF on Demand
# ============================================================================

def view_birth_certificate(birth_records_id: int) -> dict:
    """
    Fetches a BirthRecords entry with its linked BirthCertificate,
    validates it exists, generates the Birth Certificate PDF, and
    returns the file path for streaming.

    Steps:
        1. Fetch BirthRecords with related documents.
        2. Validate BirthCertificate exists.
        3. Build payload from BirthCertificate instance.
        4. Call certificate generator to create PDF.
        5. Return path to generated PDF.

    Args:
        birth_records_id: PK of the BirthRecords submission.

    Returns:
        Dict with birth_certificate_pdf path.

    Raises:
        HTTPException 404 — BirthRecords not found.
        HTTPException 400 — BirthCertificate not yet generated.
    """
    try:
        birth_records = (
            BirthRecords.objects
            .select_related("notice_of_birth", "birth_certificate")
            .get(id=birth_records_id)
        )
    except BirthRecords.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Birth record not found",
        )

    birth_certificate = birth_records.birth_certificate

    if not birth_certificate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Birth Certificate has not been generated yet. Please approve the record first.",
        )




    output_dir = os.path.join(os.path.dirname(__file__), "..", "..", "media", "generated_pdfs")
    os.makedirs(output_dir, exist_ok=True)

    cert_payload = {
        "reg_no": birth_certificate.reg_no,
        "district": birth_certificate.district,
        "date_of_birth": str(birth_certificate.date_of_birth),
        "sex": birth_certificate.sex,
        "place_of_birth": birth_certificate.place_of_birth,
        "surname": birth_certificate.surname,
        "other_names": birth_certificate.other_names or "",
        "father_name": birth_certificate.father_name or "",
        "father_occupation": birth_certificate.father_occupation or "",
        "father_nssf": birth_certificate.father_nssf or "",
        "father_nationality": birth_certificate.father_nationality or "",
        "father_nid": birth_certificate.father_nid or "",
        "mother_name": birth_certificate.mother_name,
        "mother_maiden": birth_certificate.mother_maiden or "",
        "mother_nssf": birth_certificate.mother_nssf or "",
        "mother_nationality": birth_certificate.mother_nationality or "",
        "mother_nid": birth_certificate.mother_nid or "",
        "informant_name": birth_certificate.informant_name or "",
        "informant_address": birth_certificate.informant_address or "",
        "postal_address": birth_certificate.postal_address or "",
        "date_of_registration": str(birth_certificate.date_of_registration),
        "registrar_name": birth_certificate.registrar_name,
    }

    cert_pdf_path = os.path.join(output_dir, f"birth_certificate_{birth_records_id}.pdf")

    generate_certificate(cert_payload, cert_pdf_path)

    return {
        "birth_certificate_pdf": cert_pdf_path,
        "birth_records_id": birth_records_id,
    }


def review_all_approved_birth_documents(birth_records_id: int) -> dict:
    """
    Fetches an APPROVED BirthRecords entry and generates PDFs for all
    three birth pipeline documents: Birth Certificate, Notice of Birth,
    and Record of Birth.

    This is the comprehensive post-approval document retrieval service for
    birth records. It combines the functionality of view_birth_certificate()
    (which generates the Birth Certificate) with review_birth_record()
    (which generates the Notice of Birth and Record of Birth) into a single
    call that returns the complete document pack.

    Pipeline context:
        The birth registration workflow consists of three official documents:
          1. Notice of Birth (Form VIII, Rules 16-23) — Created by the Health
             Worker at submission; contains full parental details, child
             particulars, attendant information, and paternity acknowledgement
             fields for unmarried parents.
          2. Record of Birth (M.F.2) — Facility summary form created alongside
             the Notice of Birth; signed off by the officer in charge and used
             for the official facility register.
          3. Birth Certificate (Reg-Gen Form No. IV, Rule 5) — Generated at
             approval from the data in docs 1 & 2; the legal proof of birth
             issued by the Registrar-General. Contains child details, both
             parents' information, and registration metadata.

        Documents 1 and 2 exist from the submission phase and are reviewed by
        the Registrar before approval. Document 3 is created during the approval
        step and stored as a BirthCertificate model instance. This service
        generates PDFs for all three documents on-demand from their respective
        model data.

    Steps:
        1. Fetch BirthRecords with all three related documents via select_related
           (single SQL query with three JOINs — no N+1 queries).
        2. Validate status is APPROVED — rejects PENDING/REJECTED records since
           the Birth Certificate only exists after approval.
        3. Validate all three document FKs are populated (Defensive: an approved
           record should always have all three, but we guard against corruption).
        4. Build the Birth Certificate payload from the BirthCertificate model,
           mapping all child, parent, informant, and registration fields.
        5. Build the Notice of Birth payload from the NoticeOfBirth model,
           including full parental details (tribe, chief, village, NAPSA, NRC),
           attendant information, and paternity acknowledgement fields.
        6. Build the Record of Birth payload from the RecordOfBirth model,
           capturing the condensed facility record data.
        7. Call all three generators to produce PDFs in media/generated_pdfs/.
        8. Return dict with all three file paths and the birth_records_id.

    Args:
        birth_records_id: PK of the BirthRecords submission.

    Returns:
        Dict with keys:
            - birth_certificate_pdf: str — path to the Birth Certificate PDF.
            - notice_of_birth_pdf: str — path to the Notice of Birth (Form VIII) PDF.
            - record_of_birth_pdf: str — path to the Record of Birth (M.F.2) PDF.
            - birth_records_id: int — the original submission ID.

    Raises:
        HTTPException 404 — BirthRecords with the given ID does not exist.
        HTTPException 409 — BirthRecords status is not APPROVED. The full
            document pack is only available after Registrar approval because
            the Birth Certificate is generated at that stage.
        HTTPException 400 — Any of the three required document FKs is null.
            Lists which specific documents are missing in the error detail.
    """
    try:
        birth_records = (
            BirthRecords.objects
            .select_related(
                "birth_certificate",
                "notice_of_birth",
                "record_of_birth",
            )
            .get(id=birth_records_id)
        )
    except BirthRecords.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Birth record not found",
        )

    if birth_records.status != RecordStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Full document pack is only available after approval",
        )

    birth_certificate = birth_records.birth_certificate
    notice_of_birth = birth_records.notice_of_birth
    record_of_birth = birth_records.record_of_birth

    missing_docs = []
    if not birth_certificate:
        missing_docs.append("Birth Certificate")
    if not notice_of_birth:
        missing_docs.append("Notice of Birth")
    if not record_of_birth:
        missing_docs.append("Record of Birth")

    if missing_docs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required documents: {', '.join(missing_docs)}",
        )

    from hospital.Utils.birth_certificate_generator import generate_certificate
    from hospital.Utils.notice_of_birth_generator import generate_notice_of_birth
    from hospital.Utils.record_of_birth_generator import generate_record_of_birth

    output_dir = os.path.join(os.path.dirname(__file__), "..", "..", "media", "generated_pdfs")
    os.makedirs(output_dir, exist_ok=True)

    # --- Birth Certificate payload ---
    cert_payload = {
        "reg_no": birth_certificate.reg_no,
        "district": birth_certificate.district,
        "date_of_birth": str(birth_certificate.date_of_birth),
        "sex": birth_certificate.sex,
        "place_of_birth": birth_certificate.place_of_birth,
        "surname": birth_certificate.surname,
        "other_names": birth_certificate.other_names or "",
        "father_name": birth_certificate.father_name or "",
        "father_occupation": birth_certificate.father_occupation or "",
        "father_nssf": birth_certificate.father_nssf or "",
        "father_nationality": birth_certificate.father_nationality or "",
        "father_nid": birth_certificate.father_nid or "",
        "mother_name": birth_certificate.mother_name,
        "mother_maiden": birth_certificate.mother_maiden or "",
        "mother_nssf": birth_certificate.mother_nssf or "",
        "mother_nationality": birth_certificate.mother_nationality or "",
        "mother_nid": birth_certificate.mother_nid or "",
        "informant_name": birth_certificate.informant_name or "",
        "informant_address": birth_certificate.informant_address or "",
        "postal_address": birth_certificate.postal_address or "",
        "date_of_registration": str(birth_certificate.date_of_registration),
        "registrar_name": birth_certificate.registrar_name,
    }

    # --- Notice of Birth payload ---
    notice_payload = {
        "form_serial_no": notice_of_birth.serial_number,
        "serial_no": notice_of_birth.serial_number,
        "district": notice_of_birth.district,
        "date_and_time": str(notice_of_birth.date_and_time) if notice_of_birth.date_and_time else "",
        "date_of_birth": str(notice_of_birth.date_of_birth),
        "place_of_birth": notice_of_birth.place_of_birth or "HEALTH_FACILITY",
        "health_facility_name": notice_of_birth.health_facility_name or "",
        "home_address": notice_of_birth.home_address or "",
        "other_specify": notice_of_birth.other_place_specified or "",
        "child_surname": notice_of_birth.child_surname,
        "child_given_name": notice_of_birth.child_given_name,
        "child_other_names": notice_of_birth.child_other_names or "",
        "birth_weight": str(notice_of_birth.birth_weight_kg),
        "sex": notice_of_birth.sex,
        "father_surname": notice_of_birth.father_surname or "",
        "father_other_names": notice_of_birth.father_other_names or "",
        "father_dob": str(notice_of_birth.father_dob) if notice_of_birth.father_dob else "",
        "father_national_id": notice_of_birth.father_national_id or "",
        "father_occupation": notice_of_birth.father_occupation or "",
        "father_social_id": notice_of_birth.father_social_id or "",
        "father_village": notice_of_birth.father_village_of_origin or "",
        "father_chief": notice_of_birth.father_chief or "",
        "father_district": notice_of_birth.father_district or "",
        "father_tribe": notice_of_birth.father_tribe or "",
        "father_nationality": notice_of_birth.father_nationality or "",
        "father_residential_address": notice_of_birth.father_residential_address or "",
        "father_contact_no": notice_of_birth.father_contact_no or "",
        "mother_surname": notice_of_birth.mother_surname,
        "mother_other_names": notice_of_birth.mother_other_names or "",
        "mother_maiden_surname": notice_of_birth.mother_maiden_surname or "",
        "mother_dob": str(notice_of_birth.mother_dob) if notice_of_birth.mother_dob else "",
        "mother_national_id": notice_of_birth.mother_national_id or "",
        "mother_nationality": notice_of_birth.mother_nationality or "",
        "mother_occupation": notice_of_birth.mother_occupation or "",
        "mother_social_id": notice_of_birth.mother_social_id or "",
        "mother_village": notice_of_birth.mother_village_of_origin or "",
        "mother_chief": notice_of_birth.mother_chief or "",
        "mother_district": notice_of_birth.mother_district or "",
        "mother_tribe": notice_of_birth.mother_tribe or "",
        "mother_education": notice_of_birth.mother_education or "",
        "mother_residential_address": notice_of_birth.mother_residential_address or "",
        "mother_usual_residence": notice_of_birth.mother_usual_place_of_residence or "",
        "attendant_type": notice_of_birth.attendant_at_birth or "",
        "attendant_other": notice_of_birth.attendant_other_specified or "",
        "marital_status": notice_of_birth.marital_status or "",
        "father_acknowledgement_name": "",
        "father_acknowledgement_date": str(notice_of_birth.father_acknowledgement_date) if notice_of_birth.father_acknowledgement_date else "",
        "mother_consent_name": "",
        "mother_consent_date": str(notice_of_birth.mother_consent_date) if notice_of_birth.mother_consent_date else "",
    }

    # --- Record of Birth payload ---
    record_payload = {
        "serial_number": record_of_birth.serial_number,
        "place_of_birth": record_of_birth.place_of_birth,
        "file_number": record_of_birth.file_number or "",
        "child_surname": record_of_birth.child_surname,
        "sex": record_of_birth.sex,
        "child_other_names": record_of_birth.child_other_names or "",
        "birth_weight_kg": str(record_of_birth.birth_weight_kg),
        "date_of_birth": str(record_of_birth.date_of_birth),
        "time_of_birth": str(record_of_birth.time_of_birth),
        "father_name": record_of_birth.father_name or "",
        "father_occupation": record_of_birth.father_occupation or "",
        "father_address": record_of_birth.father_present_address or "",
        "mother_name": record_of_birth.mother_name,
        "officer_in_charge": record_of_birth.officer_in_charge or "",
        "date_signed": str(record_of_birth.date_signed) if record_of_birth.date_signed else "",
    }

    # --- Generate all three PDFs ---
    cert_pdf_path = os.path.join(output_dir, f"birth_certificate_{birth_records_id}.pdf")
    notice_pdf_path = os.path.join(output_dir, f"notice_of_birth_{birth_records_id}.pdf")
    record_pdf_path = os.path.join(output_dir, f"record_of_birth_{birth_records_id}.pdf")

    generate_certificate(cert_payload, cert_pdf_path)
    generate_notice_of_birth(notice_payload, notice_pdf_path)
    generate_record_of_birth(record_payload, record_pdf_path)

    return {
        "birth_certificate_pdf": cert_pdf_path,
        "notice_of_birth_pdf": notice_pdf_path,
        "record_of_birth_pdf": record_pdf_path,
        "birth_records_id": birth_records_id,
    }


# ============================================================================
# DEATH RECORD REVIEW — Generate MCCD and Notice of Death PDFs on Demand
# ============================================================================

def review_death_documents(death_records_id: int) -> dict:
    """
    Fetches a DeathRecords entry, validates that both
    MedicalCertificateCauseOfDeath and NoticeOfDeath are attached,
    generates PDFs for each document, and returns the file paths.

    Steps:
        1. Fetch DeathRecords with related documents.
        2. Validate both MCCD and NoticeOfDeath exist.
        3. Build payloads from model instances.
        4. Call respective generators to create PDFs.
        5. Return paths to generated PDFs.

    Args:
        death_records_id: PK of the DeathRecords submission.

    Returns:
        Dict with mccd_pdf and notice_of_death_pdf paths.

    Raises:
        HTTPException 404 — DeathRecords not found.
        HTTPException 400 — Missing MCCD or NoticeOfDeath.
    """
    try:
        death_records = (
            DeathRecords.objects
            .select_related("medical_certificate_of_death", "notice_of_death")
            .get(id=death_records_id)
        )
    except DeathRecords.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Death record not found",
        )

    mccd = death_records.medical_certificate_of_death
    notice_of_death = death_records.notice_of_death

    missing_docs = []
    if not mccd:
        missing_docs.append("Medical Certificate of Cause of Death (MCCD)")
    if not notice_of_death:
        missing_docs.append("Notice of Death")

    if missing_docs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required documents: {', '.join(missing_docs)}",
        )



    output_dir = os.path.join(os.path.dirname(__file__), "..", "..", "media", "generated_pdfs")
    os.makedirs(output_dir, exist_ok=True)

    mccd_payload = {
        "medical_no": mccd.medical_no,
        "attended_name": mccd.attended_name,
        "during": "",
        "illness_start_date": str(mccd.illness_start_date),
        "age_stated": mccd.age_stated,
        "last_attended_alive_date": str(mccd.last_attended_alive_date),
        "last_attended_alive_day": str(mccd.last_attended_alive_day),
        "last_attended_alive_month": "",
        "last_attended_alive_year": "",
        "death_day": str(mccd.death_day),
        "death_date": str(mccd.death_date),
        "death_month": "",
        "death_year": str(mccd.death_year),
        "death_time": str(mccd.death_time) if mccd.death_time else "",
        "body_identified_of": mccd.body_identified_of,
        "postmortem_confirmed": mccd.postmortem_confirmed,
        "cause_a": mccd.cause_a or "",
        "cause_a_interval": mccd.cause_a_interval or "",
        "cause_a_icd_code": mccd.cause_a_icd_code or "",
        "cause_b": mccd.cause_b or "",
        "cause_b_interval": mccd.cause_b_interval or "",
        "cause_b_icd_code": mccd.cause_b_icd_code or "",
        "cause_c": mccd.cause_c or "",
        "cause_c_interval": mccd.cause_c_interval or "",
        "cause_c_icd_code": mccd.cause_c_icd_code or "",
        "other_condition_1": mccd.other_condition_1 or "",
        "other_condition_1_interval": mccd.other_condition_1_interval or "",
        "other_condition_2": mccd.other_condition_2 or "",
        "other_condition_2_interval": mccd.other_condition_2_interval or "",
        "witness_date": str(mccd.witness_date) if mccd.witness_date else "",
        "witness_month": "",
        "witness_year": "",
        "certificate_handed_to": mccd.certificate_handed_to,
        "medical_attendant_name": mccd.medical_attendant_name,
        "medical_attendant_signature": "",
        "medical_attendant_qualification": mccd.medical_attendant_qualification,
        "medical_attendant_residence": mccd.medical_attendant_residence,
        "village": mccd.village or "",
        "chief": mccd.chief or "",
        "district": mccd.district or "",
    }

    place_of_death = notice_of_death.place_of_death_name or notice_of_death.place_of_death_other or ""

    notice_payload = {
        "serial_number": notice_of_death.serial_number,
        "application_no": notice_of_death.application_no or "",
        "date_and_time": str(notice_of_death.date_and_time),
        "surname": notice_of_death.surname,
        "district": notice_of_death.district,
        "other_names": notice_of_death.other_names or "",
        "occupation": notice_of_death.occupation or "",
        "residential_address": notice_of_death.residential_address or "",
        "date_of_death": str(notice_of_death.date_of_death),
        "place_of_death": notice_of_death.place_of_death or "",
        "place_of_death_name": place_of_death,
        "date_of_birth": str(notice_of_death.date_of_birth) if notice_of_death.date_of_birth else "",
        "age_at_death": notice_of_death.age_at_death or "",
        "sex": notice_of_death.sex or "",
        "nationality": notice_of_death.nationality or "",
        "national_identity_no": notice_of_death.national_identity_no or "",
        "social_security_no": notice_of_death.social_security_no or "",
        "education_level": notice_of_death.education_level or "",
        "death_type": notice_of_death.death_type or "",
        "immediate_cause": notice_of_death.immediate_cause or "",
        "immediate_cause_icd": notice_of_death.immediate_cause_icd or "",
        "antecedent_cause": notice_of_death.antecedent_cause or "",
        "antecedent_cause_icd": notice_of_death.antecedent_cause_icd or "",
        "underlying_cause": notice_of_death.underlying_cause or "",
        "underlying_cause_icd": notice_of_death.underlying_cause_icd or "",
        "police_certifier_name": notice_of_death.police_certifier_name or "",
        "police_certifier_residence": notice_of_death.police_certifier_residence or "",
        "police_certifier_relationship": notice_of_death.police_certifier_relationship or "",
        "deceased_surname_police": notice_of_death.deceased_surname_police or "",
        "deceased_other_names_police": notice_of_death.deceased_other_names_police or "",
        "deceased_age_police": notice_of_death.deceased_age_police or "",
        "passed_away_date": str(notice_of_death.passed_away_date) if notice_of_death.passed_away_date else "",
        "passed_away_time": str(notice_of_death.passed_away_time) if notice_of_death.passed_away_time else "",
        "passed_away_place": notice_of_death.passed_away_place or "",
        "suddenly_suffering_from": notice_of_death.suddenly_suffering_from or "",
        "treatment_was_at": notice_of_death.treatment_was_at or "",
        "is_natural_death": notice_of_death.is_natural_death,
        "is_sudden_death_postmortem": notice_of_death.is_sudden_death_postmortem_required,
        "police_no_and_rank": notice_of_death.police_no_and_rank or "",
        "police_formation": notice_of_death.police_formation or "",
        "police_officer_name": notice_of_death.police_officer_name or "",
        "police_officer_date": str(notice_of_death.police_officer_date) if notice_of_death.police_officer_date else "",
        "doctors_remarks": notice_of_death.doctors_remarks or "",
        "pupils_dilated_and_fixed": notice_of_death.pupils_dilated_and_fixed,
        "certifying_doctor_name": notice_of_death.certifying_doctor_name or "",
        "certifying_doctor_date": str(notice_of_death.certifying_doctor_date) if notice_of_death.certifying_doctor_date else "",
        "informant_surname": notice_of_death.informant_surname,
        "informant_other_names": notice_of_death.informant_other_names or "",
        "informant_relationship": notice_of_death.informant_relationship or "",
        "informant_contact_no": notice_of_death.informant_contact_no or "",
        "informant_national_id": notice_of_death.informant_national_id or "",
        "informant_nationality": notice_of_death.informant_nationality or "",
        "informant_residential_address": notice_of_death.informant_residential_address or "",
        "informant_postal_address": notice_of_death.informant_postal_address or "",
        "date_of_registration": str(notice_of_death.date_of_registration) if notice_of_death.date_of_registration else "",
        "has_mccd": notice_of_death.has_mccd,
        "has_informant_national_id": notice_of_death.has_informant_national_id,
        "has_coroner_report": notice_of_death.has_coroner_report,
        "informant_declaration_name": notice_of_death.informant_declaration_name or "",
        "informant_declaration_date": str(notice_of_death.informant_declaration_date) if notice_of_death.informant_declaration_date else "",
        "assistant_registrar_name": notice_of_death.assistant_registrar_name or "",
        "registrar_name": notice_of_death.registrar_name or "",
    }

    mccd_pdf_path = os.path.join(output_dir, f"mccd_{death_records_id}.pdf")
    notice_pdf_path = os.path.join(output_dir, f"notice_of_death_{death_records_id}.pdf")

    generate_mccd(mccd_payload, mccd_pdf_path)
    generate_notice_of_death(notice_payload, notice_pdf_path)

    return {
        "mccd_pdf": mccd_pdf_path,
        "notice_of_death_pdf": notice_pdf_path,
        "death_records_id": death_records_id,
    }


def view_death_certificates(death_records_id: int) -> dict:
    """
    Fetches an APPROVED DeathRecords entry, validates that both
    DeathCertificate and BurialPermit are attached, generates PDFs
    for each document on-demand, and returns the file paths.

    This service is the post-approval certificate retrieval path for death
    records. Unlike the pre-approval review pipeline (which streams the MCCD
    and Notice of Death for Registrar review), this method only works after
    a Registrar has approved the submission and the system has created the
    DeathCertificate and BurialPermit model instances.

    Pipeline context:
        The death registration workflow produces four documents:
          1. MCCD (Medical Certificate of Cause of Death) — submitted by Health Worker
          2. Notice of Death (Form XI) — submitted by informant
          3. Death Certificate — generated at approval from docs 1 & 2
          4. Burial Permit (Form XI) — generated at approval from doc 2

        This function generates PDFs for documents 3 and 4 only.
        For documents 1 and 2, use review_death_documents() instead.

    Steps:
        1. Fetch DeathRecords with related DeathCertificate and BurialPermit
           via select_related (single SQL JOIN, no N+1 queries).
        2. Validate status is APPROVED — rejects PENDING/REJECTED records.
        3. Validate both DeathCertificate and BurialPermit FKs are populated.
        4. Build the death certificate payload from the DeathCertificate model,
           mapping all fields required by the death_certificate_generator.
        5. Build the burial permit payload from the BurialPermit model,
           extracting day/month/year components from the date_of_death field.
        6. Call generate_death_certificate() and generate_burial_permit() to
           produce PDFs in media/generated_pdfs/.
        7. Return dict with both file paths and the death_records_id.

    Args:
        death_records_id: PK of the DeathRecords submission.

    Returns:
        Dict with keys:
            - death_certificate_pdf: str — absolute path to the generated Death Certificate PDF.
            - burial_permit_pdf: str — absolute path to the generated Burial Permit PDF.
            - death_records_id: int — the original submission ID.

    Raises:
        HTTPException 404 — DeathRecords with the given ID does not exist.
        HTTPException 409 — DeathRecords status is not APPROVED (certificates
            are only issued after Registrar approval).
        HTTPException 400 — Either DeathCertificate or BurialPermit FK is null
            (should not happen for approved records, but guarded against).
    """
    try:
        death_records = (
            DeathRecords.objects
            .select_related("death_certificate", "burial_permit")
            .get(id=death_records_id)
        )
    except DeathRecords.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Death record not found",
        )

    if death_records.status != RegistrationStatusChoices.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Death record is not approved; certificates are only available after approval",
        )

    death_cert = death_records.death_certificate
    burial_permit = death_records.burial_permit

    missing_docs = []
    if not death_cert:
        missing_docs.append("Death Certificate")
    if not burial_permit:
        missing_docs.append("Burial Permit")

    if missing_docs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required documents: {', '.join(missing_docs)}",
        )

    from hospital.Utils.death_certificate_generator import generate_death_certificate
    from hospital.Utils.burial_permit_generator import generate_burial_permit

    output_dir = os.path.join(os.path.dirname(__file__), "..", "..", "media", "generated_pdfs")
    os.makedirs(output_dir, exist_ok=True)

    # Build Death Certificate payload from the approved certificate model.
    # All fields are copied directly — no derivation needed since the
    # certificate was already assembled during the approval step.
    death_cert_payload = {
        "registration_no":              death_cert.registration_no,
        "date_of_death":                str(death_cert.date_of_death),
        "district":                     death_cert.district,
        "place_of_death":               death_cert.place_of_death,
        "deceased_names_and_surname":   death_cert.deceased_names_and_surname,
        "sex":                          death_cert.sex,
        "age":                          death_cert.age,
        "nationality":                  death_cert.nationality or "",
        "occupation":                   death_cert.occupation or "",
        "napsa_social_security_no":     death_cert.napsa_social_security_no or "",
        "national_identity_no":         death_cert.national_identity_no or "",
        "cause_of_death":               death_cert.cause_of_death,
        "informant_name":               death_cert.informant_name,
        "informant_relationship":       death_cert.informant_relationship,
        "date_of_registration":         str(death_cert.date_of_registration),
        "registrar_name":               death_cert.registrar_general_name,
        "register_kept_at":             death_cert.register_kept_at,
        "registrar_general_name":       death_cert.registrar_general_name,
    }

    # Build Burial Permit payload. The generator expects the date of death
    # split into day/month/year components for form filling.
    death_date = burial_permit.date_of_death
    burial_permit_payload = {
        "authorised_by_name":   burial_permit.authorised_by_name,
        "deceased_name":        burial_permit.deceased_name,
        "place_of_death":       burial_permit.place_of_death,
        "death_day":            str(death_date.day),
        "death_month":          death_date.strftime("%B").upper(),
        "death_year":           str(death_date.year)[-2:],
        "issuing_authority":    burial_permit.issuing_authority,
        "issuing_officer_name": burial_permit.issuing_officer_name or "",
        "issued_date":          str(burial_permit.issued_date),
    }

    death_cert_pdf_path = os.path.join(output_dir, f"death_certificate_{death_records_id}.pdf")
    burial_permit_pdf_path = os.path.join(output_dir, f"burial_permit_{death_records_id}.pdf")

    generate_death_certificate(death_cert_payload, death_cert_pdf_path)
    generate_burial_permit(burial_permit_payload, burial_permit_pdf_path)

    return {
        "death_certificate_pdf": death_cert_pdf_path,
        "burial_permit_pdf": burial_permit_pdf_path,
        "death_records_id": death_records_id,
    }


def review_all_approved_death_documents(death_records_id: int) -> dict:
    """
    Fetches an APPROVED DeathRecords entry and generates PDFs for all
    four death pipeline documents: Death Certificate, Burial Permit,
    Notice of Death, and Medical Certificate of Cause of Death (MCCD).

    This is the comprehensive post-approval document retrieval service for
    death records. It combines the functionality of view_death_certificates()
    (which generates the Death Certificate and Burial Permit) with
    review_death_documents() (which generates the MCCD and Notice of Death)
    into a single call that returns the complete document pack.

    Pipeline context:
        The death registration workflow consists of four official documents:
          1. MCCD (Medical Certificate of Cause of Death) — Form completed
             by the attending Health Worker certifying the medical cause.
          2. Notice of Death (DNRPC Form) — Filed by the informant after the
             MCCD is submitted; contains deceased particulars and informant details.
          3. Death Certificate — Generated at approval from the data in docs 1 & 2;
             the legal proof of death issued by the Registrar-General.
          4. Burial Permit (Form XI, Rules 30 & 37) — Generated at approval from
             doc 2; authorises burial or other disposal of the body.

        Documents 1 and 2 exist from the submission phase and are reviewed by
        the Registrar before approval. Documents 3 and 4 are created during the
        approval step and stored as model instances. This service generates PDFs
        for all four documents on-demand from their respective model data.

    Steps:
        1. Fetch DeathRecords with all four related documents via select_related
           (single SQL query with four JOINs — no N+1 queries).
        2. Validate status is APPROVED — rejects PENDING/REJECTED records since
           the Death Certificate and Burial Permit only exist after approval.
        3. Validate all four document FKs are populated (Defensive: an approved
           record should always have all four, but we guard against corruption).
        4. Build the Death Certificate payload from the DeathCertificate model.
        5. Build the Burial Permit payload from the BurialPermit model, splitting
           the date_of_death into day/month/year components for the form generator.
        6. Build the MCCD payload from the MedicalCertificateCauseOfDeath model,
           mapping all cause-of-death chain fields (a, b, c) and ICD codes.
        7. Build the Notice of Death payload from the NoticeOfDeath model,
           including deceased particulars, informant details, and police/coroner
           fields for non-natural deaths.
        8. Call all four generators to produce PDFs in media/generated_pdfs/.
        9. Return dict with all four file paths and the death_records_id.

    Args:
        death_records_id: PK of the DeathRecords submission.

    Returns:
        Dict with keys:
            - death_certificate_pdf: str — path to the Death Certificate PDF.
            - burial_permit_pdf: str — path to the Burial Permit (Form XI) PDF.
            - mccd_pdf: str — path to the Medical Certificate of Cause of Death PDF.
            - notice_of_death_pdf: str — path to the Notice of Death PDF.
            - death_records_id: int — the original submission ID.

    Raises:
        HTTPException 404 — DeathRecords with the given ID does not exist.
        HTTPException 409 — DeathRecords status is not APPROVED. The full
            document pack is only available after Registrar approval because
            the Death Certificate and Burial Permit are generated at that stage.
        HTTPException 400 — Any of the four required document FKs is null.
            Lists which specific documents are missing in the error detail.
    """
    try:
        death_records = (
            DeathRecords.objects
            .select_related(
                "death_certificate",
                "burial_permit",
                "medical_certificate_of_death",
                "notice_of_death",
            )
            .get(id=death_records_id)
        )
    except DeathRecords.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Death record not found",
        )

    if death_records.status != RegistrationStatusChoices.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Full document pack is only available after approval",
        )

    death_cert = death_records.death_certificate
    burial_permit = death_records.burial_permit
    mccd = death_records.medical_certificate_of_death
    notice_of_death = death_records.notice_of_death

    missing_docs = []
    if not death_cert:
        missing_docs.append("Death Certificate")
    if not burial_permit:
        missing_docs.append("Burial Permit")
    if not mccd:
        missing_docs.append("Medical Certificate of Cause of Death (MCCD)")
    if not notice_of_death:
        missing_docs.append("Notice of Death")

    if missing_docs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required documents: {', '.join(missing_docs)}",
        )

    from hospital.Utils.death_certificate_generator import generate_death_certificate
    from hospital.Utils.burial_permit_generator import generate_burial_permit
    from hospital.Utils.mccd_generator import generate_mccd
    from hospital.Utils.notice_of_death_generator import generate_notice_of_death

    output_dir = os.path.join(os.path.dirname(__file__), "..", "..", "media", "generated_pdfs")
    os.makedirs(output_dir, exist_ok=True)

    # --- Death Certificate payload ---
    death_cert_payload = {
        "registration_no":              death_cert.registration_no,
        "date_of_death":                str(death_cert.date_of_death),
        "district":                     death_cert.district,
        "place_of_death":               death_cert.place_of_death,
        "deceased_names_and_surname":   death_cert.deceased_names_and_surname,
        "sex":                          death_cert.sex,
        "age":                          death_cert.age,
        "nationality":                  death_cert.nationality or "",
        "occupation":                   death_cert.occupation or "",
        "napsa_social_security_no":     death_cert.napsa_social_security_no or "",
        "national_identity_no":         death_cert.national_identity_no or "",
        "cause_of_death":               death_cert.cause_of_death,
        "informant_name":               death_cert.informant_name,
        "informant_relationship":       death_cert.informant_relationship,
        "date_of_registration":         str(death_cert.date_of_registration),
        "registrar_name":               death_cert.registrar_general_name,
        "register_kept_at":             death_cert.register_kept_at,
        "registrar_general_name":       death_cert.registrar_general_name,
    }

    # --- Burial Permit payload ---
    death_date = burial_permit.date_of_death
    burial_permit_payload = {
        "authorised_by_name":   burial_permit.authorised_by_name,
        "deceased_name":        burial_permit.deceased_name,
        "place_of_death":       burial_permit.place_of_death,
        "death_day":            str(death_date.day),
        "death_month":          death_date.strftime("%B").upper(),
        "death_year":           str(death_date.year)[-2:],
        "issuing_authority":    burial_permit.issuing_authority,
        "issuing_officer_name": burial_permit.issuing_officer_name or "",
        "issued_date":          str(burial_permit.issued_date),
    }

    # --- MCCD payload ---
    mccd_payload = {
        "medical_no": mccd.medical_no,
        "attended_name": mccd.attended_name,
        "during": "",
        "illness_start_date": str(mccd.illness_start_date),
        "age_stated": mccd.age_stated,
        "last_attended_alive_date": str(mccd.last_attended_alive_date),
        "last_attended_alive_day": str(mccd.last_attended_alive_day),
        "last_attended_alive_month": "",
        "last_attended_alive_year": "",
        "death_day": str(mccd.death_day),
        "death_date": str(mccd.death_date),
        "death_month": "",
        "death_year": str(mccd.death_year),
        "death_time": str(mccd.death_time) if mccd.death_time else "",
        "body_identified_of": mccd.body_identified_of,
        "postmortem_confirmed": mccd.postmortem_confirmed,
        "cause_a": mccd.cause_a or "",
        "cause_a_interval": mccd.cause_a_interval or "",
        "cause_a_icd_code": mccd.cause_a_icd_code or "",
        "cause_b": mccd.cause_b or "",
        "cause_b_interval": mccd.cause_b_interval or "",
        "cause_b_icd_code": mccd.cause_b_icd_code or "",
        "cause_c": mccd.cause_c or "",
        "cause_c_interval": mccd.cause_c_interval or "",
        "cause_c_icd_code": mccd.cause_c_icd_code or "",
        "other_condition_1": mccd.other_condition_1 or "",
        "other_condition_1_interval": mccd.other_condition_1_interval or "",
        "other_condition_2": mccd.other_condition_2 or "",
        "other_condition_2_interval": mccd.other_condition_2_interval or "",
        "witness_date": str(mccd.witness_date) if mccd.witness_date else "",
        "witness_month": "",
        "witness_year": "",
        "certificate_handed_to": mccd.certificate_handed_to,
        "medical_attendant_name": mccd.medical_attendant_name,
        "medical_attendant_signature": "",
        "medical_attendant_qualification": mccd.medical_attendant_qualification,
        "medical_attendant_residence": mccd.medical_attendant_residence,
        "village": mccd.village or "",
        "chief": mccd.chief or "",
        "district": mccd.district or "",
    }

    # --- Notice of Death payload ---
    place_of_death = notice_of_death.place_of_death_name or notice_of_death.place_of_death_other or ""
    notice_payload = {
        "serial_number": notice_of_death.serial_number,
        "application_no": notice_of_death.application_no or "",
        "date_and_time": str(notice_of_death.date_and_time),
        "surname": notice_of_death.surname,
        "district": notice_of_death.district,
        "other_names": notice_of_death.other_names or "",
        "occupation": notice_of_death.occupation or "",
        "residential_address": notice_of_death.residential_address or "",
        "date_of_death": str(notice_of_death.date_of_death),
        "place_of_death": notice_of_death.place_of_death or "",
        "place_of_death_name": place_of_death,
        "date_of_birth": str(notice_of_death.date_of_birth) if notice_of_death.date_of_birth else "",
        "age_at_death": notice_of_death.age_at_death or "",
        "sex": notice_of_death.sex or "",
        "nationality": notice_of_death.nationality or "",
        "national_identity_no": notice_of_death.national_identity_no or "",
        "social_security_no": notice_of_death.social_security_no or "",
        "education_level": notice_of_death.education_level or "",
        "death_type": notice_of_death.death_type or "",
        "immediate_cause": notice_of_death.immediate_cause or "",
        "immediate_cause_icd": notice_of_death.immediate_cause_icd or "",
        "antecedent_cause": notice_of_death.antecedent_cause or "",
        "antecedent_cause_icd": notice_of_death.antecedent_cause_icd or "",
        "underlying_cause": notice_of_death.underlying_cause or "",
        "underlying_cause_icd": notice_of_death.underlying_cause_icd or "",
        "police_certifier_name": notice_of_death.police_certifier_name or "",
        "police_certifier_residence": notice_of_death.police_certifier_residence or "",
        "police_certifier_relationship": notice_of_death.police_certifier_relationship or "",
        "deceased_surname_police": notice_of_death.deceased_surname_police or "",
        "deceased_other_names_police": notice_of_death.deceased_other_names_police or "",
        "deceased_age_police": notice_of_death.deceased_age_police or "",
        "passed_away_date": str(notice_of_death.passed_away_date) if notice_of_death.passed_away_date else "",
        "passed_away_time": str(notice_of_death.passed_away_time) if notice_of_death.passed_away_time else "",
        "passed_away_place": notice_of_death.passed_away_place or "",
        "suddenly_suffering_from": notice_of_death.suddenly_suffering_from or "",
        "treatment_was_at": notice_of_death.treatment_was_at or "",
        "is_natural_death": notice_of_death.is_natural_death,
        "is_sudden_death_postmortem": notice_of_death.is_sudden_death_postmortem_required,
        "police_no_and_rank": notice_of_death.police_no_and_rank or "",
        "police_formation": notice_of_death.police_formation or "",
        "police_officer_name": notice_of_death.police_officer_name or "",
        "police_officer_date": str(notice_of_death.police_officer_date) if notice_of_death.police_officer_date else "",
        "doctors_remarks": notice_of_death.doctors_remarks or "",
        "pupils_dilated_and_fixed": notice_of_death.pupils_dilated_and_fixed,
        "certifying_doctor_name": notice_of_death.certifying_doctor_name or "",
        "certifying_doctor_date": str(notice_of_death.certifying_doctor_date) if notice_of_death.certifying_doctor_date else "",
        "informant_surname": notice_of_death.informant_surname,
        "informant_other_names": notice_of_death.informant_other_names or "",
        "informant_relationship": notice_of_death.informant_relationship or "",
        "informant_contact_no": notice_of_death.informant_contact_no or "",
        "informant_national_id": notice_of_death.informant_national_id or "",
        "informant_nationality": notice_of_death.informant_nationality or "",
        "informant_residential_address": notice_of_death.informant_residential_address or "",
        "informant_postal_address": notice_of_death.informant_postal_address or "",
        "date_of_registration": str(notice_of_death.date_of_registration) if notice_of_death.date_of_registration else "",
        "has_mccd": notice_of_death.has_mccd,
        "has_informant_national_id": notice_of_death.has_informant_national_id,
        "has_coroner_report": notice_of_death.has_coroner_report,
        "informant_declaration_name": notice_of_death.informant_declaration_name or "",
        "informant_declaration_date": str(notice_of_death.informant_declaration_date) if notice_of_death.informant_declaration_date else "",
        "assistant_registrar_name": notice_of_death.assistant_registrar_name or "",
        "registrar_name": notice_of_death.registrar_name or "",
    }

    # --- Generate all four PDFs ---
    death_cert_pdf_path = os.path.join(output_dir, f"death_certificate_{death_records_id}.pdf")
    burial_permit_pdf_path = os.path.join(output_dir, f"burial_permit_{death_records_id}.pdf")
    mccd_pdf_path = os.path.join(output_dir, f"mccd_{death_records_id}.pdf")
    notice_pdf_path = os.path.join(output_dir, f"notice_of_death_{death_records_id}.pdf")

    generate_death_certificate(death_cert_payload, death_cert_pdf_path)
    generate_burial_permit(burial_permit_payload, burial_permit_pdf_path)
    generate_mccd(mccd_payload, mccd_pdf_path)
    generate_notice_of_death(notice_payload, notice_pdf_path)

    return {
        "death_certificate_pdf": death_cert_pdf_path,
        "burial_permit_pdf": burial_permit_pdf_path,
        "mccd_pdf": mccd_pdf_path,
        "notice_of_death_pdf": notice_pdf_path,
        "death_records_id": death_records_id,
    }

def get_hw_birth_submission(user_id: int) -> dict:
    """Returns all birth submissions created by this health worker"""
    records = BirthRecords.objects.filter(health_worker_id=user_id).order_by("-submitted_at")
    serializer = BirthRecordRequestSerializer(records, many=True)
    return {"details": "Submission Found", "record": serializer.data}

def get_hw_death_submission(user_id: int) -> dict:
    """Returns all death submissions created by this health worker."""
    records = DeathRecords.objects.filter(health_worker_id=user_id).order_by("-submitted_at")
    serializer = DeathRecordRequestSerializer(records, many=True)
    return {"details": "submissions Found", "records": serializer.data}