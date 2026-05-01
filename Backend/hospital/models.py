# models.py
# Django ORM models for the hospital birth and death registration module.
#
# These models map directly to official Zambian civil-registration paper forms:
#
#   Death pipeline:
#     MedicalCertificateCauseOfDeath  → MCCD (Medical No. 14, Ministry of Health)
#     NoticeOfDeath                   → DNRPC two-page form
#     BurialPermit                    → Form XI (Rules 30 & 37, 2016 Amendment)
#     DeathCertificate                → Final death certificate (Registrar-General)
#     DeathRecords                    → Submission tracker that links the above four
#
#   Birth pipeline:
#     NoticeOfBirth                   → Form VIII (Hospital Notice of Birth, 2016 Rev.)
#     RecordOfBirth                   → M.F.2 (District Medical Stores summary form)
#     BirthCertificate                → Final birth certificate (created on RO approval)
#     BirthRecords                    → Submission tracker that links the above three
#
#   Offline support:
#     OfflineSyncQueue                → Stores records captured while the app was offline
#
# Approval workflow (same for births and deaths):
#   Health Worker submits → status=PENDING
#   Registrar Officer (RO) approves → status=APPROVED, certificate generated
#   Registrar Officer (RO) rejects  → status=REJECTED, rejection_reason stored

from django.db import models
from citizens.models import Citizen


# ============================================================================
# SHARED ENUMERATIONS (TextChoices)
# ============================================================================

class RecordStatus(models.TextChoices):
    """
    Primary lifecycle status shared by BirthRecords and DeathRecords.
    Records are always created as PENDING and then transitioned by an RO.
    """
    PENDING  = "PENDING",  "Pending RO Review"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"

class SyncStatus(models.TextChoices):
    """Status of a record that was captured offline and later synced to the server."""
    QUEUED = "QUEUED", "Queued"   # Waiting to be processed on the server
    SYNCED = "SYNCED", "Synced"   # Successfully processed
    FAILED = "FAILED", "Failed"   # Processing failed; see error_message

class SexChoices(models.TextChoices):
    """Biological sex as recorded on official vital-events forms."""
    MALE   = "MALE", "Male"
    FEMALE = "FEMALE", "Female"

class AttendantChoices(models.TextChoices):
    """Who assisted at the birth — required on Form VIII (Notice of Birth)."""
    QUALIFIED_MIDWIFE           = "MIDWIFE", "Qualified Midwife"
    TRADITIONAL_BIRTH_ATTENDANT = "TBA",     "Traditional Birth Attendant"
    OTHER                       = "OTHER",   "Other"

class MaritalStatusChoices(models.TextChoices):
    """
    Parents' marital status at time of birth.
    NOT_MARRIED triggers paternity acknowledgement fields on the notice form.
    """
    MARRIED     = "MARRIED",     "Married"
    NOT_MARRIED = "NOT_MARRIED", "Not Married"

class EducationChoices(models.TextChoices):
    """Highest educational level attained by a parent or deceased person."""
    NEVER_BEEN = "NONE",      "Never Been to School"
    PRIMARY    = "PRIMARY",   "Primary"
    SECONDARY  = "SECONDARY", "Secondary"
    TERTIARY   = "TERTIARY",  "Tertiary"

class PlaceOfBirthChoices(models.TextChoices):
    """Where the birth occurred — governs which address field is mandatory."""
    HEALTH_FACILITY = "HEALTH_FACILITY", "Health Facility"
    HOME            = "HOME",            "Home"
    OTHER           = "OTHER",           "Other"

class RegistrationStatusChoices(models.TextChoices):
    """
    Secondary status enum used specifically by DeathRecords.
    Mirrors RecordStatus but is kept separate so death-specific workflow
    logic can diverge in the future without changing the shared enum.
    """
    PENDING  = "PENDING",  "Pending"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"

class PlaceOfDeathChoices(models.TextChoices):
    """Where the death occurred — drives which supplementary fields are required."""
    HEALTH_FACILITY = "HEALTH_FACILITY", "Health Facility"
    HOME            = "HOME",            "Home"
    OTHER           = "OTHER",           "Other"

class DeathTypeChoices(models.TextChoices):
    """
    Categorises the nature of the death.
    SUDDEN   — post-mortem examination required before burial permit can be issued.
    UNNATURAL — coroner's report required; police must complete Section C of the DNRPC.
    """
    NATURAL   = "NATURAL",   "Natural Death"
    SUDDEN    = "SUDDEN",    "Sudden Death — Post Mortem Required"
    UNNATURAL = "UNNATURAL", "Unnatural Cause"

class BurialAuthorityChoices(models.TextChoices):
    """
    The category of officer who is legally empowered to sign a Burial Permit
    (Form XI, Rules 30 & 37, 2016 Amendment Rules).
    """
    REGISTRAR  = "REGISTRAR",  "Registrar"
    MAGISTRATE = "MAGISTRATE", "Magistrate"
    POLICE     = "POLICE",     "Police Officer"
    OTHER      = "OTHER",      "Other Officer Specially Empowered"


# ============================================================================
# DEATH PIPELINE — Document 1 of 4
# ============================================================================

class MedicalCertificateCauseOfDeath(models.Model):
    """
    Maps to: MEDICAL CERTIFICATE OF THE CAUSE OF DEATH
             Medical No. 14 — Republic of Zambia, Ministry of Health

    The first document in the death-registration pipeline. Completed by the
    doctor who attended the deceased. Submitted by a Health Worker via
    POST /deaths/submit.

    Cause of death follows the standard WHO multi-level hierarchy:
        Part I  — direct chain: cause_a → cause_b → cause_c
        Part II — other significant conditions that contributed but are not
                  part of the direct chain (other_condition_1/2)

    Each cause field optionally carries its ICD code (_icd_code suffix) and
    an approximate interval between onset and death (_interval suffix).

    After submission, a DeathRecords entry is created referencing this MCCD.
    The certificate is finalised (status → APPROVED) only when the RO
    processes the linked DeathRecords submission.
    """

    # --- Reference ---
    medical_no = models.CharField(
        max_length=100, unique=True,null=True,
        help_text="Pre-printed medical number on the counterfoil",
    )

    # --- Doctor's Attendance Narrative ---
    # Captures the timeline of the doctor's clinical involvement with the patient
    attended_name = models.CharField(
        max_length=255,
        help_text="Full name of the person the doctor attended",
    )
    illness_start_date = models.DateField(
        help_text="Date doctor first attended during last illness",
    )
    last_attended_alive_date = models.DateField(
        help_text="Date doctor last attended the deceased alive",
        null=True,
        blank=True,
    )
    last_attended_alive_day = models.PositiveSmallIntegerField(
        help_text="Day of month — last attended alive (mirrors paper form layout)",
        null=True,
        blank=True,
    )
    death_date  = models.DateField(help_text="Date the person died")
    death_day   = models.PositiveSmallIntegerField(help_text="Day of month — died (mirrors paper form layout)")
    death_year  = models.PositiveSmallIntegerField(help_text="Year — died (last 2 digits as on form)")
    death_time  = models.TimeField(null=True, blank=True, help_text="Time of death if recorded")
    body_identified_of = models.CharField(
        max_length=255, help_text="Name of person whose body was formally identified",
    )
    age_stated = models.CharField(
        max_length=20, help_text="Age as stated on the form e.g. '45 years'",
    )

    # --- Post-mortem ---
    postmortem_confirmed = models.BooleanField(
        default=False,
        help_text="Whether cause of death was confirmed by post-mortem examination",
    )

    # --- Cause of Death Table — Part I: Direct Chain ---
    # (a) The disease or condition that directly led to death
    cause_a          = models.CharField(max_length=255, help_text="(a) Disease or condition directly leading to death")
    cause_a_interval = models.CharField(max_length=100, blank=True, null=True, help_text="Approximate interval between onset and death for (a)")
    cause_a_icd_code = models.CharField(max_length=20,  blank=True, null=True)

    # (b) The morbid condition that gave rise to (a)
    cause_b          = models.CharField(max_length=255, blank=True, null=True, help_text="(b) Morbid condition giving rise to (a) — accidental cause")
    cause_b_interval = models.CharField(max_length=100, blank=True, null=True)
    cause_b_icd_code = models.CharField(max_length=20,  blank=True, null=True)

    # (c) The underlying condition that gave rise to (b)
    cause_c          = models.CharField(max_length=255, blank=True, null=True, help_text="(c) Underlying condition giving rise to (b)")
    cause_c_interval = models.CharField(max_length=100, blank=True, null=True)
    cause_c_icd_code = models.CharField(max_length=20,  blank=True, null=True)

    # --- Cause of Death Table — Part II: Other Significant Conditions ---
    # Conditions that contributed to the death but are not part of the direct chain above
    other_condition_1          = models.CharField(max_length=255, blank=True, null=True, help_text="Section II — other significant condition 1")
    other_condition_1_interval = models.CharField(max_length=100, blank=True, null=True)
    other_condition_2          = models.CharField(max_length=255, blank=True, null=True, help_text="Section II — other significant condition 2")
    other_condition_2_interval = models.CharField(max_length=100, blank=True, null=True)

    # --- Doctor Sign-off ---
    witness_date                   = models.DateField(help_text="Date the doctor signed the certificate")
    certificate_handed_to          = models.CharField(max_length=255, help_text="Name and address of person to whom certificate was handed")
    medical_attendant_name         = models.CharField(max_length=255)
    medical_attendant_signature    = models.TextField(blank=True, null=True, help_text="Base64 signature or file reference")
    medical_attendant_qualification = models.CharField(max_length=255)
    medical_attendant_residence    = models.CharField(max_length=255)

    # --- Additional Location Information (bottom of form) ---
    village  = models.CharField(max_length=100, blank=True, null=True)
    chief    = models.CharField(max_length=100, blank=True, null=True)
    district = models.CharField(max_length=100, blank=True, null=True)

    # --- Informant Details ---
    # Stored flat here (not via FK) because the informant may not yet have a Citizen record
    informant_name             = models.CharField(max_length=255)
    informant_relationship     = models.CharField(max_length=100, blank=True, null=True)
    informant_contact_no       = models.CharField(max_length=20,  blank=True, null=True)
    informant_postal_address   = models.TextField(blank=True, null=True)
    informant_signature        = models.TextField(blank=True, null=True)
    informant_declaration_date = models.DateField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table    = "mccd"
        verbose_name = "Medical Certificate of Cause of Death"

    def __str__(self):
        return f"MCCD #{self.medical_no} — {self.attended_name}"


# ============================================================================
# DEATH PIPELINE — Document 2 of 4
# ============================================================================

class NoticeOfDeath(models.Model):
    """
    Maps to: NOTICE OF DEATH — DNRPC two-page form

    The second document in the death-registration pipeline. Completed by
    the informant (a relative, health worker, or police officer) and submitted
    via POST /deaths/submit/{death_record_id}/notice_of_death.

    This notice must be linked to an existing DeathRecords entry (created when
    the MCCD was submitted). Linking the notice sets ready_for_review = True,
    signalling that the RO can now process the complete submission.

    Form sections:
        Section A — Details of deceased (auto-populated from Citizen if DIN provided)
        Section B — Cause of death (FOR OFFICIAL USE ONLY — populated from MCCD by RO)
        Section C — Police / Brought-in-Dead certificate (unnatural/sudden deaths only)
        Section D — Details of informant (auto-populated from Citizen)
        Section E — Appendices checklist (booleans confirming attached documents)
    """

    # --- Reference ---
    serial_number  = models.CharField(max_length=20, unique=True)
    application_no = models.CharField(
        max_length=30, blank=True, null=True,
        help_text="Shaded field — assigned by official on receipt",
    )
    date_and_time = models.DateTimeField(help_text="Official date and time recorded on the form")

    # --- Section A: Details of Deceased ---
    # deceased_din links to an existing Citizen; if provided, most fields below
    # are auto-populated by the service rather than requiring manual entry.
    deceased_din          = models.CharField(max_length=20, blank=True, null=True)
    surname               = models.CharField(max_length=100)
    other_names           = models.CharField(max_length=255, blank=True, null=True)
    occupation            = models.CharField(max_length=100, blank=True, null=True)
    residential_address   = models.TextField(blank=True, null=True)
    district              = models.CharField(max_length=100)
    date_of_death         = models.DateField()
    place_of_death        = models.CharField(max_length=20, choices=PlaceOfDeathChoices.choices)
    place_of_death_name   = models.CharField(
        max_length=255, blank=True, null=True,
        help_text="Name of health facility or description of home/other location",
    )
    place_of_death_other  = models.CharField(max_length=255, blank=True, null=True)
    date_of_birth         = models.DateField(blank=True, null=True)
    age_at_death          = models.PositiveSmallIntegerField(blank=True, null=True)
    sex                   = models.CharField(max_length=10, choices=SexChoices.choices)
    nationality           = models.CharField(max_length=100, blank=True, null=True)
    national_identity_no  = models.CharField(max_length=30, blank=True, null=True, help_text="NRC number")
    social_security_no    = models.CharField(max_length=30, blank=True, null=True, help_text="NAPSA number")
    education_level      = models.CharField(max_length=20, choices=EducationChoices.choices, blank=True, null=True)

    # --- Section B: Cause of Death (FOR OFFICIAL USE ONLY) ---
    # Populated by the RO from the attached MCCD — not submitted by the informant.
    death_type         = models.CharField(max_length=20, choices=DeathTypeChoices.choices, blank=True, null=True,
                                          help_text="Health Facility / Home Based / Brought In Dead / Unnatural")
    immediate_cause    = models.CharField(max_length=255, blank=True, null=True)
    immediate_cause_icd = models.CharField(max_length=20, blank=True, null=True)
    antecedent_cause   = models.CharField(max_length=255, blank=True, null=True)
    antecedent_cause_icd = models.CharField(max_length=20, blank=True, null=True)
    underlying_cause   = models.CharField(max_length=255, blank=True, null=True)
    underlying_cause_icd = models.CharField(max_length=20, blank=True, null=True)

    # --- Section C: Police / Brought-in-Dead Certificate ---
    # Required for SUDDEN or UNNATURAL deaths; left blank for natural deaths.
    police_certifier_name         = models.CharField(max_length=255, blank=True, null=True, help_text="MR/MRS/MS name of certifier")
    police_certifier_residence    = models.CharField(max_length=255, blank=True, null=True)
    police_certifier_relationship = models.CharField(max_length=100, blank=True, null=True,
                                                      help_text="Relationship to deceased — confirms bringing in body")
    deceased_surname_police       = models.CharField(max_length=100, blank=True, null=True)
    deceased_other_names_police   = models.CharField(max_length=255, blank=True, null=True)
    deceased_age_police           = models.PositiveSmallIntegerField(blank=True, null=True)
    passed_away_date              = models.DateField(blank=True, null=True)
    passed_away_time              = models.TimeField(blank=True, null=True)
    passed_away_place             = models.CharField(max_length=255, blank=True, null=True)
    suddenly_suffering_from       = models.TextField(blank=True, null=True)  # Symptoms / illness description
    treatment_was_at              = models.CharField(max_length=255, blank=True, null=True)
    is_natural_death              = models.BooleanField(null=True, blank=True)
    is_sudden_death_postmortem_required = models.BooleanField(null=True, blank=True)

    # Police officer details — bottom of Section C
    police_no_and_rank    = models.CharField(max_length=100, blank=True, null=True)
    police_formation      = models.CharField(max_length=100, blank=True, null=True)
    police_officer_name   = models.CharField(max_length=255, blank=True, null=True)
    police_officer_signed = models.TextField(blank=True, null=True, help_text="Base64 signature or file reference")
    police_officer_date   = models.DateField(blank=True, null=True)

    # Doctor's remarks — reverse of Section C
    doctors_remarks              = models.TextField(blank=True, null=True)
    pupils_dilated_and_fixed     = models.BooleanField(null=True, blank=True)  # Clinical confirmation of death
    certifying_doctor_name       = models.CharField(max_length=255, blank=True, null=True)
    certifying_doctor_signature  = models.TextField(blank=True, null=True)
    certifying_doctor_date       = models.DateField(blank=True, null=True)

    # --- Section D: Details of Informant ---
    # Populated from the Citizen record identified by the submitted informant_din.
    informant_surname            = models.CharField(max_length=100)
    informant_other_names        = models.CharField(max_length=255, blank=True, null=True)
    informant_relationship       = models.CharField(max_length=100, help_text="Relationship to the deceased")
    informant_contact_no         = models.CharField(max_length=20, blank=True, null=True)
    informant_national_id        = models.CharField(max_length=30, blank=True, null=True)
    informant_nationality        = models.CharField(max_length=100, blank=True, null=True)
    informant_residential_address = models.TextField(blank=True, null=True)
    informant_postal_address     = models.TextField(blank=True, null=True)
    date_of_registration         = models.DateField(blank=True, null=True)

    # --- Section E: Appendices Checklist ---
    # Boolean flags confirming which physical supporting documents were attached
    has_mccd               = models.BooleanField(default=False, help_text="Original MCCD attached")
    has_informant_national_id = models.BooleanField(default=False, help_text="Copy of informant's NID attached")
    has_coroner_report     = models.BooleanField(default=False, help_text="Coroner's report attached (unnatural death)")

    # --- Informant's Declaration ---
    informant_declaration_name      = models.CharField(max_length=255, blank=True, null=True)
    informant_declaration_signature = models.TextField(blank=True, null=True)
    informant_declaration_date      = models.DateField(blank=True, null=True)

    # --- For Official Use Only (RO sign-off) ---
    assistant_registrar_name      = models.CharField(max_length=255, blank=True, null=True)
    assistant_registrar_signature = models.TextField(blank=True, null=True)
    registrar_name                = models.CharField(max_length=255, blank=True, null=True)
    registrar_signature           = models.TextField(blank=True, null=True)
    official_stamp_ref            = models.CharField(max_length=100, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notice_of_death"

    def __str__(self):
        return f"NoticeOfDeath #{self.serial_number} — {self.surname}, {self.other_names}"


# ============================================================================
# DEATH PIPELINE — Document 3 of 4
# ============================================================================

class BurialPermit(models.Model):
    """
    Maps to: PERMIT FOR BURIAL OR OTHER DISPOSAL OF A BODY
             Form XI — Rules 30 and 37
             The Births and Deaths Registration (General)(Amendment) Rules, 2016
             Stocked by DNRPC

    Generated automatically when an RO approves a DeathRecords submission.
    Linked 1-to-1 with the corresponding NoticeOfDeath.

    The permit authorises a named person/entity to proceed with burial or
    other disposal, issued by one of the legally empowered authorities
    listed in BurialAuthorityChoices.
    """

    # Link to the Notice of Death that this permit was issued against
    notice_of_death = models.OneToOneField(
        NoticeOfDeath,
        on_delete=models.PROTECT,
        related_name="burial_permit",
        null=True, blank=True,
        help_text="The Notice of Death this permit was issued against",
    )

    # --- Permit Content ---
    # The permit text reads: "I hereby authorise the burial or disposal by
    # [authorised_by_name] of the body of [deceased_name] who died at
    # [place_of_death] on the [day] day of [month], 20[year]"
    authorised_by_name = models.CharField(max_length=255, help_text="Name of person/entity authorised to carry out the burial")
    deceased_name      = models.CharField(max_length=255, help_text="Full name of the deceased")
    place_of_death     = models.CharField(max_length=255, help_text="Where the deceased died")
    date_of_death      = models.DateField()

    # --- Issuing Authority ---
    issuing_authority      = models.CharField(max_length=20, choices=BurialAuthorityChoices.choices,
                                              help_text="Which authority signed this permit")
    issuing_officer_name      = models.CharField(max_length=255, blank=True, null=True)
    issuing_officer_signature = models.TextField(blank=True, null=True, help_text="Base64 signature or file reference")
    issued_date               = models.DateField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "burial_permit"

    def __str__(self):
        return f"BurialPermit — {self.deceased_name} — issued {self.issued_date}"


# ============================================================================
# DEATH PIPELINE — Document 4 of 4
# ============================================================================

class DeathCertificate(models.Model):
    """
    Maps to: DEATH CERTIFICATE — Republic of Zambia

    The final legal document in the death-registration pipeline.
    Issued by the Registrar-General / Deputy Registrar-General / Registrar.

    Created automatically by the service when an RO approves a DeathRecords
    submission. Data is derived from NoticeOfDeath and MedicalCertificateCauseOfDeath
    — it is NEVER filled independently.

    The certificate is then accessible to the informant (a Citizen) via the
    GET /deaths/my_certificates endpoint.
    """

    # Upstream source documents — both protected from deletion once a certificate exists
    notice_of_death = models.OneToOneField(
        NoticeOfDeath,
        on_delete=models.PROTECT,
        related_name="death_certificate",
        null=True, blank=True,
    )
    mccd = models.OneToOneField(
        MedicalCertificateCauseOfDeath,
        on_delete=models.PROTECT,
        related_name="death_certificate",
        null=True, blank=True,
    )

    # --- Certificate Fields (as printed on the official document) ---
    registration_no = models.CharField(
        max_length=30, unique=True,
        help_text="Official registration number assigned by Registrar",
    )
    date_of_death = models.DateField()
    district      = models.CharField(max_length=100)
    place_of_death = models.CharField(max_length=255)

    # Deceased particulars
    deceased_names_and_surname = models.CharField(max_length=255)
    sex                        = models.CharField(max_length=10, choices=SexChoices.choices)
    age                        = models.CharField(max_length=20, help_text="Age as recorded e.g. '62 years'")
    nationality                = models.CharField(max_length=100, blank=True, null=True)
    occupation                 = models.CharField(max_length=100, blank=True, null=True)
    napsa_social_security_no   = models.CharField(max_length=30, blank=True, null=True)
    national_identity_no       = models.CharField(max_length=30, blank=True, null=True)
    cause_of_death             = models.TextField(help_text="Full cause of death as certified — may be multi-line (a/b/c)")

    # Informant details — copied from NoticeOfDeath at certificate generation time
    informant_name         = models.CharField(max_length=255)
    informant_relationship = models.CharField(max_length=100)

    # Registration and issuance metadata
    date_of_registration   = models.DateField()
    register_kept_at       = models.CharField(max_length=255, help_text="Location of the register e.g. 'Lusaka District Registry'")
    issued_date            = models.DateField()
    registrar_general_name = models.CharField(max_length=255, help_text="Name of the Registrar-General / Deputy / Registrar who signed")
    registrar_general_signature = models.TextField(blank=True, null=True, help_text="Base64 signature or file reference")
    official_stamp_ref     = models.CharField(max_length=100, blank=True, null=True, help_text="Embossed official seal reference")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "death_certificate"

    def __str__(self):
        return f"DeathCertificate #{self.registration_no} — {self.deceased_names_and_surname}"


# ============================================================================
# DEATH PIPELINE — Submission Tracker
# ============================================================================

class DeathRecords(models.Model):
    """
    Central submission tracker for the death-registration pipeline.

    Created by a Health Worker when an MCCD is submitted.
    Holds FKs to all four pipeline documents and tracks the review lifecycle.

    Workflow:
        1. Health Worker submits MCCD → DeathRecords created (status=PENDING,
           medical_certificate_of_death populated, ready_for_review=False)
        2. Citizen/Health Worker links a Notice of Death →
           notice_of_death populated, ready_for_review=True
        3. Registrar Officer reviews:
           - Approved → status=APPROVED, burial_permit and death_certificate
             created and linked, deceased Citizen status set to DECEASED
           - Rejected → status=REJECTED, rejection_reason stored

    On approval, the deceased Citizen's status is updated to DECEASED and
    their DIN is retired from active use.
    """

    status = models.CharField(
        max_length=20,
        choices=RegistrationStatusChoices.choices,
        default=RegistrationStatusChoices.PENDING,
    )

    # --- Pipeline document links (populated progressively as the case advances) ---
    medical_certificate_of_death = models.OneToOneField(
        MedicalCertificateCauseOfDeath,
        on_delete=models.CASCADE,
        related_name="mccd",
        null=True, blank=True,
    )
    notice_of_death = models.OneToOneField(
        NoticeOfDeath,
        on_delete=models.CASCADE,
        related_name="notice_of_death",
        null=True, blank=True,
    )
    burial_permit = models.OneToOneField(
        BurialPermit,
        on_delete=models.CASCADE,
        related_name="burial_permit",
        null=True, blank=True,
    )
    death_certificate = models.OneToOneField(
        DeathCertificate,
        on_delete=models.CASCADE,
        related_name="death_record",
        null=True, blank=True,
    )

    # --- Participants ---
    registrar = models.ForeignKey(
        "admin_ops.SystemUser",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="death_reviews",             # RO who processed the submission
    )
    health_worker = models.ForeignKey(
        "admin_ops.SystemUser",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="health_worker_that_submitted_inital_request",  # Health Worker who submitted the MCCD
    )
    informant = models.ForeignKey(
        "admin_ops.SystemUser",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="informant_that_submits_death_notice",           # Citizen/HW who submitted the Notice of Death
    )

    submitted_at = models.DateTimeField(auto_now_add=True)
    # True once the Notice of Death is linked — signals to the RO that the case is complete
    ready_for_review = models.BooleanField(default=False)
    reviewed_by = models.ForeignKey(
        "admin_ops.SystemUser",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="death_requests_reviewed",
    )
    reviewed_at      = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "death_registration_request"
        ordering = ["-submitted_at"]             # Most recent submissions appear first in queries

    def __str__(self):
        return f"DeathRegistrationRequest #{self.pk} [{self.status}]"


# ============================================================================
# BIRTH PIPELINE — Document 1 of 3
# ============================================================================

class NoticeOfBirth(models.Model):
    """
    Maps to: HOSPITAL NOTICE OF BIRTH — Form VIII (2016 Rev.)
             Rules 16, 17, 18 and 23
             Stocked by DNRPC

    The primary birth-registration document. Created by the service when a
    Health Worker submits a birth record via POST /births/submit.

    Most parent fields (name, NRC, NAPSA, occupation, nationality, address)
    are auto-populated from the mother's and father's Citizen records.
    The caller only needs to provide tribal/village details that are not
    stored on the Citizen model.

    Paternity acknowledgement:
        When marital_status == NOT_MARRIED, the father_acknowledgement_signature
        and mother_consent_signature fields are required to formally register
        the father on the notice.
    """

    # --- Official / Reference Fields ---
    serial_number = models.CharField(
        max_length=20, unique=True,
        help_text="Pre-printed serial on the form e.g. 0050984",
    )
    district     = models.CharField(max_length=100)
    date_and_time = models.DateTimeField(help_text="Official date and time recorded by facility")

    # --- Section 1: Details of Birth ---
    date_of_birth          = models.DateField()
    place_of_birth         = models.CharField(max_length=20, choices=PlaceOfBirthChoices.choices)
    health_facility_name   = models.CharField(max_length=255, blank=True, null=True, help_text="Required if born at health facility")
    home_address           = models.TextField(blank=True, null=True, help_text="Required if born at home")
    other_place_specified  = models.CharField(max_length=255, blank=True, null=True)

    # Child's identity
    child_surname    = models.CharField(max_length=100)
    child_given_name = models.CharField(max_length=100)
    child_other_names = models.CharField(max_length=255, blank=True, null=True)
    sex              = models.CharField(max_length=10, choices=SexChoices.choices)
    birth_weight_kg  = models.DecimalField(max_digits=4, decimal_places=2, help_text="Birth weight in kilograms")

    # --- Section 2: Details of Father ---
    # Core identity fields are auto-populated from the father's Citizen record;
    # tribal/village fields below are specific to the notice form.
    father_surname            = models.CharField(max_length=100, blank=True, null=True)
    father_other_names        = models.CharField(max_length=255, blank=True, null=True)
    father_dob                = models.DateField(blank=True, null=True)
    father_national_id        = models.CharField(max_length=30, blank=True, null=True, help_text="NRC / National Identity No.")
    father_occupation         = models.CharField(max_length=100, blank=True, null=True)
    father_social_id          = models.CharField(max_length=30, blank=True, null=True, help_text="Social Identity / NAPSA No.")
    father_village_of_origin  = models.CharField(max_length=100, blank=True, null=True)
    father_chief              = models.CharField(max_length=100, blank=True, null=True)
    father_district           = models.CharField(max_length=100, blank=True, null=True)
    father_tribe              = models.CharField(max_length=100, blank=True, null=True)
    father_nationality        = models.CharField(max_length=100, blank=True, null=True)
    father_residential_address = models.TextField(blank=True, null=True)
    father_contact_no         = models.CharField(max_length=20, blank=True, null=True)

    # --- Section 3: Details of Mother ---
    mother_surname            = models.CharField(max_length=100)
    mother_other_names        = models.CharField(max_length=255, blank=True, null=True)
    mother_maiden_surname     = models.CharField(max_length=100, blank=True, null=True)
    mother_dob                = models.DateField(blank=True, null=True)
    mother_national_id        = models.CharField(max_length=30, blank=True, null=True)
    mother_nationality        = models.CharField(max_length=100, blank=True, null=True)
    mother_occupation         = models.CharField(max_length=100, blank=True, null=True)
    mother_social_id          = models.CharField(max_length=30, blank=True, null=True)
    mother_village_of_origin  = models.CharField(max_length=100, blank=True, null=True)
    mother_chief              = models.CharField(max_length=100, blank=True, null=True)
    mother_district           = models.CharField(max_length=100, blank=True, null=True)
    mother_tribe              = models.CharField(max_length=100, blank=True, null=True)
    mother_education          = models.CharField(max_length=20, choices=EducationChoices.choices, blank=True, null=True)
    mother_residential_address = models.TextField(blank=True, null=True)
    mother_usual_place_of_residence = models.TextField(blank=True, null=True)

    # --- Attendant at Birth ---
    attendant_at_birth      = models.CharField(max_length=20, choices=AttendantChoices.choices)
    attendant_other_specified = models.CharField(max_length=255, blank=True, null=True)  # Required when attendant == OTHER

    # --- Acknowledgement of Parenthood ---
    marital_status = models.CharField(max_length=20, choices=MaritalStatusChoices.choices)
    # The four fields below are only populated when marital_status == NOT_MARRIED:
    father_acknowledgement_signature = models.TextField(blank=True, null=True,
                                                         help_text="Base64 signature — father acknowledges paternity")
    father_acknowledgement_date = models.DateField(blank=True, null=True)
    mother_consent_signature    = models.TextField(blank=True, null=True,
                                                   help_text="Base64 signature — mother consents to father being registered")
    mother_consent_date         = models.DateField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notice_of_birth"

    def __str__(self):
        return f"NoticeOfBirth #{self.serial_number} — {self.child_surname}, {self.child_given_name}"


# ============================================================================
# BIRTH PIPELINE — Document 2 of 3
# ============================================================================

class RecordOfBirth(models.Model):
    """
    Maps to: RECORD OF BIRTH — M.F.2
             Stocked by D.M.S. (District Medical Stores)

    The facility summary form, signed off by the officer in charge.
    Created alongside the NoticeOfBirth when a Health Worker submits
    a birth record via POST /births/submit.

    Unlike the Notice of Birth (which contains full parental detail),
    the Record of Birth captures high-level facility and sign-off information
    used for the official facility register.
    """

    # --- Reference ---
    serial_number = models.CharField(max_length=20, unique=True)
    file_number   = models.CharField(max_length=50, blank=True, null=True,
                                     help_text="Facility file / case number")

    # --- Child Details ---
    place_of_birth   = models.CharField(max_length=255)
    child_surname    = models.CharField(max_length=100)
    child_other_names = models.CharField(max_length=255, blank=True, null=True)
    sex              = models.CharField(max_length=10, choices=SexChoices.choices)
    birth_weight_kg  = models.DecimalField(max_digits=4, decimal_places=2, help_text="BWT — birth weight in kilograms")
    date_of_birth    = models.DateField()
    time_of_birth    = models.TimeField()

    # --- Father Details (condensed version for facility record) ---
    father_name            = models.CharField(max_length=255, blank=True, null=True)
    father_occupation      = models.CharField(max_length=100, blank=True, null=True)
    father_present_address = models.TextField(blank=True, null=True)

    # --- Mother Details ---
    mother_name = models.CharField(max_length=255)

    # --- Official Sign-off ---
    officer_in_charge  = models.CharField(max_length=255, blank=True, null=True)
    official_stamp_ref = models.CharField(max_length=100, blank=True, null=True,
                                          help_text="Reference or scan path for the official stamp")
    date_signed        = models.DateField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "record_of_birth"

    def __str__(self):
        return f"RecordOfBirth #{self.serial_number} — {self.child_surname}, {self.child_other_names}"


# ============================================================================
# BIRTH PIPELINE — Document 3 of 3
# ============================================================================

class BirthCertificate(models.Model):
    """
    The final birth certificate — the official legal document.

    Created ONLY when a Registrar Officer approves a BirthRecords submission.
    Data is assembled from the linked NoticeOfBirth and RecordOfBirth.

    On creation:
        - A new Citizen record for the child is created with status=INACTIVE.
          The child must complete the full citizen registration process to become ACTIVE.
        - The generated certificate is accessible to the mother or father via
          GET /births/my_certificates.

    mother_system_user and father_system_user link to the system accounts so
    that the certificate can be filtered by citizen ID in the retrieval endpoint.
    """

    # SystemUser FKs allow filtering certificates by the parent's account ID.
    # SET_NULL is used so the certificate survives account deletion.
    mother_system_user = models.ForeignKey(
        "admin_ops.SystemUser",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="birth_certificates_as_mother",
    )
    father_system_user = models.ForeignKey(
        "admin_ops.SystemUser",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="birth_certificates_as_father",
    )

    # --- Certificate Fields (as printed on the official document) ---
    reg_no            = models.CharField(max_length=20, unique=True)   # Generated child DIN used as registration number
    district          = models.CharField(max_length=100)
    date_of_birth     = models.DateField()
    sex               = models.CharField(max_length=10, choices=SexChoices.choices)
    place_of_birth    = models.CharField(max_length=255)
    surname           = models.CharField(max_length=100)
    other_names       = models.CharField(max_length=255, blank=True, null=True)

    # Father details (copied from NoticeOfBirth at approval time)
    father_name        = models.CharField(max_length=255, blank=True, null=True)
    father_occupation  = models.CharField(max_length=100, blank=True, null=True)
    father_nssf        = models.CharField(max_length=30, blank=True, null=True)   # NAPSA/social security number
    father_nationality = models.CharField(max_length=100, blank=True, null=True)
    father_nid         = models.CharField(max_length=30, blank=True, null=True)   # NRC / National Identity number

    # Mother details (copied from NoticeOfBirth at approval time)
    mother_name        = models.CharField(max_length=255)
    mother_maiden      = models.CharField(max_length=100, blank=True, null=True)
    mother_nssf        = models.CharField(max_length=30, blank=True, null=True)
    mother_nationality = models.CharField(max_length=100, blank=True, null=True)
    mother_nid         = models.CharField(max_length=30, blank=True, null=True)

    # Informant details (officer in charge acts as informant on the certificate)
    informant_name    = models.CharField(max_length=255, blank=True, null=True)
    informant_address = models.TextField(blank=True, null=True)
    postal_address    = models.CharField(max_length=255, blank=True, null=True)

    # Registration metadata
    date_of_registration = models.DateField()
    registrar_name       = models.CharField(max_length=255)
    certificate_url      = models.URLField(null=True, blank=True)       # URL to the generated PDF certificate
    verification_hash    = models.CharField(max_length=255, null=True, blank=True)  # Hash for digital verification

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "birth_certificate"

    def __str__(self):
        return f"BirthCertificate #{self.reg_no} — {self.surname}, {self.other_names}"


# ============================================================================
# BIRTH PIPELINE — Submission Tracker
# ============================================================================

class BirthRecords(models.Model):
    """
    Central submission tracker for the birth-registration pipeline.

    Created by a Health Worker when a birth record is submitted.
    Links the NoticeOfBirth and RecordOfBirth created at submission time,
    and the BirthCertificate created only on RO approval.

    Workflow:
        1. Health Worker submits → BirthRecords created (status=PENDING),
           NoticeOfBirth and RecordOfBirth populated.
        2. Registrar Officer reviews:
           - Approved → status=APPROVED, BirthCertificate created and linked,
             child Citizen record created with status=INACTIVE.
           - Rejected → status=REJECTED, rejection_reason stored.
    """

    # --- Parent Citizen references (looked up via DIN) ---
    mother = models.ForeignKey(
        Citizen,
        on_delete=models.PROTECT,       # Protect: cannot delete a Citizen who has a birth submission
        null=True, blank=False,
        related_name="births_as_mother",
        to_field="din",
    )
    father = models.ForeignKey(
        Citizen,
        on_delete=models.SET_NULL,      # Father reference is optional; set null if Citizen is removed
        null=True, blank=True,
        related_name="births_as_father",
        to_field="din",
    )

    # --- Pipeline document links (1-to-1) ---
    notice_of_birth = models.OneToOneField(
        NoticeOfBirth,
        on_delete=models.CASCADE,
        related_name="notice_of_birth",
        null=True, blank=True,
    )
    record_of_birth = models.OneToOneField(
        RecordOfBirth,
        on_delete=models.CASCADE,
        related_name="record_of_birth",
        null=True, blank=True,
    )
    birth_certificate = models.OneToOneField(
        BirthCertificate,
        on_delete=models.CASCADE,
        related_name="notice_of_birth",
        null=True, blank=True,          # Null until the submission is approved
    )

    submitted_at = models.DateTimeField(auto_now_add=True)

    # --- Review audit trail ---
    registrar = models.ForeignKey(
        "admin_ops.SystemUser",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="birth_reviews",   # RO who made the approval/rejection decision
    )
    health_worker = models.ForeignKey(
        "admin_ops.SystemUser",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="birth_submissions_as_worker",  # Health Worker who submitted the record
    )
    reviewed_at      = models.DateTimeField(null=True, blank=True)
    status           = models.CharField(
        max_length=20,
        choices=RecordStatus.choices,
        default=RecordStatus.PENDING,
    )
    rejection_reason = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "birth_record_submissions"
        indexes = [
            models.Index(fields=["status"]),       # Speed up filtering by status (RO pending queue)
            models.Index(fields=["submitted_at"]), # Speed up chronological ordering
        ]

    def __str__(self):
        return f"Submission #{self.id} — {self.status}"


# ============================================================================
# OFFLINE SYNC
# ============================================================================

class OfflineSyncQueue(models.Model):
    """
    Stores birth/death records submitted by the hospital app while offline.

    When the app has no connectivity it serialises each completed form to JSON
    and saves it locally. On reconnect, the app POSTs the entire queue to
    POST /hospital/sync as an OfflineSyncBatchCreate payload.

    The server then processes each entry:
        - Success → status=SYNCED, synced_at populated
        - Failure → status=FAILED, error_message populated for admin review

    event_type ("BIRTH" or "DEATH") determines which service function and
    model the payload dict is hydrated into.
    """

    device_id  = models.CharField(max_length=100)  # Unique identifier for the submitting device (e.g. tablet serial)
    payload    = models.JSONField()                 # Full record dict — BirthRecordSubmission or MedicalCertificateCauseOfDeathCreate
    event_type = models.CharField(
        max_length=10,
        choices=[("BIRTH", "Birth"), ("DEATH", "Death")],
    )
    queued_at = models.DateTimeField()              # Device-side timestamp (may differ from server receipt time)
    synced_at = models.DateTimeField(null=True, blank=True)   # Server-side timestamp when processing succeeded
    status    = models.CharField(
        max_length=10,
        choices=SyncStatus.choices,
        default=SyncStatus.QUEUED,
    )
    error_message = models.TextField(null=True, blank=True)   # Populated when status == FAILED

    class Meta:
        db_table = "offline_sync_queue"
        indexes = [
            # Composite index to efficiently retrieve all failed/queued records for a given device
            models.Index(fields=["device_id", "status"]),
        ]
    def __str__(self):
        return f"Sync [{self.event_type}] from {self.device_id} — {self.status}"