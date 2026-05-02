from pydantic import BaseModel, Field, ConfigDict, EmailStr
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import Optional


# -------------------------------------------------------------------
# Enums
# -------------------------------------------------------------------
class UserRole(str, Enum):
    CITIZEN = 'CITIZEN'
    REGISTRATION_OFFICER = 'REGISTRATION_OFFICER'
    REGISTRAR = 'REGISTRAR'
    SUPERVISOR = 'SUPERVISOR'
    HEALTH_WORKER = 'HEALTH_WORKER'
    THIRD_PARTY = 'THIRD_PARTY'

class TransactionStatus(str, Enum):
    INITIATED = 'INITIATED'
    PENDING_CONFIRMATION = 'PENDING_CONFIRMATION'
    CONFIRMED = 'CONFIRMED'
    FAILED = 'FAILED'
    EXPIRED = 'EXPIRED'

class TransactionMethod(str, Enum):
    MTN_MOMO = 'MTN_MOMO'
    AIRTEL_MONEY = 'AIRTEL_MONEY'
    BANK_TRANSFER = 'BANK_TRANSFER'

# ====== Phase 1: Account Creation =======

class AccountCreateRequest(BaseModel):
    """
    POST /auth/register
    Creates a SystemUser and sends an email OTP.
    No citizen data yet — just identity credentials.
    """
    email:    EmailStr
    password: str = Field(..., min_length=8, description="Plaintext — hashed server-side")


class AccountCreateResponse(BaseModel):
    """
    Returned after POST /auth/register.
    Tells the client what to do next.
    """
    user_id: int
    email:   str
    message: str = "OTP sent to your email address. Please verify to activate your account."

class OTPVerifyRequest(BaseModel):
    """
    POST /auth/verify-otp
    """
    email: EmailStr
    otp:   str = Field(..., min_length=6, max_length=6, description="6-digit OTP")


class OTPVerifyResponse(BaseModel):
    message: str
    is_email_verified: bool


class ResendOTPRequest(BaseModel):
    """
    POST /auth/resend-otp
    Caller must supply their email; no auth token required yet.
    """
    email: EmailStr

# ======= Phase 2: Identity Submission =========
class IdentitySubmitRequest(BaseModel):
    """
    POST /auth/submit-identity
    Submitted from the dashboard once the user is logged in.
    Creates a Citizen record + EnrollmentRequest.

    Province is resolved on the frontend to a district_id.
    Only district_id is sent — province is UI-only and never stored.
    """
    nrc:            str  = Field(..., max_length=15, description="National Registration Card number")
    full_name:      str  = Field(..., max_length=255)
    dob:            date = Field(..., description="Date of birth")
    phone:          Optional[str] = Field(None, max_length=20)
    gender:         Optional[str] = Field(None, description="MALE | FEMALE")
    district_id:    Optional[int] = Field(None, description="District FK — resolved from province/district selection")
    nrc_front_url:  Optional[str] = Field(None, max_length=500, description="URL to uploaded NRC front image")
    nrc_back_url:   Optional[str] = Field(None, max_length=500, description="URL to uploaded NRC back image")
    face_image_url: Optional[str] = Field(None, max_length=500, description="URL to uploaded face photo")
    public_key:     str  = Field(..., description="PEM-encoded ECDSA P-256 public key from WebCrypto")
    language:       str  = Field(default="en", description="Preferred language code")

class IdentitySubmitResponse(BaseModel):
    enrollment_request_id: int
    citizen_id:            int
    message: str = "Identity submitted. An officer will review your request."

# -------------------------------------------------------------------
# System User Schemas
# -------------------------------------------------------------------
class SystemUserBase(BaseModel):
    role: str
    email: EmailStr
    name: str = Field(..., max_length=255)
    din: str = Field(..., max_length=20, description="Only populated for CITIZEN role")
    is_active: bool = True


class SystemUserCreatePassword(BaseModel):
    citizen_din: str = Field(..., max_length=20, description="Only populated for CITIZEN role")
    password: str = Field(..., min_length=8, description="Plain text password to be hashed by backend")

class SystemUserUpdate(BaseModel):
    """
    PATCH /users/{id}
    """
    password: str = Field(..., min_length=8, description="Plain text password to be hashed by backend")
    email: Optional[EmailStr] = None
    name: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None

class SystemUserResponse(SystemUserBase):
    """
    GET /users/{id}
    NOTE: `password_hash` is intentionally omitted to prevent leakage.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    role: str
    citizen_din: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None


# -------------------------------------------------------------------
# Transaction Schemas
# -------------------------------------------------------------------
class TransactionBase(BaseModel):
    amount: Decimal = Field(..., ge=0, description="Transaction amount (cannot be negative)")
    currency: str = Field(default="ZMW", max_length=3)
    method: TransactionMethod

class TransactionCreate(TransactionBase):
    """
    POST /transactions/
    Initiated by an external Third-Party Institution.
    """
    citizen_din: str = Field(..., max_length=12, description="DIN of the citizen being charged")
    reference: str = Field(..., max_length=64, description="External reference from the institution")

class TransactionBiometricChallenge(BaseModel):
    """
    Response returned IMMEDIATELY after a transaction is created.
    The institution passes this challenge to the citizen's device to sign.
    """
    transaction_id: int
    status: TransactionStatus
    biometric_challenge: str = Field(..., description="Server-generated nonce to be signed by Citizen's private key")
    expires_at: datetime

class TransactionConfirmAction(BaseModel):
    """
    PATCH /transactions/{id}/confirm
    Submitted by the Citizen app.
    """
    signature: str = Field(..., description="Cryptographic signature of the biometric_challenge using Citizen's private key")

class TransactionResponse(TransactionBase):
    """
    GET /transactions/{id}
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    citizen_din: str
    institution_id: int
    status: TransactionStatus
    reference: str
    biometric_challenge: Optional[str] = None
    initiated_at: datetime
    confirmed_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


# -------------------------------------------------------------------
# Pagination & Filters
# -------------------------------------------------------------------
class SystemUserFilterParams(BaseModel):
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    search: Optional[str] = Field(None, description="Search by name or email")
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

class TransactionFilterParams(BaseModel):
    citizen_din: Optional[str] = None
    institution_id: Optional[int] = None
    status: Optional[TransactionStatus] = None
    reference: Optional[str] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

class PaginatedSystemUserList(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[SystemUserResponse]

class PaginatedTransactionList(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[TransactionResponse]


# -------------------------------------------------------------------
# Staff Role Creation Schemas
# -------------------------------------------------------------------
class RegistrationOfficerRemove(BaseModel):
    citizen_din: str = Field(..., max_length=20, description="DIN of the citizen whose RO role to deactivate")


class RegistrarRemove(BaseModel):
    citizen_din: str = Field(..., max_length=20, description="DIN of the citizen whose Registrar role to deactivate")


class SupervisorRemove(BaseModel):
    citizen_din: str = Field(..., max_length=20, description="DIN of the citizen whose Supervisor role to deactivate")


class HealthWorkerRemove(BaseModel):
    citizen_din: str = Field(..., max_length=20, description="DIN of the citizen whose HealthWorker role to deactivate")


class RegistrationOfficerCreate(BaseModel):
    citizen_din: str = Field(..., max_length=20, description="DIN of the citizen to link")
    employee_id: Optional[str] = Field(None, max_length=50, description="Unique employee ID")
    station_name: Optional[str] = Field(None, max_length=200, description="Registration station name")
    district_id: Optional[int] = Field(None, description="District ID where stationed")


class RegistrarCreate(BaseModel):
    citizen_din: str = Field(..., max_length=20, description="DIN of the citizen to link")
    employee_id: str = Field(..., max_length=50, description="Unique employee ID")
    department: Optional[str] = Field(None, max_length=100, description="Department name")
    district_id: Optional[int] = Field(None, description="District ID where stationed")


class SupervisorCreate(BaseModel):
    citizen_din: str = Field(..., max_length=20, description="DIN of the citizen to link")
    employee_id: Optional[str] = Field(None, max_length=50, description="Unique employee ID")
    department: Optional[str] = Field(None, max_length=100, description="Department name")
    district_id: Optional[int] = Field(None, description="District ID where stationed")


class HealthWorkerCreate(BaseModel):
    citizen_din: str = Field(..., max_length=20, description="DIN of the citizen to link")
    employee_id: Optional[str] = Field(None, max_length=50, description="Unique employee ID")
    facility_name: Optional[str] = Field(None, max_length=200, description="Health facility name")
    department: Optional[str] = Field(None, max_length=100, description="Department name")


# -------------------------------------------------------------------
# District / Province listing (used by frontend dropdowns)
# -------------------------------------------------------------------
class DistrictResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    province_name: str
    province_code: str

class ProvinceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    districts: list[DistrictResponse] = []
