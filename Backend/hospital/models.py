from django.db import models
from citizens.models import Citizen


class RecordStatus(models.TextChoices):
    PENDING = "PENDING", "Pending RO Review"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"


class SyncStatus(models.TextChoices):
    QUEUED = "QUEUED", "Queued"
    SYNCED = "SYNCED", "Synced"
    FAILED = "FAILED", "Failed"


class BirthRecord(models.Model):
    """
    child_din: null until RO approves — triggers DIN generation + FamilyLink creation.
    mother_din: must exist as an active Citizen.
    On approval: child Citizen record created, DIN issued, FamilyLink(CHILD/PARENT) written.
    """
    child_din = models.CharField(max_length=12, null=True, blank=True)
    mother_din = models.CharField(max_length=12)
    mother = models.ForeignKey(
        Citizen,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="births_as_mother",
        to_field="din",
    )
    health_worker = models.ForeignKey(
        "admin_ops.SystemUser",
        on_delete=models.SET_NULL,
        null=True,
        related_name="birth_records_filed",
    )
    facility = models.CharField(max_length=255)
    location = models.CharField(max_length=255) 
    child_full_name = models.CharField(max_length=255)
    child_dob = models.DateField()
    child_sex = models.CharField(
        max_length=10,
        choices=[("MALE", "Male"), ("FEMALE", "Female"), ("OTHER", "Other")],
    )
    born_at = models.DateTimeField()
    status = models.CharField(
        max_length=20,
        choices=RecordStatus.choices,
        default=RecordStatus.PENDING,
    )
    reviewed_by = models.ForeignKey(
        "admin_ops.SystemUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="birth_records_reviewed",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)
    certificate_url = models.URLField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "birth_records"
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["mother_din"]),
        ]

    def __str__(self):
        return f"Birth: {self.child_full_name} (mother: {self.mother_din}) — {self.status}"


class DeathRecord(models.Model):
    """
    Recorded by Health Worker when a citizen dies.
    On RO approval: CitizenStatus set to DECEASED, DIN retired.
    cause_icd11: ICD-11 code string, e.g. "BA00" (Cholera)
    """
    deceased_din = models.CharField(max_length=12)
    deceased = models.ForeignKey(
        Citizen,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="death_record",
        to_field="din",
    )
    health_worker = models.ForeignKey(
        "admin_ops.SystemUser",
        on_delete=models.SET_NULL,
        null=True,
        related_name="death_records_filed",
    )
    facility = models.CharField(max_length=255)
    cause_icd11 = models.CharField(max_length=20)  # ICD-11 code
    cause_description = models.CharField(max_length=255, blank=True)
    died_at = models.DateTimeField()
    status = models.CharField(
        max_length=20,
        choices=RecordStatus.choices,
        default=RecordStatus.PENDING,
    )
    reviewed_by = models.ForeignKey(
        "admin_ops.SystemUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="death_records_reviewed",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)
    certificate_url = models.URLField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "death_records"
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["deceased_din"]),
        ]

    def __str__(self):
        return f"Death: {self.deceased_din} ({self.cause_icd11}) — {self.status}"


class OfflineSyncQueue(models.Model):
    """
    Stores birth/death records submitted by hospital app while offline.
    On reconnect, the app POSTs its queue to /hospital/sync.
    event_type: "BIRTH" or "DEATH" — determines which model to hydrate from payload.
    """
    device_id = models.CharField(max_length=100)  # Unique device identifier
    payload = models.JSONField()                   # Full record data as JSON
    event_type = models.CharField(
        max_length=10,
        choices=[("BIRTH", "Birth"), ("DEATH", "Death")],
    )
    queued_at = models.DateTimeField()   # Timestamp from the device
    synced_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=10,
        choices=SyncStatus.choices,
        default=SyncStatus.QUEUED,
    )
    error_message = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "offline_sync_queue"
        indexes = [
            models.Index(fields=["device_id", "status"]),
        ]

    def __str__(self):
        return f"Sync [{self.event_type}] from {self.device_id} — {self.status}"
