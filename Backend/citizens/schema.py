from pydantic import BaseModel, Field, ConfigDict
from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional

class CitizenStatus(str, Enum):
    PENDING = 'PENDING'
    ACTIVE = 'ACTIVE'
    SUSPENDED = 'SUSPENDED'
    DECEASED = 'DECEASED'

class Language(str, Enum):
    ENGLISH = 'en'
    BEMBA = 'bem'
    NYANJA = 'nya'
    TONGA = 'toi'
    LOZI = 'loz'

class RelationshipType(str, Enum):
    PARENT = 'PARENT'
    CHILD = 'CHILD'
    SIBLING = 'SINLING'
    SPOUSE = 'SPOUSE'
    GUARDIAN = 'GUARDIAN'

##Shared fields

class CitizenBase(BaseModel):
    nrc: str = Field(..., max_length=20, description="National Registration Card Number")
    email: str = Field(..., max_length=255, description="Email address")
    password: str = Field(..., max_length=20, description="Password")
    full_name: str = Field(..., max_length=255)
    dob: date = Field(..., description="Date of birth")
    phone: Optional[str] = Field(None, max_length=20)
    public_key: str = Field(..., description="PEM-encoded ECDSA P-256 public key")
    language: Language = Field(default=Language.ENGLISH)
    nrc_front_url: Optional[str] = Field(None, max_length=500)
    nrc_back_url: Optional[str] = Field(None, max_length=500)
    face_image_url: Optional[str] = Field(None, max_length=500)

class BiometricRecordBase(BaseModel):
    facial_template: Optional[str] = Field(None, description="Base64-encoded facial template")

class FamilyLinkBase(BaseModel):
    related_citizen_din: str = Field(..., description="DIN of the related citizen")
    relationship_type: RelationshipType

# Create schemas

class CitizenCreate(CitizenBase):
    """
    POST /citizens/enroll
    used by citizen mobile app to submit enrollment request.
    DIN not provieded
    """
    pass

class BiometricRecordCreate(BiometricRecordBase):
    """
    POST /registrations/{id}/biometrics
    RO submits captured biometric after 
    """
    pass

class FamilyLinkCreate(FamilyLinkBase):
    """
    auto-create or manual admin creation
    """
    citizen_din: str = Field(..., description="DIN of the citizen this link originates from")

# Update and partial update

class CitizenUpdate(BaseModel):
    """
    PATCH /citizens/{id}
    used for language change, phone updates etc
    """
    full_name: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    language: Optional[Language] = None
    status: Optional[CitizenStatus] = None


class BiometricRecordUpdate(BaseModel):
    """
    PATCH /biometrics/{citizen_din}
    Re-capture biometrics (e.g. poor quility)
    """
    facial_template: Optional[str] = None


# Reponse Schemas
class CitizenSummary(BaseModel):
    """
    used in lists, family trees, lookups
    """
    model_config = ConfigDict(from_attributes=True)

    din: str
    full_name: str
    nrc: str
    status: CitizenStatus

class CitizenResponse(CitizenBase):
    """
    GET /citizens/{din}
    Full citizen profile - visible to self, RO, Supervisor.
    """
    model_config = ConfigDict(from_attributes=True)

    din: str
    status: CitizenStatus
    created_at: datetime
    updated_at: datetime

class BiometricRecordResponse(BiometricRecordBase):
    """
    GET /citizens/{din}/biometrics
    Return biometric metadate
    """
    model_config = ConfigDict(from_attributes=True)

    citizen_din: str
    captured_at: datetime
    updated_at: datetime

class FamilyLinkResponse(BaseModel):
    """
    Individual family link with resolved citizen summary
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    citizen: CitizenSummary
    related_citizen: CitizenSummary
    relationship_type: RelationshipType
    created_at: datetime

class FamilyTreeResponse(BaseModel):
    """
    GET /citizens/{din}/family-tree
    Hierarchical family structure for citizen app display
    """

    citizen: CitizenSummary
    parents: list[CitizenSummary] = []
    children: list[CitizenSummary] = []
    siblings: list[CitizenSummary] = []
    spouses: list[CitizenSummary] = []

class DigitalIDPayload(BaseModel):
    """
    GET /citizens/{din}/digital-id
    Signed idemtity paylaod for QR code geration.
    """
    din: str
    full_name: str
    nrc: str
    dob: date
    status: CitizenStatus
    public_key: str
    issued_at: datetime
    signature: str = Field(..., description="ECDSA signature of this payload")

# Enrollment / Registration Flow 
class EnrollmentRequestCreate(BaseModel):
    """
    POST /citizens/enroll (internal - mpas to registration. EnrollementRequest)
    created automatically when CitizenCreate is processed
    """
    citizen_id: int #Internal Django pk
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EnrollmentRequestResponse(BaseModel):
    """
    GET /registrtation/pending  or /registartion/{id}
    RO dashboard item.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    citizen: CitizenResponse
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None
    status: str = Field(default="PENDING", pattern="^(PENDING|APPROVED|REJECTED)$")
    rejection_reason: Optional[str] = None
    ro_id: Optional[int] = None

class EnrollmentApproval(BaseModel):
    """
    PATCH /registrations/{id}/approve
    RO approves - triggers DIN generation + activation challenge.
    """
    activation_challegne: str = Field(..., description="Server-generated challenge for citizen device to sign")

class EnrollmentRejection(BaseModel):
    """
    PATCG /registrations/{id}/reject
    RO reject with manadtory reason
    """
    rejection_reason : str = Field(...,  min_length=10, description= "Detailed reason for rejection")

#List
class PaginatedCitizenList(BaseModel):
    """
    GET /citizen/?page=1&size=20
    Paginated list for admin/supervisor views
    """
    total: int
    page: int
    page_size: int
    items: list[CitizenSummary]

class PendingRegistrationsList(BaseModel):
    """
    GET /registrations/pending
    RO dashboard - all pending enrollments.
    """
    total: int
    items: list[EnrollmentRequestResponse]

#Query Parameter 

class CitizenFilterParams(BaseModel):
    """
    Quary parmas for GET /citizens/
    """
    status: Optional[CitizenStatus] = None
    language: Optional[Language] = None
    search: Optional[str] = Field(None, description="Seach by name or NRC")
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

#Websocket

class CitizenNotification(BaseModel):
    """
    Pushed to citizen app when status change or KYC request arrives.
    """

    type: str = Field(..., pattern="^(STATUS_CHANGE|KYC_REQUEST|ENROLLMENT_APPROVED|ENROLLMENT_REJECTED)$")