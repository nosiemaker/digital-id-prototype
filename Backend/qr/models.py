from django.db import models


class QRLog(models.Model):
    """Optional: Log QR generation/verification events for audit purposes."""
    din = models.CharField(max_length=12, db_index=True)
    event_type = models.CharField(
        max_length=20,
        choices=[
            ("generated", "Generated"),
            ("verified", "Verified"),
            ("expired", "Expired"),
            ("invalid", "Invalid Signature"),
        ],
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["din", "-timestamp"]),
        ]

    def __str__(self):
        return f"{self.event_type.upper()} - {self.din} - {self.timestamp}"

