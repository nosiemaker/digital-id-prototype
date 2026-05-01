from pydantic import BaseModel, Field, ConfigDict
from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional



# Enums

class CitizenStatus(str, Enum):
    PENDING = 'PENDING'
    ACTIVE = 'ACTIVE'
    INACTIVE = 'INACTIVE'
    SUSPENDED = 'SUSPENDED'
    DECEASED = 'DECEASED'
    REJECTED = 'REJECTED'


class EnrollmentStatus(str, Enum):
    PENDING = 'PENDING'
    APPROVED = 'APPROVED'
    REJECTED = 'REJECTED'


class Language(str, Enum):
    ENGLISH = 'en'
    BEMBA = 'bem'
    NYANJA = 'nya'
    TONGA = 'toi'
    LOZI = 'loz'


class RelationshipType(str, Enum):
    PARENT = 'PARENT'
    CHILD = 'CHILD'
    SIBLING = 'SIBLING'
    SPOUSE = 'SPOUSE'
    GUARDIAN = 'GUARDIAN'


class Gender(str, Enum):
    MALE = 'MALE'
    FEMALE = 'FEMALE'


class UserType(str, Enum):
    CHILD_ABOVE_16 = 'CHILD_ABOVE_16'
    CHILD_UNDER_16 = 'CHILD_UNDER_16'
    ADULT = 'ADULT'
    SENIOR = 'SENIOR'



# Nested Location Schemas
class ProvinceSummary(BaseModel):
    """Minimal province data for nesting inside district responses."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    code: str


class DistrictSummary(BaseModel):
    """District with expanded province — matches frontend jurisdiction card."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    code: str
    province: ProvinceSummary



# Citizen Schemas
class CitizenBase(BaseModel):
    """Fields submitted during enrollment (Phase 2)."""
    nrc: str = Field(..., max_length=20, description="National Registration Card Number")
    full_name: str = Field(..., max_length=255)
    dob: date = Field(..., description="Date of birth")
    phone: Optional[str] = Field(None, max_length=20)
    public_key: Optional[str] = Field(None, description="PEM-encoded ECDSA P-256 public key")
    language: Language = Field(default=Language.ENGLISH)
    nrc_front_url: Optional[str] = Field(None, max_length=500)
    nrc_back_url: Optional[str] = Field(None, max_length=500)
    face_image_url: Optional[str] = Field(None, max_length=500)


class CitizenCreate(CitizenBase):
    """POST /citizens/enroll — citizen mobile app submission."""
    pass


class CitizenUpdate(BaseModel):
    """PATCH /citizens/{din} — language change, phone updates, etc."""
    full_name: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    language: Optional[Language] = None
    status: Optional[CitizenStatus] = None
    residential_address: Optional[str] = Field(None, max_length=255)


class CitizenSummary(BaseModel):
    """Used in lists, family trees, lookups — lightweight."""
    model_config = ConfigDict(from_attributes=True)
    din: str
    full_name: str
    nrc: str
    status: CitizenStatus


class CitizenResponse(CitizenBase):
    """
    GET /citizens/{din}
    Full citizen profile — visible to self, RO, Supervisor.
    Includes every field the frontend review page needs.
    """
    model_config = ConfigDict(from_attributes=True)
    din: Optional[str] = None
    status: CitizenStatus
    gender: Optional[Gender] = None
    residential_address: Optional[str] = None
    district: Optional[DistrictSummary] = None
    citizen_type: Optional[UserType] = Field(default=UserType.ADULT)
    activation_nonce: Optional[str] = None
    challenge_expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

class CitizenLookupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    din: str
    full_name: str
    phone: Optional[str] = None
    residential_address: Optional[str] = None
    nrc: Optional[str] = None
    nationality: Optional[str] = None
    sex: Optional[str] = None
    dob: Optional[date] = None
    occupation: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# Biometric Schemas
# ═══════════════════════════════════════════════════════════════════════════════

class BiometricRecordBase(BaseModel):
    facial_template: Optional[str] = Field(None, description="Base64-encoded facial template")


class BiometricRecordCreate(BiometricRecordBase):
    pass


class BiometricRecordUpdate(BaseModel):
    facial_template: Optional[str] = None


class BiometricRecordResponse(BiometricRecordBase):
    model_config = ConfigDict(from_attributes=True)
    citizen_din: str
    captured_at: datetime
    updated_at: datetime


# ═══════════════════════════════════════════════════════════════════════════════
# Family Link Schemas
# ═══════════════════════════════════════════════════════════════════════════════

class FamilyLinkBase(BaseModel):
    related_citizen_din: str = Field(..., description="DIN of the related citizen")
    relationship_type: RelationshipType


class FamilyLinkCreate(FamilyLinkBase):
    citizen_din: str = Field(..., description="DIN of the citizen this link originates from")


class FamilyLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    citizen: CitizenSummary
    related_citizen: CitizenSummary
    relationship_type: RelationshipType
    created_at: datetime


class FamilyTreeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    citizen: CitizenSummary
    parents: list[CitizenSummary] = []
    children: list[CitizenSummary] = []
    siblings: list[CitizenSummary] = []
    spouses: list[CitizenSummary] = []


# ═══════════════════════════════════════════════════════════════════════════════
# Digital ID Schemas
# ═══════════════════════════════════════════════════════════════════════════════

class DigitalIDPayload(BaseModel):
    din: str
    full_name: str
    nrc: str
    dob: date
    gender: Optional[Gender] = None
    province: str
    face_image_url: Optional[str]
    citizen_type: Optional[UserType] = None
    status: CitizenStatus
    public_key: Optional[str]
    issued_at: datetime
    signature: str = Field(..., description="ECDSA signature of this payload")


class DigitalIDResponse(BaseModel):
    payload: DigitalIDPayload
    server_public_key: str
    valid_until: datetime


class ServerPublicKeyResponse(BaseModel):
    public_key_pem: str
    algorithm: str = "ECDSA P-256"
    usage: str = "Verify Digital ID payload signatures issued by ZDID"


# ═══════════════════════════════════════════════════════════════════════════════
# Enrollment / Registration Flow Schemas
# ═══════════════════════════════════════════════════════════════════════════════

class ROProfileSummary(BaseModel):
    """
    Registration Officer profile nested inside enrollment responses.
    Resolved from RegistrationOfficer → Citizen → SystemUser chain.
    """
    model_config = ConfigDict(from_attributes=True)
    id: int                      # SystemUser ID
    employee_id: str
    citizen: CitizenSummary


class EnrollmentRequestCreate(BaseModel):
    """Internal — auto-created when CitizenCreate is processed."""
    citizen_id: int
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EnrollmentRequestResponse(BaseModel):
    """
    GET /enrollments/{id} or /enrollments/pending_requests
    Full enrollment with expanded citizen and RO reviewer details.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    citizen: CitizenResponse
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None
    status: EnrollmentStatus
    rejection_reason: Optional[str] = None
    ro_id: Optional[int] = None
    ro: Optional[ROProfileSummary] = None
    activation_challenge: Optional[str] = None
    activation_challenge_expires_at: Optional[datetime] = None


class EnrollmentApproval(BaseModel):
    """
    PATCH /enrollments/{id}/approve
    Server-generated challenge returned after RO approval.
    """
    activation_challenge: str = Field(
        ...,
        max_length=64,
        description="Random nonce for citizen device to sign"
    )
    activation_challenge_expires_at: datetime = Field(
        ...,
        description="Timestamp when the challenge expires"
    )


class EnrollmentRejection(BaseModel):
    """PATCH /enrollments/{id}/reject — RO reject with mandatory reason."""
    rejection_reason: str = Field(
        ...,
        min_length=10,
        description="Detailed reason for rejection"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# List & Filter Schemas
# ═══════════════════════════════════════════════════════════════════════════════

class PaginatedCitizenList(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[CitizenSummary]


class PendingRegistrationsList(BaseModel):
    total: int
    items: list[EnrollmentRequestResponse]


class CitizenFilterParams(BaseModel):
    status: Optional[CitizenStatus] = None
    language: Optional[Language] = None
    search: Optional[str] = Field(None, description="Search by name or NRC")
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class EnrollmentRequestFilterParams(BaseModel):
    status: Optional[EnrollmentStatus] = Field(default=EnrollmentStatus.PENDING)
    ro_id: Optional[int] = Field(None, description="Filter by specific RO")
    submitted_after: Optional[datetime] = None
    submitted_before: Optional[datetime] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


# ═══════════════════════════════════════════════════════════════════════════════
# KYC & QR Schemas
# ═══════════════════════════════════════════════════════════════════════════════

class KYCRequestCreate(BaseModel):
    citizen_din: str
    fields_requested: list[str]


class KYCRequestResponse(BaseModel):
    id: int
    institution_name: str
    citizen_din: str
    fields_requested: list[str]
    fields_granted: list[str]
    status: str
    requested_at: datetime
    responded_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class KYCCitizenResponse(BaseModel):
    decision: str = Field(..., pattern="^(APPROVED|DENIED)$")
    fields_granted: Optional[list[str]] = None


class ConsentRecordResponse(BaseModel):
    id: int
    decision: str
    fields_shared: list[str]
    timestamp: datetime


class ApprovedCitizenDataResponse(BaseModel):
    kyc_request_id: int
    citizen_din: str
    approved_fields: dict
    decision: str
    timestamp: datetime


class StatisticsResponse(BaseModel):
    total_registered_citizens: int
    live_births_vs_deaths: dict[str, int]
    gender_ratio: dict
    regional_breakdown: list[dict]
    kyc_metrics: dict


# ═══════════════════════════════════════════════════════════════════════════════
# Websocket
# ═══════════════════════════════════════════════════════════════════════════════

class CitizenNotification(BaseModel):
    type: str = Field(
        ...,
        pattern="^(STATUS_CHANGE|KYC_REQUEST|ENROLLMENT_APPROVED|ENROLLMENT_REJECTED)$"
    )