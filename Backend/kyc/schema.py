from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from enum import Enum
from typing import Optional


# -------------------------------------------------------------------
# Enums
# -------------------------------------------------------------------
class InstitutionStatus(str, Enum):
    PENDING = 'PENDING'
    ACTIVE = 'ACTIVE'
    SUSPENDED = 'SUSPENDED'
    REVOKED = 'REVOKED'

class KYCRequestStatus(str, Enum):
    PENDING = 'PENDING'
    APPROVED = 'APPROVED'
    DENIED = 'DENIED'
    EXPIRED = 'EXPIRED'

class ConsentDecision(str, Enum):
    APPROVED = 'APPROVED'
    DENIED = 'DENIED'


# -------------------------------------------------------------------
# Third Party Institution Schemas
# -------------------------------------------------------------------
class ThirdPartyInstitutionBase(BaseModel):
    name: str = Field(..., max_length=255)
    reg_number: str = Field(..., max_length=100, description="Business registration number")
    permitted_scope: list[str] = Field(
        default_factory=list, 
        description="List of fields this institution is permitted to request (e.g., ['full_name', 'dob'])"
    )

class ThirdPartyInstitutionCreate(ThirdPartyInstitutionBase):
    """
    POST /institutions/
    Admin creates a new institution profile. (OIDC credentials generated server-side upon approval)
    """
    enrolled_by_id: Optional[int] = Field(None, description="SystemUser ID who enrolled this institution")

class ThirdPartyInstitutionUpdate(BaseModel):
    """
    PATCH /institutions/{id}
    Update scope, name, or status (e.g., SUSPEND).
    """
    name: Optional[str] = Field(None, max_length=255)
    permitted_scope: Optional[list[str]] = None
    status: Optional[InstitutionStatus] = None

class ThirdPartyInstitutionResponse(ThirdPartyInstitutionBase):
    """
    GET /institutions/{id}
    Standard response. 
    NOTE: `oidc_secret` is intentionally omitted to prevent accidental exposure.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    oidc_client_id: Optional[str] = None
    status: InstitutionStatus
    enrolled_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

class ThirdPartyInstitutionCredentialsResponse(BaseModel):
    """
    Returned EXACTLY ONCE when an institution is approved/regenerates keys.
    """
    client_id: str
    client_secret: str = Field(..., description="Raw secret. MUST be saved by the client now, will never be shown again.")


# -------------------------------------------------------------------
# KYC Request Schemas
# -------------------------------------------------------------------
class KYCRequestCreate(BaseModel):
    """
    POST /kyc-requests/ (Institution API)
    Institution initiates a request to a citizen.
    """
    citizen_din: str = Field(..., max_length=12, description="DIN of the citizen being queried")
    fields_requested: list[str] = Field(
        ..., 
        min_length=1, 
        description="Specific fields being requested. Must be a subset of the institution's permitted_scope"
    )

class KYCRequestCitizenAction(BaseModel):
    """
    PATCH /kyc-requests/{id}/respond (Citizen App API)
    Citizen explicitly approves or denies the request.
    """
    decision: ConsentDecision
    fields_granted: Optional[list[str]] = Field(
        None, 
        description="Subset of fields citizen agreed to share. Required if APPROVED, null if DENIED."
    )

class KYCRequestResponse(BaseModel):
    """
    GET /kyc-requests/{id}
    Status of the request (Visible to both Institution and Citizen)
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    institution_id: int
    citizen_din: str
    fields_requested: list[str]
    fields_granted: Optional[list[str]] = None
    status: KYCRequestStatus
    requested_at: datetime
    responded_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


# -------------------------------------------------------------------
# Consent Record Schemas
# -------------------------------------------------------------------
class ConsentRecordResponse(BaseModel):
    """
    GET /consent-records/{id}
    Immutable audit trail of a citizen's decision.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    kyc_request_id: int
    citizen_id: int  # This will map to Django's under-the-hood FK representation
    decision: ConsentDecision
    fields_shared: Optional[list[str]] = None
    timestamp: datetime


# -------------------------------------------------------------------
# Filters & Pagination
# -------------------------------------------------------------------
class KYCRequestFilterParams(BaseModel):
    """
    Query parameters for GET /kyc-requests/
    Citizens use this to see their pending requests, Institutions use it to check status.
    """
    institution_id: Optional[int] = None
    citizen_din: Optional[str] = None
    status: Optional[KYCRequestStatus] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

class PaginatedKYCRequestList(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[KYCRequestResponse]