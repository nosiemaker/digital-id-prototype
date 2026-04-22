from typing import Optional
from citizens.models import Citizen, CitizenStatus, Language
from citizens.schema import CitizenUpdate
import logging
from Utils.audit_logger import audit

logger = logging.getLogger(__name__)


def get_citizen_by_din(din: str) -> Optional[Citizen]:
    """
    Get citizen by DIN.
    """
    return Citizen.objects.get(din=din)


def get_citizen_by_nrc(nrc: str) -> Optional[Citizen]:
    """
    Get citizen by NRC.
    """
    return Citizen.objects.filter(nrc=nrc).first()


def update_citizen(din: str, citizen_data: CitizenUpdate, actor_id: Optional[int] = None, actor_role: str = "SYSTEM") -> Citizen:
    """
    Update citizen record.
    """
    citizen = get_citizen_by_din(din)

    if not citizen:
        return None
    
    update_dict = citizen_data.model_dump(exclude_unset=True)

    for key, value in update_dict.items():
        setattr(citizen, key, value)
    
    citizen.save()
    
    # Log the update if actor info is provided
    if actor_id:
        updated_fields = list(update_dict.keys())
        audit.citizen_updated(actor_id, actor_role, din, fields=updated_fields)
    
    return citizen


def delete_citizen(din: str, actor_id: Optional[int] = None, actor_role: str = "SYSTEM") -> bool:
    """
    Delete/retire citizen record.
    """
    citizen = get_citizen_by_din(din)
    if not citizen:
        return False

    result = citizen.delete()
    
    # Log the deletion if actor info is provided
    if actor_id:
        audit.citizen_deleted(actor_id, actor_role, din)
    
    return result


def list_citizens(
    status: Optional[CitizenStatus] = None,
    language: Optional[Language] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> list[Citizen]:
    """
    List citizens with filtering and pagination.
    """
    query = Citizen.objects.all()

    # Apply filters
    if status:
        query = query.filter(status=status)

    if language:
        query = query.filter(language=language)

    if search:
        from django.db.models import Q
        query = query.filter(
            Q(full_name__icontains=search) | Q(nrc__icontains=search)
        )

    # Apply pagination
    offset = (page - 1) * page_size
    citizens = query[offset:offset + page_size]

    return list(citizens)


def activate_citizen(din: str, actor_id: Optional[int] = None, actor_role: str = "SYSTEM") -> Optional[Citizen]:
    """
    Activate a citizen (set status to ACTIVE).
    Called after successful biometric enrollment and DIN generation.
    """
    citizen = Citizen.objects.filter(din=din).first()
    if not citizen:
        return None

    citizen.status = CitizenStatus.ACTIVE
    citizen.save()
    
    # Log the activation if actor info is provided
    if actor_id:
        audit.citizen_activated(actor_id, din)
    
    return citizen


def suspend_citizen(din: str, actor_id: Optional[int] = None, actor_role: str = "SYSTEM") -> Optional[Citizen]:
    """
    Suspend a citizen.
    """
    citizen = Citizen.objects.filter(din=din).first()
    if not citizen:
        return None

    citizen.status = CitizenStatus.SUSPENDED
    citizen.save()
    
    # Log the suspension if actor info is provided
    if actor_id:
        audit.citizen_suspended(actor_id, actor_role, din)
    
    return citizen


def reinstate_citizen(din: str, actor_id: Optional[int] = None, actor_role: str = "SYSTEM") -> Optional[Citizen]:
    """
    Reinstate a suspended citizen.
    """
    citizen = Citizen.objects.filter(din=din).first()
    if not citizen:
        return None

    if citizen.status == CitizenStatus.SUSPENDED:
        citizen.status = CitizenStatus.ACTIVE
        citizen.save()
        
        # Log the reinstatement if actor info is provided
        if actor_id:
            audit.citizen_reinstated(actor_id, actor_role, din)

    return citizen
