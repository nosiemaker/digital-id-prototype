from datetime import datetime, timezone

from asgiref.sync import sync_to_async
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from Utils.auth import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    verify_password,
)

router = APIRouter()

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: int
    role: str
    name: str

class RefreshRequest(BaseModel):
    refresh_token: str
