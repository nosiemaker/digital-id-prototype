from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from jose import JWTError
from Utils.auth import  decode_token

PUBLIC_ROUTES = [
    "/",
    "/docs",
    "/openapi.json",
    "/auth/login",
    "/auth/refresh",
]


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):

        if request.url.path in PUBLIC_ROUTES:
            return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse({"detail": "Missing Token"}, status_code=401)
        token = auth_header.split(" ")[1]

        try:
            payload = decode_token(token)
            # Check token type - should be access token
            if payload.get("type") != "access":
                raise JWTError("Invalid token type")
        except JWTError:
            return JSONResponse({"detail": "Invalid or Expired Token"}, status_code=401)

        request.state.user = {
            "id": int(payload.get("sub")),
            "role": payload.get("role"),
            "email": payload.get("email"),
        }

        return await call_next(request)
