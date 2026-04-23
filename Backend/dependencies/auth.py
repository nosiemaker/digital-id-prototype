from django.db import models
from fastapi import Depends, HTTPException, Request

class UserRole:
    CITIZEN = "CITIZEN"
    REGISTRATION_OFFICER = "REGISTRATION_OFFICER"
    REGISTRAR = "REGISTRAR"
    SUPERVISOR = "SUPERVISOR"
    HEALTH_WORKER = "HEALTH_WORKER"
    THIRD_PARTY = "THIRD_PARTY"

def get_current_user(request:Request):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

def require_groups(required_groups: list):
    def check_groups(user: dict = Depends(get_current_user)):
        user_groups = user.get("role", "").upper().strip()
        if user_groups not in required_groups:
            raise HTTPException(status_code=403, detail=f"User {user_groups} Not allowed")
        return user
    return check_groups
