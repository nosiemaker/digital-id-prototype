from django.db import models
from citizens.models import Citizen


class EnrollmentStatus(models.TextChoices):
    PENDING = "PENDING", "Pending Review"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"


class EnrollmentRequest(models.Model):
    """
    Created when a citizen submits their NRC + public key for enrollment.
    RO reviews this record, approves or rejects it.
    On approval: DIN is generated, CitizenStatus set to ACTIVE.
    """
    citizen = models.OneToOneField(
        Citizen,
        on_delete=models.CASCADE,
        related_name="enrollment_request",
    )
    submitted_at = models.DateTimeField(auto_now_add=True)

    # RO who reviewed this request (FK to admin_ops.SystemUser via string ref)
    ro = models.ForeignKey(
        "admin_ops.SystemUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="enrollment_requests_reviewed",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=EnrollmentStatus.choices,
        default=EnrollmentStatus.PENDING,
    )
    rejection_reason = models.TextField(null=True, blank=True)

    # Activation challenge: random nonce sent to citizen after approval
    # Citizen must sign it with their private key to prove key ownership
    activation_challenge = models.CharField(max_length=64, null=True, blank=True)
    activation_challenge_expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "enrollment_requests"
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["submitted_at"]),
        ]

    def __str__(self):
        return f"Enrollment for {self.citizen}-{self.id} — {self.status}"


class RegistrationOfficer(models.Model):
    """
    Profile extension for users with RO role.
    Linked to SystemUser via OneToOne.
    """
    user = models.OneToOneField(
        "admin_ops.SystemUser",
        on_delete=models.CASCADE,
        related_name="ro_profile",
    )
    district = models.CharField(max_length=100)
    enrolled_by = models.ForeignKey(
        "admin_ops.SystemUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="enrolled_ros",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "registration_officers"

    def __str__(self):
        return f"RO: {self.user} — {self.district}"
