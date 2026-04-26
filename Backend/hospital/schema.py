from pydantic import BaseModel, Field, ConfigDict, HttpUrl
from datetime import date, datetime
from enum import Enum
from typing import Optional, Any


# -------------------------------------------------------------------
# Enums
# -------------------------------------------------------------------
class RecordStatus(str, Enum):
    PENDING = 'PENDING'
    APPROVED = 'APPROVED'
    REJECTED = 'REJECTED'

class SyncStatus(str, Enum):
    QUEUED = 'QUEUED'
    SYNCED = 'SYNCED'
    FAILED = 'FAILED'

class Sex(str, Enum):
    MALE = 'MALE'
    FEMALE = 'FEMALE'
    OTHER = 'OTHER'

class EventType(str, Enum):
    BIRTH = 'BIRTH'
    DEATH = 'DEATH'


# -------------------------------------------------------------------
# Reusable Action Schemas
# -------------------------------------------------------------------
class RecordRejection(BaseModel):
    """
    PATCH /{resource}/{id}/reject
    Used by ROs to reject a birth or death record.
    """
    rejection_reason: str = Field(..., min_length=10, description="Detailed explanation for rejecting the record")


# -------------------------------------------------------------------
# Birth Record Schemas
# -------------------------------------------------------------------
class BirthRecordBase(BaseModel):
    mother_din: str = Field(..., max_length=12, description="DIN of the registered mother")
    facility: str = Field(..., max_length=255, description="Name of hospital or clinic")
    district: str = Field(max_length=255, description="Name of district")
    child_first_name: str  = Field(max_length=255)
    child_surname: str = Field(max_length=255)
    child_other_names: str = Field(max_length=255)
    father_occupation: str = Field(max_length=255)
    father_ssn: int
    mother_ssn: int
    father_nationality:int = Field(max_length=255, default="ZAMBIAN")
    mother_nationality:str = Field(max_length=255, default="ZAMBIAN")
    informant_name: str = Field(max_length=255)
    informant_address: str = Field(max_length=255)
    postal_address: str = Field(max_length=255)
    date_of_registration : datetime
    child_dob: datetime
    child_sex: str

class BirthRecordCreate(BirthRecordBase):
    """
    POST /births/ (Online Flow)
    Submitted by authenticated Health Worker.
    health_worker_id is usually inferred from the JWT token, but included here if needed by internal microservices.
    """
    health_worker_id: Optional[int] = Field(None, description="Inferred from token in production")

class BirthRecordResponse(BirthRecordBase):
    """
    GET /births/{id}
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    child_din: Optional[str] = Field(None, description="Assigned after RO approval")
    health_worker_id: Optional[int] = None
    status: RecordStatus
    reviewed_by_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    certificate_url: Optional[str] = None  # Or HttpUrl if you strictly enforce URL validation
    created_at: datetime


# -------------------------------------------------------------------
# Death Record Schemas
# -------------------------------------------------------------------
class DeathRecordBase(BaseModel):
    deceased_din: str = Field(..., max_length=12, description="DIN of the deceased citizen")
    facility: str = Field(..., max_length=255, description="Place of death declaration")
    cause_icd11: str = Field(..., max_length=20, description="Standardized ICD-11 mortality code")
    cause_description: Optional[str] = Field(None, max_length=255, description="Plain text description of the cause")
    died_at: datetime

class DeathRecordCreate(DeathRecordBase):
    """
    POST /deaths/ (Online Flow)
    """
    health_worker_id: Optional[int] = Field(None)

class DeathRecordResponse(DeathRecordBase):
    """
    GET /deaths/{id}
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    health_worker_id: Optional[int] = None
    status: RecordStatus
    reviewed_by_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    certificate_url: Optional[str] = None
    created_at: datetime


# -------------------------------------------------------------------
# Offline Sync Schemas
# -------------------------------------------------------------------
class SyncPayloadCreate(BaseModel):
    """
    Item within the offline sync batch payload.
    """
    device_id: str = Field(..., max_length=100)
    event_type: EventType
    queued_at: datetime = Field(..., description="Timestamp when the event was saved offline on the device")
    payload: dict[str, Any] = Field(..., description="JSON representation of BirthRecordCreate or DeathRecordCreate")

class OfflineSyncBatchCreate(BaseModel):
    """
    POST /sync/batch
    App hits this endpoint upon regaining internet connection, sending all queued records at once.
    """
    records: list[SyncPayloadCreate]

class OfflineSyncQueueResponse(BaseModel):
    """
    GET /sync/queue/{id}
    Primarily for IT/Admin debugging of failed syncs.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: str
    event_type: EventType
    queued_at: datetime
    synced_at: Optional[datetime] = None
    status: SyncStatus
    error_message: Optional[str] = None
    # 'payload' is usually omitted from standard list responses for size, 
    # but can be added if you have a specific detail view for admins.


# -------------------------------------------------------------------
# Pagination & Filters
# -------------------------------------------------------------------
class VitalRecordFilterParams(BaseModel):
    """
    Query parameters for GET /births/ or GET /deaths/
    """
    status: Optional[RecordStatus] = None
    facility: Optional[str] = None
    health_worker_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

class PaginatedBirthList(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[BirthRecordResponse]

class PaginatedDeathList(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[DeathRecordResponse]