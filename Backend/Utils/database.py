"""
Database utility functions for the ZDID backend.
Provides helper functions for database operations.
"""

from typing import Generator
from citizens.models import Citizen


def get_db() -> Generator:
    # In Django, we work directly with the models
    # This function exists mainly for dependency injection compatibility
    yield None


# Helper functions for common database operations
def get_citizen_by_din(din: str):
    """Get citizen by DIN using Django ORM."""
    try:
        return Citizen.objects.get(din=din)
    except Citizen.DoesNotExist:
        return None


def get_citizen_by_nrc(nrc: str):
    """Get citizen by NRC using Django ORM."""
    try:
        return Citizen.objects.get(nrc=nrc)
    except Citizen.DoesNotExist:
        return None


def citizen_exists_by_nrc(nrc: str) -> bool:
    """Check if a citizen with the given NRC exists."""
    return Citizen.objects.filter(nrc=nrc).exists()


def citizen_exists_by_din(din: str) -> bool:
    """Check if a citizen with the given DIN exists."""
    return Citizen.objects.filter(din=din).exists()
