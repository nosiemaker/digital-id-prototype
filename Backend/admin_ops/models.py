from django.db import models


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


class SystemUser(models.Model):
    """
    All users across all roles. Citizens who use the mobile app are also SystemUsers.
    password_hash: bcrypt hash. Never store plain text.
    citizen_din: only populated for CITIZEN role — links to Citizen record.
    is_active: set False to suspend without deleting.
    """
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
    )
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    citizen_din = models.CharField(max_length=12, null=True, blank=True)  # For CITIZEN role
    is_active = models.BooleanField(default=True)
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
        return f"{self.name} ({self.role})"


class Transaction(models.Model):
    """
    GSB payment transactions. Initiated by third-party institution,
    confirmed by citizen via biometric challenge.
    citizen_din: the citizen being charged.
    institution: FK to ThirdPartyInstitution via string ref (kyc app).
    """
    citizen_din = models.CharField(max_length=12)
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
