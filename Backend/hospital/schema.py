# schema.py
# Pydantic models (schemas) used by the FastAPI layer for request validation
# and response serialisation across the hospital birth/death registration module.
#
# Schemas are organised into the following groups:
#   1. Shared Enums            — reusable string enumerations
#   2. Reusable Action Schemas — generic request bodies (e.g. rejection)
#   3. Birth Record Schemas    — submission, response, and certificate models
#   4. Death Record Schemas    — base, create, and response models
#   5. MCCD Schemas            — Medical Certificate of Cause of Death
#   6. Notice of Death Schemas — DNRPC two-page form
#   7. Offline Sync Schemas    — batch-sync payload for offline devices
#   8. Pagination & Filters    — query parameter and paginated list models

from pydantic import BaseModel, Field, ConfigDict, HttpUrl
from datetime import date, datetime, time
from enum import Enum
from typing import Optional, Any


# ============================================================================
# 1. SHARED ENUMS
# ============================================================================

class RecordStatus(str, Enum):
    """
    Lifecycle status for any birth or death record submission.
    A record starts as PENDING when submitted by a Health Worker,
    then moves to APPROVED or REJECTED by a Registrar Officer (RO).
    """
    PENDING = 'PENDING'
    APPROVED = 'APPROVED'
    REJECTED = 'REJECTED'

class SyncStatus(str, Enum):
    """
    Tracks the sync state of a record that was captured offline by the
    hospital app and subsequently pushed to the server.
    """
    QUEUED = 'QUEUED'   # Record is waiting to be processed
    SYNCED = 'SYNCED'   # Successfully processed and stored
    FAILED = 'FAILED'   # Processing failed; see error_message

class Sex(str, Enum):
    """Biological sex of a person, as recorded on official Zambian vital-events forms."""
    MALE = "MALE"
    FEMALE = "FEMALE"

class EventType(str, Enum):
    """Distinguishes whether an offline sync payload carries a birth or a death event."""
    BIRTH = 'BIRTH'
    DEATH = 'DEATH'

class PlaceOfBirth(str, Enum):
    """Where the birth physically occurred — determines which address field is required."""
    HEALTH_FACILITY = 'HEALTH_FACILITY'
    HOME = 'HOME'
    OTHER = 'OTHER'

class AttendantAtBirth(str, Enum):
    """
    Who was present and assisted at the birth.
    When OTHER is chosen, attendant_other_specified must be filled in.
    """
    QUALIFIED_MIDWIFE = 'MIDWIFE'
    TRADITIONAL_BIRTH_ATTENDANT = 'TBA'
    OTHER = 'OTHER'

class MaritalStatus(str, Enum):
    """
    Marital status of the parents at time of birth.
    Affects whether paternity acknowledgement signatures are required:
    unmarried parents must supply father_acknowledgement_signature
    and mother_consent_signature.
    """
    MARRIED = 'MARRIED'
    NOT_MARRIED = 'NOT_MARRIED'

class EducationLevel(str, Enum):
    """Highest educational level attained, used on several vital-events forms."""
    NEVER_BEEN = 'NONE'
    PRIMARY = 'PRIMARY'
    SECONDARY = 'SECONDARY'
    TERTIARY = 'TERTIARY'


# ============================================================================
# 2. REUSABLE ACTION SCHEMAS
# ============================================================================

class RecordRejection(BaseModel):
    """
    Request body for PATCH /{resource}/{id}/reject endpoints.
    Used by Registrar Officers to reject a pending birth or death record.

    The rejection_reason must be at least 10 characters so the RO is forced
    to provide a meaningful explanation, which is stored on the record and
    can be viewed by the submitting Health Worker.
    """
    rejection_reason: str = Field(
        ...,
        min_length=10,
        description="Detailed explanation for rejecting the record",
    )


# ============================================================================
# 3. BIRTH RECORD SCHEMAS
# ============================================================================

class BirthRecordSubmission(BaseModel):
    """
    Unified request body for POST /births/submit.

    Combines the data from two official Zambian paper forms into a single
    API call, which the service layer then splits and persists separately:
        - Notice of Birth (Form VIII, DNRPC) — detailed registration form
        - Record of Birth (M.F.2, DMS)       — facility summary / sign-off form

    Submitted exclusively by Health Workers at registered facilities.

    Parent lookup:
        Mother and Father details (name, NRC, NAPSA, occupation, address, etc.)
        are retrieved automatically from their Citizen records using the DINs
        supplied here, so the caller does not need to re-enter those fields.

    Conditional fields:
        - health_facility_name  required when place_of_birth == HEALTH_FACILITY
        - home_address          required when place_of_birth == HOME
        - other_place_specified required when place_of_birth == OTHER
        - father_* fields       required only when marital_status == NOT_MARRIED
    """

    # ----------------------------------------------------------------
    # PARENT REFERENCES
    # The service resolves the full Citizen objects from these DINs.
    # ----------------------------------------------------------------
    mother_din: str = Field(..., max_length=20, description="DIN of the registered mother (Citizen)")
    father_din: Optional[str] = Field(
        None, max_length=20,
        description="DIN of the father (Citizen). Optional if not married or father not known",
    )

    # ----------------------------------------------------------------
    # NOTICE OF BIRTH (Form VIII) FIELDS
    # ----------------------------------------------------------------

    # Official reference numbers pre-printed on the physical forms
    notice_serial_number: Optional[str] = Field(None, max_length=20, description="Pre-printed serial on Notice of Birth form")
    record_of_birth_serial_number: Optional[str] = Field(None, max_length=20, description="Pre-printed serial on Record of Birth form (M.F.2)")

    # Facility and administrative details
    district: str = Field(..., max_length=100, description="District where facility is located")
    date_and_time_of_birth_notification: datetime = Field(..., description="Official date and time recorded by facility")

    # --- Section 1: Details of Birth ---
    date_of_birth: date = Field(...)
    place_of_birth: PlaceOfBirth = Field(...)
    # Conditionally required based on place_of_birth value:
    health_facility_name: Optional[str] = Field(None, max_length=255, description="Required if born at health facility")
    home_address: Optional[str] = Field(None, description="Required if born at home")
    other_place_specified: Optional[str] = Field(None, max_length=255, description="Specify if place_of_birth is OTHER")

    # Child's identity fields
    child_surname: str = Field(..., max_length=100)
    child_given_name: str = Field(..., max_length=100, description="First/given name")
    child_other_names: Optional[str] = Field(None, max_length=255)
    sex: Sex = Field(...)
    birth_weight_kg: float = Field(..., gt=0, le=10, description="Birth weight in kilograms")

    # --- Section 2: Additional Father Details ---
    # Core father fields (name, NRC, etc.) are retrieved from the Citizen record;
    # these tribal/village fields are specific to the notice form.
    father_village_of_origin: Optional[str] = Field(None, max_length=100)
    father_chief: Optional[str] = Field(None, max_length=100)
    father_district: Optional[str] = Field(None, max_length=100)
    father_tribe: Optional[str] = Field(None, max_length=100)

    # --- Section 3: Additional Mother Details ---
    mother_village_of_origin: Optional[str] = Field(None, max_length=100)
    mother_chief: Optional[str] = Field(None, max_length=100)
    mother_district: Optional[str] = Field(None, max_length=100)
    mother_tribe: Optional[str] = Field(None, max_length=100)
    mother_usual_place_of_residence: Optional[str] = Field(None)

    # --- Birth Attendance ---
    attendant_at_birth: AttendantAtBirth = Field(...)
    # Required when attendant_at_birth == OTHER:
    attendant_other_specified: Optional[str] = Field(None, max_length=255, description="Specify if attendant_at_birth is OTHER")

    # --- Marital Status & Paternity Acknowledgement ---
    marital_status: MaritalStatus = Field(...)
    # The following four fields are required only when marital_status == NOT_MARRIED,
    # to formally acknowledge paternity and obtain mother's consent:
    father_acknowledgement_signature: Optional[str] = Field(
        None, description="Base64 encoded signature — father acknowledges paternity (for unmarried)",
    )
    father_acknowledgement_date: Optional[date] = Field(None)
    mother_consent_signature: Optional[str] = Field(
        None, description="Base64 encoded signature — mother consents (for unmarried)",
    )
    mother_consent_date: Optional[date] = Field(None)

    # ----------------------------------------------------------------
    # RECORD OF BIRTH (M.F.2) FIELDS
    # ----------------------------------------------------------------

    file_number: Optional[str] = Field(None, max_length=50, description="Facility file / case number")
    place_of_birth_text: Optional[str] = Field(None, max_length=255, description="Text description of birth place")
    time_of_birth: Optional[time] = Field(None, description="Time when birth occurred")

    # Official sign-off by the officer in charge at the facility
    officer_in_charge: Optional[str] = Field(None, max_length=255, description="Name of officer signing the Record of Birth")
    official_stamp_ref: Optional[str] = Field(None, max_length=100, description="Reference or scan path for official stamp")
    date_signed: Optional[date] = Field(None, description="Date when Record of Birth was signed")

    class Config:
        json_schema_extra = {
            "example": {
                "mother_din": "123456/01/1",
                "father_din": "654321/01/1",
                "notice_serial_number": "0050984",
                "record_of_birth_serial_number": "MF2-001",
                "facility_name": "University Teaching Hospital",
                "district": "Lusaka",
                "date_and_time_of_birth_notification": "2024-04-27T14:30:00",
                "date_of_birth": "2024-04-27",
                "place_of_birth": "HEALTH_FACILITY",
                "health_facility_name": "University Teaching Hospital",
                "child_surname": "Mwale",
                "child_given_name": "John",
                "child_other_names": "Kaunda",
                "sex": "M",
                "birth_weight_kg": 3.5,
                "attendant_at_birth": "MIDWIFE",
                "marital_status": "MARRIED",
            }
        }


class BirthRecordResponse(BaseModel):
    """
    Response model for GET /births/{id}.

    Returns the summary view of a birth record submission.
    Mother and Father personal details are populated from their Citizen
    instances by the service layer rather than being stored redundantly.

    child_din is None until the record is APPROVED by a Registrar, at which
    point a new Citizen entry is created for the child and the DIN is assigned.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    mother_din: str
    father_din: Optional[str]
    notice_serial_number: str
    record_of_birth_serial_number: str
    child_surname: str
    child_given_name: str
    sex: Sex
    child_din: Optional[str] = Field(None, description="Assigned after RO approval")
    status: RecordStatus
    created_at: datetime
    certificate_url: Optional[str] = None  # URL to the generated PDF certificate (post-approval)


# ============================================================================
# 4. DEATH RECORD SCHEMAS
# ============================================================================

class DeathRecordBase(BaseModel):
    """
    Shared fields for death record create and response models.
    deceased_din links to the citizen whose death is being recorded.
    cause_icd11 must be a valid ICD-11 mortality code (e.g. "BA00" for Cholera).
    """
    deceased_din: str = Field(..., max_length=12, description="DIN of the deceased citizen")
    facility: str = Field(..., max_length=255, description="Place of death declaration")
    cause_icd11: str = Field(..., max_length=20, description="Standardized ICD-11 mortality code")
    cause_description: Optional[str] = Field(None, max_length=255, description="Plain text description of the cause")
    died_at: datetime

class DeathRecordCreate(DeathRecordBase):
    """
    Request body for POST /deaths/ (online submission flow).
    health_worker_id is injected by the service from the authenticated user
    and may be None if submitted through an offline sync path.
    """
    health_worker_id: Optional[int] = Field(None)

class DeathRecordResponse(DeathRecordBase):
    """
    Response model for GET /deaths/{id}.
    Includes review audit fields (reviewer, timestamp, rejection reason)
    that are None while the record is still PENDING.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    health_worker_id: Optional[int] = None
    status: RecordStatus
    reviewed_by_id: Optional[int] = None       # SystemUser ID of the RO who reviewed this
    reviewed_at: Optional[datetime] = None      # Timestamp of the review decision
    rejection_reason: Optional[str] = None      # Populated only when status == REJECTED
    certificate_url: Optional[str] = None       # URL to the generated death certificate (post-approval)
    created_at: datetime


# ============================================================================
# 5. MEDICAL CERTIFICATE OF CAUSE OF DEATH (MCCD) SCHEMAS
# ============================================================================

class MedicalCertificateCauseOfDeathCreate(BaseModel):
    """
    Request body for POST /deaths/submit.

    Maps to the official Zambian MCCD form (Medical No. 14,
    Republic of Zambia — Ministry of Health).

    Completed and submitted by the attending doctor (via a Health Worker
    account) immediately following a death at a health facility.

    Cause of death hierarchy (WHO / ICD-11 standard):
        Part I  — Direct chain of causation:
            cause_a  → the immediate disease/condition that directly caused death
            cause_b  → the condition that gave rise to (a)
            cause_c  → the underlying condition that gave rise to (b)
        Part II — Other significant conditions that contributed but are not
                  part of the direct chain (other_condition_1, other_condition_2).

    Informant:
        Rather than re-entering personal details, the caller supplies
        informant_din and the service resolves the Citizen record for
        name, contact, and address fields.
    """

    # --- Reference (pre-printed on the physical counterfoil) ---
    medical_no: Optional[str] = Field(..., max_length=30, description="Pre-printed medical number on the counterfoil")
    # --- Doctor's Attendance Narrative ---
    # Captures the timeline of the doctor's involvement with the patient
    attended_name: str = Field(..., max_length=255, description="Full name of the person the doctor attended")
    illness_start_date: date = Field(...)                             # Date doctor first attended during last illness
    last_attended_alive_date: Optional[date] = Field(None)                       # Last date the patient was seen alive
    last_attended_alive_day: Optional[int] = Field(None, ge=1, le=31)            # Day of month (mirrors paper form format)
    death_date: date = Field(...)
    death_day: int = Field(..., ge=1, le=31, description="Day of month when death occurred (1-31)")
    death_year: int = Field(..., description="Year of death (last 2 digits)")
    death_time: Optional[time] = Field(None)
    body_identified_of: str = Field(..., max_length=255)              # Name of person whose body was formally identified
    age_stated: str = Field(..., max_length=20, description="Age as stated on the form, e.g. '45 years'")

    # --- Post-mortem ---
    postmortem_confirmed: bool = Field(default=False)                 # True if cause confirmed by post-mortem examination

    # --- Cause of Death Table — Part I (direct chain) ---
    cause_a: str = Field(..., max_length=255, description="Disease or condition directly leading to death")
    cause_a_interval: Optional[str] = Field(None, max_length=100, description="Approximate interval between onset and death")
    cause_a_icd_code: Optional[str] = Field(None, max_length=20)      # ICD-11 code for cause (a)

    cause_b: Optional[str] = Field(None, max_length=255, description="Morbid condition giving rise to (a)")
    cause_b_interval: Optional[str] = Field(None, max_length=100)
    cause_b_icd_code: Optional[str] = Field(None, max_length=20)

    cause_c: Optional[str] = Field(None, max_length=255, description="Underlying condition")
    cause_c_interval: Optional[str] = Field(None, max_length=100)
    cause_c_icd_code: Optional[str] = Field(None, max_length=20)

    # --- Cause of Death Table — Part II (other significant conditions) ---
    other_condition_1: Optional[str] = Field(None, max_length=255)
    other_condition_1_interval: Optional[str] = Field(None, max_length=100)
    other_condition_2: Optional[str] = Field(None, max_length=255)
    other_condition_2_interval: Optional[str] = Field(None, max_length=100)

    # --- Doctor Sign-off ---
    witness_date: date = Field(..., description="Date the doctor signed the certificate (required)")
    certificate_handed_to: str = Field(..., max_length=255)            # Name/address of person who received the certificate
    medical_attendant_name: str = Field(..., max_length=255)
    medical_attendant_signature: Optional[str] = Field(None, description="Base64 signature or reference")
    medical_attendant_qualification: str = Field(..., max_length=255)
    medical_attendant_residence: str = Field(..., max_length=255)

    # --- Additional Location Information (bottom of form) ---
    village: Optional[str] = Field(None, max_length=100)
    chief: Optional[str] = Field(None, max_length=100)
    district: Optional[str] = Field(None, max_length=100)

    # --- Informant Details ---
    # Supply the DIN; the service enriches the record with Citizen data.
    informant_din: str = Field(..., max_length=20, description="DIN of the informant (Citizen)")
    informant_relationship: str = Field(..., max_length=100, description="Relationship to the deceased")
    informant_contact_no: Optional[str] = Field(None, max_length=20, description="Optional contact number")
    informant_postal_address: Optional[str] = Field(None, description="Postal address if different from residential")
    informant_signature: Optional[str] = Field(None, description="Base64 encoded signature of informant")
    informant_declaration_date: Optional[date] = Field(None, description="Date of informant's declaration")


class MedicalCertificateCauseOfDeathResponse(BaseModel):
    """
    Response model for GET /mccd/{id}.

    Returns the subset of MCCD fields most relevant for display and downstream
    linking. Informant details are populated by joining the stored informant_din
    with the current Citizen record at query time.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    medical_no: str
    attended_name: str
    death_date: date
    death_time: Optional[time]
    # Top-level cause fields from the direct chain (Part I)
    cause_a: str
    cause_b: Optional[str]
    cause_c: Optional[str]
    postmortem_confirmed: bool
    medical_attendant_name: str
    medical_attendant_qualification: str
    informant_din: str
    informant_relationship: str
    status: RecordStatus
    created_at: datetime
    updated_at: datetime


# ============================================================================
# 6. NOTICE OF DEATH (DNRPC) SCHEMAS
# ============================================================================

class PlaceOfDeath(str, Enum):
    """
    Where the death occurred — mirrors PlaceOfBirth to keep the form
    structure consistent across vital events.
    """
    HEALTH_FACILITY = 'HEALTH_FACILITY'
    HOME = 'HOME'
    OTHER = 'OTHER'


class DeathType(str, Enum):
    """
    Classification of the death's cause category.
    SUDDEN deaths require a post-mortem; UNNATURAL deaths require a coroner's report.
    """
    NATURAL = 'NATURAL'
    SUDDEN = 'SUDDEN'
    UNNATURAL = 'UNNATURAL'


class NoticeOfDeathCreate(BaseModel):
    """
    Request body for POST /deaths/submit/{death_record_id}/notice_of_death.

    Maps to the official DNRPC (Death Notification and Registration Processing
    Centre) two-page form used in Zambia for registering a death.

    The Notice of Death must be submitted AFTER the initial MCCD submission
    (which creates the DeathRecords entry) and is a prerequisite for RO approval.
    Linking this notice sets ready_for_review = True on the DeathRecords entry.

    Form sections:
        Section A — Details of the deceased (auto-populated from Citizen if
                    deceased_din is provided; otherwise filled manually)
        Section B — Cause of death (FOR OFFICIAL USE — filled by registrar from MCCD)
        Section C — Police / Brought-in-Dead certificate (for unnatural/sudden deaths)
        Section D — Details of informant (resolved from Citizen via informant_din)
        Section E — Appendices checklist (boolean flags for attached documents)

    Informant:
        Supply informant_din; the service resolves name, contact, NRC, nationality,
        and address from the Citizen record automatically.
    """

    # --- Reference ---
    serial_number: str = Field(..., max_length=20, description="Pre-printed serial on DNRPC form")
    application_no: Optional[str] = Field(None, max_length=30, description="Official reference assigned by registrar")
    date_and_time: datetime = Field(..., description="Official date and time recorded on the form")

    # --- Section A: Details of Deceased ---
    # If deceased_din is provided, name/address/occupation/nationality/gender/dob/education
    # are automatically fetched from the Citizen record and do not need to be repeated here.
    deceased_din: Optional[str] = Field(
        None, max_length=20,
        description="DIN of the deceased (Citizen). If provided, deceased details from Citizen record will be used.",
    )
    surname: Optional[str] = Field(None, max_length=100, description="Required if deceased_din not provided")
    other_names: Optional[str] = Field(None, max_length=255)
    occupation: Optional[str] = Field(None, max_length=100, description="Can be retrieved from Citizen if deceased_din provided")
    residential_address: Optional[str] = Field(None, description="Can be retrieved from Citizen if deceased_din provided")
    district: str = Field(..., max_length=100)                 # Always required
    date_of_death: date = Field(...)
    place_of_death: PlaceOfDeath = Field(...)
    place_of_death_name: Optional[str] = Field(None, max_length=255, description="Health facility name or home description")
    place_of_death_other: Optional[str] = Field(None, max_length=255)
    date_of_birth: Optional[date] = Field(None, description="Can be retrieved from Citizen if deceased_din provided")
    age_at_death: Optional[int] = Field(None, ge=0, le=150)
    sex: Optional[Sex] = Field(None, description="Can be retrieved from Citizen if deceased_din provided")
    nationality: Optional[str] = Field(None, max_length=100, description="Can be retrieved from Citizen if deceased_din provided")
    national_identity_no: Optional[str] = Field(None, max_length=30, description="NRC number")
    social_security_no: Optional[str] = Field(None, max_length=30, description="NAPSA number")
    education_level: Optional[EducationLevel] = Field(None, description="Can be retrieved from Citizen if deceased_din provided")

    # --- Section B: Cause of Death (FOR OFFICIAL USE ONLY) ---
    # These fields are normally completed by the registrar using the attached MCCD,
    # not the submitting citizen/health worker.
    death_type: Optional[DeathType] = Field(None)
    immediate_cause: Optional[str] = Field(None, max_length=255)
    immediate_cause_icd: Optional[str] = Field(None, max_length=20)
    antecedent_cause: Optional[str] = Field(None, max_length=255)
    antecedent_cause_icd: Optional[str] = Field(None, max_length=20)
    underlying_cause: Optional[str] = Field(None, max_length=255)
    underlying_cause_icd: Optional[str] = Field(None, max_length=20)

    # --- Section C: Police / Brought-in-Dead Certificate ---
    # Completed only for SUDDEN or UNNATURAL deaths by a police officer
    # or medical officer confirming the body was brought in.
    police_certifier_name: Optional[str] = Field(None, max_length=255)
    police_certifier_residence: Optional[str] = Field(None, max_length=255)
    police_certifier_relationship: Optional[str] = Field(None, max_length=100)
    deceased_surname_police: Optional[str] = Field(None, max_length=100)
    deceased_other_names_police: Optional[str] = Field(None, max_length=255)
    deceased_age_police: Optional[int] = Field(None, ge=0, le=150)
    passed_away_date: Optional[date] = Field(None)
    passed_away_time: Optional[time] = Field(None)
    passed_away_place: Optional[str] = Field(None, max_length=255)
    suddenly_suffering_from: Optional[str] = Field(None)     # Symptoms / illness before death
    treatment_was_at: Optional[str] = Field(None, max_length=255)
    is_natural_death: Optional[bool] = Field(None)
    is_sudden_death_postmortem_required: Optional[bool] = Field(None)

    # Police officer sign-off (bottom of Section C)
    police_no_and_rank: Optional[str] = Field(None, max_length=100)
    police_formation: Optional[str] = Field(None, max_length=100)
    police_officer_name: Optional[str] = Field(None, max_length=255)
    police_officer_signed: Optional[str] = Field(None, description="Base64 signature or reference")
    police_officer_date: Optional[date] = Field(None)

    # Doctor's remarks (reverse of Section C)
    doctors_remarks: Optional[str] = Field(None)
    pupils_dilated_and_fixed: Optional[bool] = Field(None)  # Clinical confirmation of death
    certifying_doctor_name: Optional[str] = Field(None, max_length=255)
    certifying_doctor_signature: Optional[str] = Field(None)
    certifying_doctor_date: Optional[date] = Field(None)

    # --- Section D: Details of Informant (resolved from Citizen via DIN) ---
    informant_din: str = Field(..., max_length=20, description="DIN of the informant (Citizen)")
    informant_relationship: str = Field(..., max_length=100, description="Relationship to the deceased")
    informant_contact_no: Optional[str] = Field(None, max_length=20)
    informant_postal_address: Optional[str] = Field(None, description="Postal address if different from residential")
    date_of_registration: Optional[date] = Field(None)

    # --- Section E: Appendices checklist ---
    # Boolean flags confirming which supporting documents have been physically attached
    has_mccd: bool = Field(default=False, description="Original MCCD attached")
    has_informant_national_id: bool = Field(default=False, description="Copy of informant's NID attached")
    has_coroner_report: bool = Field(default=False, description="Coroner's report attached (unnatural death)")

    # --- Informant's Declaration ---
    informant_declaration_name: Optional[str] = Field(None, max_length=255)
    informant_declaration_signature: Optional[str] = Field(None, description="Base64 encoded signature")
    informant_declaration_date: Optional[date] = Field(None)


class NoticeOfDeathResponse(BaseModel):
    """
    Response model for GET /notice-of-death/{id}.

    Returns the approved Notice of Death summary. Informant details are
    populated at query time by joining informant_din with the Citizen record,
    combined with the informant-specific fields stored on the notice itself.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    serial_number: str
    surname: str
    other_names: Optional[str]
    date_of_death: date
    district: str
    place_of_death: PlaceOfDeath
    sex: Sex
    informant_din: str
    informant_relationship: str
    status: RecordStatus
    created_at: datetime
    updated_at: datetime


# ============================================================================
# 7. OFFLINE SYNC SCHEMAS
# ============================================================================

class SyncPayloadCreate(BaseModel):
    """
    A single queued event within an offline sync batch.

    When the hospital app has no connectivity, it serialises each birth or
    death record to JSON and stores it locally. Once connectivity is
    restored, the app wraps all queued events in an OfflineSyncBatchCreate
    and posts them to /hospital/sync.

    Fields:
        device_id  — unique identifier of the submitting device (e.g. tablet ID)
        event_type — determines which model is hydrated from the payload dict
        queued_at  — device-side timestamp (may differ from server receipt time)
        payload    — full BirthRecordSubmission or MedicalCertificateCauseOfDeathCreate
                     serialised as a plain dict
    """
    device_id: str = Field(..., max_length=100)
    event_type: EventType
    queued_at: datetime = Field(..., description="Timestamp when the event was saved offline on the device")
    payload: dict[str, Any] = Field(..., description="JSON representation of BirthRecordCreate or DeathRecordCreate")

class OfflineSyncBatchCreate(BaseModel):
    """
    Request body for POST /sync/batch.

    The hospital app hits this endpoint upon regaining internet connectivity,
    sending all locally-queued records in a single atomic batch request.
    The server processes each item in sequence and updates its SyncStatus.
    """
    records: list[SyncPayloadCreate]

class OfflineSyncQueueResponse(BaseModel):
    """
    Response model for GET /sync/queue/{id}.

    Primarily used by IT staff / administrators to debug failed sync events.
    The payload field is intentionally omitted from standard list views to
    keep response sizes manageable; add it only to a dedicated admin detail view.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: str
    event_type: EventType
    queued_at: datetime
    synced_at: Optional[datetime] = None       # Populated when status becomes SYNCED
    status: SyncStatus
    error_message: Optional[str] = None        # Populated when status becomes FAILED


# ============================================================================
# 8. PAGINATION & FILTER SCHEMAS
# ============================================================================

class VitalRecordFilterParams(BaseModel):
    """
    Query parameters for filtered list endpoints:
        GET /births/
        GET /deaths/

    All filters are optional and combinable. Defaults return the first page
    of 20 records, ordered by the service layer's default sort.
    """
    status: Optional[RecordStatus] = None
    facility: Optional[str] = None
    health_worker_id: Optional[int] = None
    start_date: Optional[date] = None          # Inclusive lower bound for submission date
    end_date: Optional[date] = None            # Inclusive upper bound for submission date
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

