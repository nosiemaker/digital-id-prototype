from pydantic import BaseModel, Field, ConfigDict, EmailStr
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional


# -------------------------------------------------------------------
# Enums
# -------------------------------------------------------------------
class UserRole(str, Enum):
    CITIZEN = 'CITIZEN'
    REGISTRATION_OFFICER = 'RO'
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


# -------------------------------------------------------------------
# System User Schemas
# -------------------------------------------------------------------
class SystemUserBase(BaseModel):
    role: UserRole
    email: EmailStr
    name: str = Field(..., max_length=255)
    citizen_din: Optional[str] = Field(None, max_length=12, description="Only populated for CITIZEN role")
    is_active: bool = True

class SystemUserCreate(SystemUserBase):
    """
    POST /users/
    Requires a plain-text password. The backend MUST hash this using bcrypt
    before saving to the `password_hash` database field.
    """
    password: str = Field(..., min_length=8, description="Plain text password to be hashed by backend")

class SystemUserUpdate(BaseModel):
    """
    PATCH /users/{id}
    """
    email: Optional[EmailStr] = None
    name: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None
    # If adding password reset, it should be a separate endpoint (e.g. POST /users/{id}/reset-password)

class SystemUserResponse(SystemUserBase):
    """
    GET /users/{id}
    🚨 NOTE: `password_hash` is intentionally omitted to prevent leakage.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
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
    # institution_id is omitted here; it should be securely inferred from the Institution's Auth Token

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
    institution_id: int  # Maps to Django's institution FK
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