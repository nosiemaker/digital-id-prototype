from django.db import models

class EducationChoices(models.TextChoices):
    """Highest educational level attained by a parent or deceased person."""
    NEVER_BEEN = "NONE",      "Never Been to School"
    PRIMARY    = "PRIMARY",   "Primary"
    SECONDARY  = "SECONDARY", "Secondary"
    TERTIARY   = "TERTIARY",  "Tertiary"