from django.db import models

from kyc.models import ThirdPartyInstitution
from registration.models import EnrollmentStatus


class UserRole(models.TextChoices):
    CITIZEN = "CITIZEN", "Citizen"
    REGISTRATION_OFFICER = "RO", "Registration Officer"
    REGISTRAR = "REGISTRAR", "Registrar"
    SUPERVISOR = "SUPERVISOR", "Supervisor"
    HEALTH_WORKER = "HEALTH_WORKER", "Health Worker"
    THIRD_PARTY = "THIRD_PARTY", "Third Party"


class TransactionStatus(models.TextChoices):
    INITIATED = "INITIATED", "Initiated"
    PENDING_CONFIRMATION = "PENDING_CONFIRMATION", "Pending Citizen Confirmation"
    CONFIRMED = "CONFIRMED", "Confirmed"
    FAILED = "FAILED", "Failed"
    EXPIRED = "EXPIRED", "Expired"


class TransactionMethod(models.TextChoices):
    MTN_MOMO = "MTN_MOMO", "MTN Mobile Money"
    AIRTEL_MONEY = "AIRTEL_MONEY", "Airtel Money"
    BANK_TRANSFER = "BANK_TRANSFER", "Bank Transfer"

class ThirdPartyEnrollmentRequest(models.Model):

    third_party_institution = models.OneToOneField(
        ThirdPartyInstitution,
        on_delete=models.CASCADE,
        related_name="enrollment_request",
    )
    submitted_at = models.DateTimeField(auto_now_add=True)


    registrar = models.ForeignKey(
        "admin_ops.SystemUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="third_party_enrollment_requests_reviewed",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=EnrollmentStatus.choices,
        default=EnrollmentStatus.PENDING,
    )
    rejection_reason = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "third_party_enrollment_requests"
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["submitted_at"]),
        ]

    def __str__(self):
        return f"Enrollment for {self.third_party_institution}-{self.id} — {self.status}"


class SystemUser(models.Model):
    """
    All users across all roles. Citizens who use the mobile app are also SystemUsers.
    password_hash: bcrypt hash. Never store plain text.
    citizen_din: only populated for CITIZEN role — links to Citizen record.
    is_active: set False to suspend without deleting.
    """
    role = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=255,null=True)
    name = models.CharField(max_length=255)
    citizen_din = models.CharField(max_length=20,blank=True, unique=True,null=True)
    institution_din = models.CharField(max_length=20, blank=True, unique=True, null=True)
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_login = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "system_users"
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["role"]),
            models.Index(fields=["citizen_din"]),
        ]

    def __str__(self):
        return f"{self.id} ({self.role})"


class Transaction(models.Model):
    """
    GSB payment transactions. Initiated by third-party institution,
    confirmed by citizen via biometric challenge.
    citizen_din: the citizen being charged.
    institution: FK to ThirdPartyInstitution via string ref (kyc app).
    """
    citizen_din = models.CharField(max_length=20)
    institution = models.ForeignKey(
        "kyc.ThirdPartyInstitution",
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="ZMW")
    method = models.CharField(
        max_length=20,
        choices=TransactionMethod.choices,
    )
    status = models.CharField(
        max_length=30,
        choices=TransactionStatus.choices,
        default=TransactionStatus.INITIATED,
    )
    reference = models.CharField(max_length=64, unique=True)  # External reference from institution
    # Biometric challenge: nonce the citizen signs to confirm the transaction
    biometric_challenge = models.CharField(max_length=64, null=True, blank=True)
    initiated_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "transactions"
        indexes = [
            models.Index(fields=["citizen_din", "status"]),
            models.Index(fields=["reference"]),
        ]

    def __str__(self):
        return f"TXN {self.reference} — {self.citizen_din} {self.amount} {self.currency} ({self.status})"
