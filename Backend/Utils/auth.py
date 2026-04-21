
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

SECRET_KEY = os.environ.get("JWT_SECRET", "jwt-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", 60))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("JWT_REFRESH_TOKEN_EXPIRE_DAYS", 7))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

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

    if payload.get("type") != "refresh":
        raise JWTError("Not a refresh token")
    return payload


def compute_log_signature(actor_id: str, action: str, target_id: str, outcome: str, timestamp: str) -> str:
    """SHA-256 hash for audit log tamper detection."""
    raw = f"{actor_id}|{action}|{target_id}|{outcome}|{timestamp}"
    return hashlib.sha256(raw.encode()).hexdigest()
