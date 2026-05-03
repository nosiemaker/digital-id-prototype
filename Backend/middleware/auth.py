from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse
from jose import jwt, JWTError
import os

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")
ALGORITHM = "HS256"

PUBLIC_ROUTES = [
    "/",
    "/docs", 
    "/openapi.json", 
    "/auth/login", 
    "/auth/logout",
    "/auth/refresh",
    "/enrollments/register",
    "/enrollments/verify-otp",
    "/enrollments/resend-otp",
    "/third_party/register",
    "/third_party/active",
    "/users/activate/{din}",
    "/users/set-password",
    "/districts/provinces",
    "/districts/",
    "deaths/submit/{death_record_id}/notice_of_death"
]

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):

        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path.rstrip("/")
        if not path: path = "/"
        
        # Check if the path (without trailing slash) is in PUBLIC_ROUTES
        # Note: PUBLIC_ROUTES should also be stripped of trailing slashes for comparison
        is_public = any(path == p.rstrip("/") for p in PUBLIC_ROUTES)
        
        if is_public:
            return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse({"details": "Missing Token"}, status_code=401)
        token = auth_header.split(" ")[1]

        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except JWTError:
            return JSONResponse({"details": "Invalid or Expired"}, status_code=401)

        request.state.user = {
            "id": payload.get("sub"),
            "role": payload.get("role", "")
        }

        return await call_next(request)
