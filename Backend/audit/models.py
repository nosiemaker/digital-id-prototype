from django.db import models

class Outcome(models.TextChoices):
    SUCCESS = "SUCCESS", "Success"
    FAILURE = "FAILURE", "Failure"

class AuditLog(models.Model):

    actor_id = models.CharField(max_length=50)
    actor_role = models.CharField(max_length=30)
    action = models.CharField(max_length=100)
    target_type = models.CharField(max_length=50)
    target_id = models.CharField(max_length=50)
    outcome = models.CharField(max_length=10, choices=Outcome.choices, default=Outcome.SUCCESS)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    metastamp = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    log_signature = models.CharField(max_length=64, null=True, blank=True)

    class Meta:
        db_table = "audit_logs"
        indexes = [
            models.Index(fields=["actor_id"]),
            models.Index(fields=["action"]),
            models.Index(fields=["target_type", "target_id"]),
            models.Index(fields=["timestamp"]),
        ]

        ordering = ["-timestamp"]
    
    def __str__(self):
         return f"[{self.timestamp}] {self.actor_role}:{self.actor_id} — {self.action} on {self.target_type}:{self.target_id}"