
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from django.contrib.auth.hashers import make_password, check_password
from dotenv import load_dotenv

load_dotenv()
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", 6000))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("JWT_REFRESH_TOKEN_EXPIRE_DAYS", 7))


def hash_password(plain: str) -> str:
    return make_password(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return check_password(plain, hashed)

def create_access_token(user_id: int, role: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "role": role,
        "email": email,
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    payload = {
       "sub": str(user_id),
        "type": "refresh",
        "exp": expire,
        "jti": secrets.token_hex(16), 
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:

    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

def decode_access_token(token: str) -> dict:
    payload = decode_token(token)

    if payload.get("type") != "access":
        raise JWTError("Not a access token")
    return payload

def decode_refresh_token(token: str) -> dict:
    """Decodes and validates that the token is a REFRESH token."""
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise JWTError("Not a refresh token")
    return payload

def compute_log_signature(actor_id: str, action: str, target_id: str, outcome: str, timestamp: str) -> str:
    """SHA-256 hash for audit log tamper detection."""
    raw = f"{actor_id}|{action}|{target_id}|{outcome}|{timestamp}"
    return hashlib.sha256(raw.encode()).hexdigest()
