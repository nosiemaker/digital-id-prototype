from typing import Optional
from citizens.models import Citizen, BiometricRecord
from citizens.schema import BiometricRecordBase
import logging
from Utils.audit_logger import audit

logger = logging.getLogger(__name__)


def create_biometric_record(
    citizen_din: str, biometric_data: BiometricRecordBase, actor_id: Optional[int] = None, actor_role: str = "SYSTEM"
) -> Optional[BiometricRecord]:
    """
    Create a biometric record for a citizen.
    """
    # Get the citizen
    try:
        citizen = Citizen.objects.get(din=citizen_din)
    except Citizen.DoesNotExist:
        return None

    # Check if biometric record already exists
    try:
        existing_biometric = BiometricRecord.objects.get(Citizen=citizen)
        # Update existing record instead of creating new one
        return update_biometric_record(citizen_din, biometric_data, actor_id, actor_role)
    except BiometricRecord.DoesNotExist:
        pass  # No existing record, continue to create new one

    # Create new biometric record
    biometric_record = BiometricRecord(
        Citizen=citizen,
        facial_template=biometric_data.facial_template,
        # Note: embedding_vector, embedding_quantized, din_commitment, face_image_path
        # would be populated by the biometric processing service
    )

    biometric_record.save()
    
    # Log the biometric capture if actor info is provided
    if actor_id:
        audit.biometric_captured(actor_id=actor_id, citizen_din=citizen_din)
    
    return biometric_record


def get_biometric_by_citizen_din(db, citizen_din: str) -> Optional[BiometricRecord]:
    """
    Get biometric record by citizen DIN.
    """
    try:
        return BiometricRecord.objects.get(Citizen__din=citizen_din)
    except BiometricRecord.DoesNotExist:
        return None


def update_biometric_record(
    citizen_din: str, biometric_data: BiometricRecordBase, actor_id: Optional[int] = None, actor_role: str = "SYSTEM"
) -> Optional[BiometricRecord]:
    """
    Update biometric record for a citizen.
    """
    try:
        biometric_record = BiometricRecord.objects.get(Citizen__din=citizen_din)
    except BiometricRecord.DoesNotExist:
        return None

    # Update fields that are provided
    if biometric_data.facial_template is not None:
        biometric_record.facial_template = biometric_data.facial_template

    biometric_record.save()
    
    # Log the biometric update if actor info is provided
    if actor_id:
        audit.biometric_updated(actor_id, citizen_din)
    
    return biometric_record


def delete_biometric_record(db, citizen_din: str) -> bool:
    """
    Delete biometric record for a citizen.
    """
    try:
        biometric_record = BiometricRecord.objects.get(Citizen__din=citizen_din)
        biometric_record.delete()
        return True
    except BiometricRecord.DoesNotExist:
        return False
