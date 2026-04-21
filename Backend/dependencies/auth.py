from fastapi import Depends, HTTPException, Request

def get_current_user(request:Request):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

def require_groups(*required_groups: str):
    def check_groups(user: dict = Depends(get_current_user)):
        user_groups = set(user.get("groups", []))
        if not user_groups.intersection(required_groups):
            raise(HTTPException(status_code=401, detail="User Not allowed"))
        return user

    return check_groups
