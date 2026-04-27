from django.db import models

from zdid_core import settings


# Create your models here.
class CitizenStatus(models.TextChoices):
    PENDING = "PENDING", "pending"
    ACTIVE = "ACTIVE", "active"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED", "suspended"
    DECEASED = "DECEASED", "deceased"
    REJECTED = "REJECTED"


class Language(models.TextChoices):
    ENGLISH = "en", "English"
    BEMBA = "bem", "Bemba"
    NYANJA = "nya", "Nyanja"
    TONGA = "toi", "Tonga"
    LOZI = "loz", "Lozi"


class Gender(models.TextChoices):
    MALE = "MALE", "Male"
    FEMALE = "FEMALE", "Female"


class RelationshipType(models.TextChoices):
    PARENT = "PARENT", "Parent"
    CHILD = "CHILD", "Child"
    SIBLING = "SIBLING", "Sibling"
    SPOUSE = "SPOUSE", "Spouse"
    GUARDIAN = "GUARDIAN", "Guardian"


class UserType(models.TextChoices):
    CHILD_ABOVE_16 = "CHILD_ABOVE_16", "Child above 16"
    CHILD_UNDER_16 = "CHILD_UNDER_16", "Child under 16"
    ADULT = "ADULT", "Adult"
    SENIOR = "SENIOR", "Senior"


class Province(models.Model):
    """Province model - represents a province/region"""
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=10, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "province"
        verbose_name_plural = "provinces"

    def __str__(self):
        return self.name


class District(models.Model):
    """District model - belongs to a province, can have multiple staff stationed"""
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10)
    province = models.ForeignKey(Province, on_delete=models.CASCADE, related_name="districts")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "district"
        unique_together = ("name", "province")

    def __str__(self):
        return f"{self.name} ({self.province.name})"


class Citizen(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True,
                                related_name="profile")
    din = models.CharField(max_length=20, unique=True, null=True, blank=True)
    nrc = models.CharField(max_length=15, unique=True, null=True)
    full_name = models.CharField(max_length=255)
    residential_address = models.CharField(max_length=255, null=True)
    dob = models.DateField()
    phone = models.CharField(max_length=20, null=True, blank=True)
    gender = models.CharField(max_length=10, choices=Gender.choices, null=True, blank=True)
    nrc_front_url = models.URLField(max_length=500, null=True, blank=True)
    nrc_back_url = models.URLField(max_length=500, null=True, blank=True)
    face_image_url = models.URLField(max_length=500, null=True, blank=True)
    district = models.ForeignKey('District', on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name="citizens")
    public_key = models.TextField(null=True)
    activation_nonce = models.CharField(max_length=64, null=True, blank=True)
    status = models.CharField(max_length=20, choices=CitizenStatus.choices, default=CitizenStatus.PENDING)
    language = models.CharField(max_length=20, choices=Language.choices, default=Language.ENGLISH)
    challenge_expires_at = models.DateTimeField(null=True, blank=True)
    citizen_type = models.CharField(max_length=20, choices=UserType.choices, default=UserType.ADULT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "citizen"
        indexes = [
            models.Index(fields=["din"]),
            models.Index(fields=["nrc"]),
            models.Index(fields=["status"]),
            models.Index(fields=["gender"]),
            models.Index(fields=["district"]),
        ]

    def __str__(self):
        return f"{self.full_name}({self.din or 'PENDING'})"


class BiometricRecord(models.Model):
    """
    Stores the facial biometric data captured by the Registration Officer
    during in-person enrollment. There are THREE separate things stored here
    and it is important to understand why each one exists:

    ── 1. embedding_vector (JSONField, list of 512 floats) ───────────────────
    This is the raw output from InsightFace — a 512-dimensional vector where
    each float represents a facial feature measurement (eye spacing, jaw shape,
    nose bridge, etc.). Think of it as the face's "coordinates" in a
    mathematical space where similar faces land close together.

    WHY STORE IT: Used for deduplication. Before issuing a DIN, the system
    computes cosine similarity between this new vector and every existing
    stored vector. If similarity > 0.85, the person is already enrolled under
    a different NRC — fraud detected, enrollment rejected.

    This field is NEVER exposed via API. It stays server-side only.

    Standard reference: ISO/IEC 19794-5 (face image data format),
                        ISO/IEC 30137 (deep learning face recognition)

    ── 2. embedding_quantized (BinaryField, 64 bytes = 512 bits) ────────────
    A compressed, stable version of the embedding vector. Each of the 512
    floats is reduced to a single bit: 1 if the float is positive, 0 if
    negative. This gives us 512 bits = 64 bytes.

    WHY STORE IT: The raw float vector shifts slightly between captures
    (different lighting, slight angle change, ageing). The sign of each
    float component is much more stable — the same person reliably produces
    the same sign pattern even across different captures.

    This quantized binary is what gets hashed to derive the DIN. It acts
    as the stable "fingerprint" of the face that we can reproduce consistently.

    ── 3. din_commitment (CharField, 64 hex chars) ──────────────────────────
    A SHA-256 hash of (embedding_quantized + BIOMETRIC_SALT). This is stored
    alongside the DIN so we can verify: "does this face's biometric match
    the DIN on this ID card?" without storing anything reversible.

    WHY STORE IT: Tamper detection and re-verification. If an RO later
    questions a DIN, we can re-extract the face embedding, re-derive the
    commitment, and confirm it matches what was stored at enrollment.

    Standard reference: ISO/IEC 24745 (biometric information protection —
                        defines salting and cancelable biometrics)

    ── Why NOT use FaceID/TouchID templates ─────────────────────────────────
    Apple and Google explicitly prevent apps from extracting the raw template
    from the secure enclave. The device biometric APIs only return
    "authenticated / not authenticated" — you cannot pull out a byte sequence.
    This is by design for user privacy. We use InsightFace server-side
    for enrollment (supervised, in-person with RO) and device biometrics
    only for day-to-day app login convenience (Capacitor biometric-auth plugin).
    """
    citizen = models.OneToOneField(Citizen, on_delete=models.CASCADE, related_name="biometric_record")
    embedding_vector = models.JSONField(null=True, blank=True, help_text="512-float InsightFace embedding.")
    embedding_quantized = models.BinaryField(null=True, blank=True,
                                             help_text="64-bytes quantized embedding. Stable across caputers. Input to DIN derivation.")
    din_commitment = models.CharField(max_length=64, null=True, blank=True,
                                      help_text="SHA-256(quantized_embedding + salt). Used to very face-to-DIN binding.")
    face_image_path = models.CharField(max_length=500, null=True, blank=True,
                                       help_text="secure storage path to the original face photo"
                                       )
    facial_template = models.TextField(null=True, blank=True)
    captured_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "biometric_record"

    def __str__(self):
        return f"Biometric for {self.citizen}"


class FamilyLink(models.Model):
    citizen = models.ForeignKey(Citizen, on_delete=models.CASCADE, related_name="family_link_from")
    related_citizen = models.ForeignKey(Citizen, on_delete=models.CASCADE, related_name="family_link_to")
    relationship_type = models.CharField(max_length=20, choices=RelationshipType.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "family_link"
        unique_together = ("citizen", "related_citizen", "relationship_type")

    def __str__(self):
        return f"{self.citizen} '{self.relationship_type}' {self.related_citizen}"


class Registrar(models.Model):
    """Registrar - responsible for overseeing registration operations"""
    citizen = models.ForeignKey(Citizen, on_delete=models.CASCADE, related_name="registrar_profile")
    employee_id = models.CharField(max_length=50, unique=True)
    department = models.CharField(max_length=100, null=True, blank=True)
    district = models.ForeignKey('District', on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name="registrars")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "registrar"

    def __str__(self):
        return f"Registrar {self.employee_id} - {self.citizen}"


class Supervisor(models.Model):
    """Supervisor - oversees registration officers and registration processes"""
    citizen = models.ForeignKey(Citizen, on_delete=models.CASCADE, related_name="supervisor_profile")
    employee_id = models.CharField(max_length=50, unique=True)
    department = models.CharField(max_length=100, null=True, blank=True)
    district = models.ForeignKey('District', on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name="supervisors")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "supervisor"

    def __str__(self):
        return f"Supervisor {self.employee_id} - {self.citizen}"


class HealthWorker(models.Model):
    """Health Worker - handles health-related citizen services"""
    citizen = models.ForeignKey(Citizen, on_delete=models.CASCADE, related_name="health_worker_profile")
    employee_id = models.CharField(max_length=50, unique=True)
    facility_name = models.CharField(max_length=200, null=True, blank=True)
    department = models.CharField(max_length=100, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "health_worker"

    def __str__(self):
        return f"Health Worker {self.employee_id} - {self.citizen}"


class RegistrationOfficer(models.Model):
    """Registration Officer - handles citizen registration and enrollment"""
    citizen = models.ForeignKey(Citizen, on_delete=models.CASCADE, related_name="registration_officer_profile")
    employee_id = models.CharField(max_length=50, unique=True)
    station_name = models.CharField(max_length=200, null=True, blank=True)
    district = models.ForeignKey('District', on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name="registration_officers")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "registration_officer"

    def __str__(self):
        return f"Registration Officer {self.employee_id} - {self.citizen}"
