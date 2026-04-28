
from asgiref.sync import sync_to_async

from citizens.models import Citizen
from dependencies.auth import require_groups, UserRole
from fastapi import APIRouter, HTTPException, status, Request, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional

from jose import JWTError

from Utils.auth import (
    create_access_token,
    create_refresh_token,
    verify_password, decode_refresh_token,
)
from admin_ops.models import SystemUser
from Utils.audit_logger import audit

router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: int
    role: str
    name: str
    is_email_verified: bool
    citizen_din: Optional[str] = None
    citizen_status: Optional[str] = None

class LogoutResponse(BaseModel):
    detail: str = "Logged out successfully"


async def _get_citizen_by_user_id(user_id: int):
    return await sync_to_async(lambda: Citizen.objects.filter(user_id=user_id).first())()

async def _get_user_by_email(email: str):
    """Fetch SystemUser by email. Wrapped for async context."""
    return await sync_to_async(lambda: SystemUser.objects.filter(email=email).first())()


async def _get_user_by_id(user_id: int):
    return await sync_to_async(lambda: SystemUser.objects.filter(id=user_id).first())()



@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, request: Request):

    user = await _get_user_by_email(body.email)
    
    ip = request.client.host if request.client else None

    if not user or not verify_password(body.password, user.password):
        await audit.login_failed(body.email, ip=ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not user.is_active:
        await audit.login_failed(body.email, ip=ip)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive or suspended",
        )

    access_token = create_access_token(
        user_id=user.id,
        role=user.role,
        email=user.email,
    )
    refresh_token = create_refresh_token(user_id=user.id)

    citizen_record = await _get_citizen_by_user_id(user.id)
    c_din = citizen_record.din if citizen_record else None
    c_status = citizen_record.status if citizen_record else None
    
    # Log successful login
    await audit.user_login(user.id, user.role, ip=ip)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        role=user.role,
        name=user.get_full_name() or user.username,
        is_email_verified=user.is_email_verified,
        citizen_din=c_din,
        citizen_status=c_status,
    )


@router.post("/refresh", response_model=RefreshResponse, status_code=status.HTTP_200_OK)
async def refresh_token(body: RefreshRequest):
    try:
        payload = decode_refresh_token(body.refresh_token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = int(payload.get("sub"))
    user = await _get_user_by_id(user_id)

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists or is inactive",
        )

    new_access_token = create_access_token(
        user_id=user_id, role=user.role, email=user.email
    )
    new_refresh_token = create_refresh_token(user_id=user_id)

    return RefreshResponse(
        access_token=new_access_token, refresh_token=new_refresh_token
    )


@router.get("/me", response_model=LoginResponse)
async def get_current_user_info(
    request: Request,
    current_user: dict = Depends(require_groups([UserRole.CITIZEN, UserRole.REGISTRATION_OFFICER,
                                                 UserRole.HEALTH_WORKER, UserRole.REGISTRAR, UserRole.SUPERVISOR])),
):
    """
    Get current user's information.
    Accessible by any authenticated user (CITIZEN_READ_OWN_PROFILE permission).
    """
    user_id = int(current_user.get("id", 0))

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: missing user ID",
        )

    user = await _get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User no longer exists in the system",
        )

    citizen_record = await _get_citizen_by_user_id(user_id)
    c_din = citizen_record.din if citizen_record else None
    c_status = citizen_record.status if citizen_record else None

    return LoginResponse(
        access_token="",
        refresh_token="",
        user_id=user.id,
        role=user.role,
        name=user.get_full_name() or user.username,
        is_email_verified=user.is_email_verified,
        citizen_din=c_din,
        citizen_status=c_status,
    )


@router.post("/logout", response_model=LogoutResponse, status_code=status.HTTP_200_OK)
async def logout(
    request: Request,
    current_user: dict = Depends(require_groups([UserRole.CITIZEN])),
):
    user = current_user

    return LogoutResponse(detail=f"User {user['id']} logged out successfully")

