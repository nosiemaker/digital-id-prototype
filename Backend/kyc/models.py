from django.db import models
from citizens.models import Citizen


class InstitutionStatus(models.TextChoices):
    PENDING = "PENDING", "Pending Approval"
    ACTIVE = "ACTIVE", "Active"
    SUSPENDED = "SUSPENDED", "Suspended"
    REVOKED = "REVOKED", "Revoked"
    REJECTED = "REJECTED","Rejected"


class KYCRequestStatus(models.TextChoices):
    PENDING = "PENDING", "Awaiting Citizen Response"
    APPROVED = "APPROVED", "Approved"
    DENIED = "DENIED", "Denied"
    EXPIRED = "EXPIRED", "Expired"


class ThirdPartyInstitution(models.Model):
    """
    External institutions (banks, telecoms, etc.) that can request KYC data.
    Registrar enrolls and approves them. OIDC credentials generated on approval.
    """
    email = models.EmailField(unique=True,null=True)
    institution_id = models.CharField(max_length=20, blank=True, null=True, unique=True)
    name = models.CharField(max_length=255)
    reg_number = models.CharField(max_length=100, unique=True)  # Business registration number
    oidc_client_id = models.CharField(max_length=128, unique=True, null=True, blank=True)
    oidc_secret = models.CharField(max_length=255, null=True, blank=True)  # hashed
    permitted_scope = models.JSONField(default=list, blank=True)  # e.g. ["full_name", "dob", "phone"]
    status = models.CharField(
        max_length=20,
        choices=InstitutionStatus.choices,
        default=InstitutionStatus.PENDING,
    )
    enrolled_by = models.ForeignKey(
        "admin_ops.SystemUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="enrolled_institutions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "third_party_institutions"
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["reg_number"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.status})"


class KYCRequest(models.Model):
    """
    Institution requests specific citizen data fields.
    Citizen must explicitly approve or deny — no data shared without consent.
    fields_requested: list of field names the institution wants
    fields_granted: subset the citizen approved (null until responded)
    """
    institution = models.ForeignKey(
        ThirdPartyInstitution,
        on_delete=models.CASCADE,
        related_name="kyc_requests",
    )
    citizen_din = models.CharField(max_length=12)  # Store DIN directly for lookup speed
    citizen = models.ForeignKey(
        Citizen,
        on_delete=models.CASCADE,
        related_name="kyc_requests",
        to_field="din",
    )
    fields_requested = models.JSONField()  # e.g. ["full_name", "dob", "phone"]
    fields_granted = models.JSONField(null=True, blank=True)  # set on citizen response
    status = models.CharField(
        max_length=20,
        choices=KYCRequestStatus.choices,
        default=KYCRequestStatus.PENDING,
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)  # auto-expire after 24h

    class Meta:
        db_table = "kyc_requests"
        indexes = [
            models.Index(fields=["citizen_din", "status"]),
            models.Index(fields=["institution", "status"]),
        ]

    def __str__(self):
        return f"KYC: {self.institution} → {self.citizen_din} ({self.status})"


class ConsentRecord(models.Model):
    """
    Immutable record of every KYC consent decision.
    Written once on citizen response, never updated.
    """
    kyc_request = models.OneToOneField(
        KYCRequest,
        on_delete=models.CASCADE,
        related_name="consent_record",
    )
    citizen = models.ForeignKey(
        Citizen,
        on_delete=models.CASCADE,
        related_name="consent_records",
    )
    decision = models.CharField(
        max_length=10,
        choices=[("APPROVED", "Approved"), ("DENIED", "Denied")],
    )
    fields_shared = models.JSONField(null=True, blank=True)  # null if denied
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "consent_records"

    def __str__(self):
        return f"Consent {self.decision} by {self.citizen} for {self.kyc_request}"
