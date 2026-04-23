"""
audit_logger.py — ZDID Centralized Audit Logging Utility
=========================================================

Usage summary
-------------
1. Simple one-liner from any service:
       audit.log(actor_id, actor_role, action, target_type, target_id)

2. Async version (inside FastAPI route handlers):
       await audit.alog(...)

3. FastAPI middleware (auto-logs every mutating request):
       app.add_middleware(AuditMiddleware)

4. Pre-built action helpers (no magic strings):
       audit.citizen_enrolled(ro_id, din)
       audit.enrollment_approved(ro_id, enrollment_id)
       audit.enrollment_rejected(ro_id, enrollment_id, reason)
       audit.biometric_captured(ro_id, din)
       audit.citizen_updated(actor_id, din)
       audit.citizen_deleted(actor_id, din)
       audit.citizen_activated(actor_id, din)
       audit.citizen_suspended(actor_id, din)
       audit.family_link_created(actor_id, din, related_din)
       audit.kyc_consent_granted(citizen_din, institution_id)
       audit.kyc_consent_denied(citizen_din, institution_id)
       audit.user_login(user_id, role, ip)
       audit.user_logout(user_id)
       audit.login_failed(email, ip)

All writes are non-blocking — failures are caught and logged to stderr
so a broken audit write never takes down a live request.
"""

from __future__ import annotations

import hashlib
import json
import logging
import traceback
from datetime import datetime, timezone
from typing import Any, Optional

from asgiref.sync import sync_to_async
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _build_signature(payload: dict) -> str:
    """
    SHA-256 hex digest of the canonical JSON payload.
    Provides tamper-evidence for each log row (not a full HMAC —
    swap in HMAC-SHA256 with a secret if you have an HSM available).
    """
    canonical = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()


def _write(
    actor_id: str,
    actor_role: str,
    action: str,
    target_type: str,
    target_id: str,
    outcome: str = "SUCCESS",
    ip_address: Optional[str] = None,
    metastamp: Optional[dict[str, Any]] = None,
) -> None:
    """
    Synchronous write — safe to call from Django ORM / sync service code.
    Import AuditLog lazily so this module can be imported without Django
    being fully initialised (e.g. during testing).
    """
    try:
        from audit.models import AuditLog

        payload = {
            "actor_id": actor_id,
            "actor_role": actor_role,
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "outcome": outcome,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        AuditLog.objects.create(
            actor_id=str(actor_id),
            actor_role=str(actor_role),
            action=str(action),
            target_type=str(target_type),
            target_id=str(target_id),
            outcome=outcome,
            ip_address=ip_address,
            metastamp=metastamp,
            log_signature=_build_signature(payload),
        )
    except Exception:  # noqa: BLE001
        # Never let an audit failure crash the caller.
        logger.error("AuditLog write failed:\n%s", traceback.format_exc())


async def _awrite(
    actor_id: str,
    actor_role: str,
    action: str,
    target_type: str,
    target_id: str,
    outcome: str = "SUCCESS",
    ip_address: Optional[str] = None,
    metastamp: Optional[dict[str, Any]] = None,
) -> None:
    """Async wrapper around the sync write — use inside FastAPI route handlers."""
    await sync_to_async(_write)(
        actor_id=actor_id,
        actor_role=actor_role,
        action=action,
        target_type=target_type,
        target_id=target_id,
        outcome=outcome,
        ip_address=ip_address,
        metastamp=metastamp,
    )


# ---------------------------------------------------------------------------
# Public API — import this object everywhere
# ---------------------------------------------------------------------------

class AuditLogger:
    """
    Thin façade.  Import once and use across the whole project:

        from Utils.audit_logger import audit

        audit.log(...)
        await audit.alog(...)
        audit.citizen_enrolled(...)
    """

    # ---- core methods ----

    def log(
        self,
        actor_id: str | int,
        actor_role: str,
        action: str,
        target_type: str,
        target_id: str | int,
        *,
        outcome: str = "SUCCESS",
        ip_address: Optional[str] = None,
        meta: Optional[dict[str, Any]] = None,
    ) -> None:
        """Synchronous — call from service-layer functions."""
        _write(
            actor_id=str(actor_id),
            actor_role=actor_role,
            action=action,
            target_type=target_type,
            target_id=str(target_id),
            outcome=outcome,
            ip_address=ip_address,
            metastamp=meta,
        )

    async def alog(
        self,
        actor_id: str | int,
        actor_role: str,
        action: str,
        target_type: str,
        target_id: str | int,
        *,
        outcome: str = "SUCCESS",
        ip_address: Optional[str] = None,
        meta: Optional[dict[str, Any]] = None,
    ) -> None:
        """Async — call from FastAPI route handlers."""
        await _awrite(
            actor_id=str(actor_id),
            actor_role=actor_role,
            action=action,
            target_type=target_type,
            target_id=str(target_id),
            outcome=outcome,
            ip_address=ip_address,
            metastamp=meta,
        )

    # ---- Auth ----

    async def user_login(
        self, user_id: str | int, role: str, ip: Optional[str] = None
    ) -> None:
        await self.alog(user_id, role, "USER_LOGIN", "SYSTEM_USER", str(user_id), ip_address=ip)

    async def user_logout(self, user_id: str | int, role: str = "UNKNOWN") -> None:
        await self.alog(user_id, role, "USER_LOGOUT", "SYSTEM_USER", str(user_id))

    async def login_failed(
        self, email: str, ip: Optional[str] = None
    ) -> None:
        await self.alog(
            actor_id="ANONYMOUS",
            actor_role="UNKNOWN",
            action="LOGIN_FAILED",
            target_type="SYSTEM_USER",
            target_id=email,
            outcome="FAILURE",
            ip_address=ip,
            meta={"email": email},
        )

    # ---- Enrollment / Registration ----

    def citizen_enrolled(
        self, ro_id: str | int, din: str, meta: Optional[dict] = None
    ) -> None:
        self.log(ro_id, "RO", "ENROLL_CITIZEN", "CITIZEN", din, meta=meta)

    def enrollment_approved(
        self, ro_id: str | int, enrollment_id: int, meta: Optional[dict] = None
    ) -> None:
        self.log(
            ro_id, "RO", "APPROVE_ENROLLMENT", "ENROLLMENT", str(enrollment_id), meta=meta
        )

    def enrollment_rejected(
        self,
        ro_id: str | int,
        enrollment_id: int,
        reason: str,
        meta: Optional[dict] = None,
    ) -> None:
        merged = {"rejection_reason": reason, **(meta or {})}
        self.log(
            ro_id,
            "RO",
            "REJECT_ENROLLMENT",
            "ENROLLMENT",
            str(enrollment_id),
            outcome="FAILURE",
            meta=merged,
        )

    # ---- Biometrics ----

    def biometric_captured(
        self, actor_id: str | int, din: str, meta: Optional[dict] = None
    ) -> None:
        self.log(actor_id, "RO", "BIOMETRICS_CAPTURED", "BIOMETRIC", din, meta=meta)

    def biometric_updated(
        self, actor_id: str | int, din: str, meta: Optional[dict] = None
    ) -> None:
        self.log(actor_id, "RO", "BIOMETRICS_UPDATED", "BIOMETRIC", din, meta=meta)

    # ---- Citizen lifecycle ----

    def citizen_updated(
        self, actor_id: str | int, actor_role: str, din: str, fields: Optional[list[str]] = None
    ) -> None:
        self.log(
            actor_id,
            actor_role,
            "UPDATE_CITIZEN",
            "CITIZEN",
            din,
            meta={"updated_fields": fields} if fields else None,
        )

    def citizen_deleted(self, actor_id: str | int, actor_role: str, din: str) -> None:
        self.log(actor_id, actor_role, "DELETE_CITIZEN", "CITIZEN", din)

    def citizen_activated(self, actor_id: str | int, din: str) -> None:
        self.log(actor_id, "SYSTEM", "ACTIVATE_CITIZEN", "CITIZEN", din)

    def citizen_suspended(self, actor_id: str | int, actor_role: str, din: str) -> None:
        self.log(actor_id, actor_role, "SUSPEND_CITIZEN", "CITIZEN", din)

    def citizen_reinstated(self, actor_id: str | int, actor_role: str, din: str) -> None:
        self.log(actor_id, actor_role, "REINSTATE_CITIZEN", "CITIZEN", din)

    # ---- Family links ----

    def family_link_created(
        self,
        actor_id: str | int,
        din: str,
        related_din: str,
        relationship_type: str,
    ) -> None:
        self.log(
            actor_id,
            "RO",
            "CREATE_FAMILY_LINK",
            "FAMILY_LINK",
            din,
            meta={"related_din": related_din, "relationship_type": relationship_type},
        )

    def family_link_deleted(
        self, actor_id: str | int, din: str, related_din: str, relationship_type: str
    ) -> None:
        self.log(
            actor_id,
            "RO",
            "DELETE_FAMILY_LINK",
            "FAMILY_LINK",
            din,
            meta={"related_din": related_din, "relationship_type": relationship_type},
        )

    # ---- KYC / GSB ----

    async def kyc_consent_granted(
        self,
        citizen_din: str,
        institution_id: str,
        fields_shared: Optional[list[str]] = None,
    ) -> None:
        await self.alog(
            citizen_din,
            "CITIZEN",
            "KYC_CONSENT_GRANTED",
            "KYC_REQUEST",
            institution_id,
            meta={"fields_shared": fields_shared},
        )

    async def kyc_consent_denied(
        self, citizen_din: str, institution_id: str
    ) -> None:
        await self.alog(
            citizen_din,
            "CITIZEN",
            "KYC_CONSENT_DENIED",
            "KYC_REQUEST",
            institution_id,
            outcome="FAILURE",
        )

    async def kyc_request_initiated(
        self,
        user_id: str | int,
        institution_id: str | int,
        citizen_din: str,
        kyc_request_id: int
    ) -> None:
        await self.alog(
            user_id,
            "THIRD_PARTY",
            "KYC_REQUEST_INITIATED",
            "KYC_REQUEST",
            str(kyc_request_id),
            meta={"institution_id": institution_id, "citizen_din": citizen_din}
        )

    async def kyc_request_responded(
        self,
        user_id: str | int,
        kyc_request_id: int,
        decision: str
    ) -> None:
        await self.alog(
            user_id,
            "CITIZEN",
            "KYC_REQUEST_RESPONDED",
            "KYC_REQUEST",
            str(kyc_request_id),
            meta={"decision": decision}
        )

    # ---- Birth / Death records ----

    def birth_record_submitted(self, worker_id: str | int, record_id: str) -> None:
        self.log(worker_id, "HEALTH_WORKER", "BIRTH_RECORD_SUBMITTED", "BIRTH_RECORD", record_id)

    def birth_record_approved(self, ro_id: str | int, record_id: str) -> None:
        self.log(ro_id, "RO", "BIRTH_RECORD_APPROVED", "BIRTH_RECORD", record_id)

    def death_record_submitted(self, worker_id: str | int, record_id: str) -> None:
        self.log(worker_id, "HEALTH_WORKER", "DEATH_RECORD_SUBMITTED", "DEATH_RECORD", record_id)

    def death_record_approved(self, ro_id: str | int, record_id: str) -> None:
        self.log(ro_id, "RO", "DEATH_RECORD_APPROVED", "DEATH_RECORD", record_id)


# Module-level singleton — import this everywhere
audit = AuditLogger()


# ---------------------------------------------------------------------------
# FastAPI Middleware — automatic audit of every mutating HTTP request
# ---------------------------------------------------------------------------

_AUDITED_METHODS = {"POST", "PATCH", "PUT", "DELETE"}

# Routes that should NOT be auto-audited (e.g. the login route handles it manually)
_SKIP_PATHS = {"/auth/login", "/auth/logout", "/auth/refresh"}


class AuditMiddleware(BaseHTTPMiddleware):
    """
    Automatically writes an audit entry for every mutating HTTP request.
    Reads actor identity from request.state.user (set by AuthMiddleware).

    Register in main.py:
        from Utils.audit_logger import AuditMiddleware
        app.add_middleware(AuditMiddleware)

    The middleware adds a FAILURE entry when the response status is 4xx/5xx.
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        if request.method not in _AUDITED_METHODS:
            return response
        if request.url.path in _SKIP_PATHS:
            return response

        user = getattr(request.state, "user", None)
        if not user:
            return response  # unauthenticated requests are logged at the route level

        actor_id = str(user.get("id", "UNKNOWN"))
        actor_role = str(user.get("role", "UNKNOWN"))
        action = _derive_action(request.method, request.url.path)
        target_type, target_id = _derive_target(request.url.path)
        outcome = "SUCCESS" if response.status_code < 400 else "FAILURE"
        ip = _get_ip(request)

        await _awrite(
            actor_id=actor_id,
            actor_role=actor_role,
            action=action,
            target_type=target_type,
            target_id=target_id,
            outcome=outcome,
            ip_address=ip,
            metastamp={
                "http_method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
            },
        )

        return response


def _get_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def _derive_action(method: str, path: str) -> str:
    """
    Map HTTP method + path segment to a human-readable action string.
    e.g.  PATCH /citizens/ZM-001/biometrics  →  UPDATE_BIOMETRIC
    """
    _method_map = {
        "POST": "CREATE",
        "PATCH": "UPDATE",
        "PUT": "UPDATE",
        "DELETE": "DELETE",
    }
    verb = _method_map.get(method, method)

    path_lower = path.lower()
    if "biometrics" in path_lower:
        noun = "BIOMETRIC"
    elif "family-links" in path_lower or "family-tree" in path_lower:
        noun = "FAMILY_LINK"
    elif "enrollments" in path_lower and "approve" in path_lower:
        return "APPROVE_ENROLLMENT"
    elif "enrollments" in path_lower and "reject" in path_lower:
        return "REJECT_ENROLLMENT"
    elif "enrollments" in path_lower:
        noun = "ENROLLMENT"
    elif "citizens" in path_lower:
        noun = "CITIZEN"
    elif "audit" in path_lower:
        noun = "AUDIT_LOG"
    else:
        # Fallback: use the last non-empty path segment
        parts = [p for p in path.split("/") if p and not p.startswith("{")]
        noun = parts[-1].upper().replace("-", "_") if parts else "RESOURCE"

    return f"{verb}_{noun}"


def _derive_target(path: str) -> tuple[str, str]:
    """
    Extract (target_type, target_id) from the URL path.
    e.g. /citizens/ZM-001/biometrics  →  ("CITIZEN", "ZM-001")
         /enrollments/42/approve      →  ("ENROLLMENT", "42")
    """
    parts = [p for p in path.split("/") if p]

    # Walk segments: the segment after a known collection name is the ID
    _collections = {
        "citizens": "CITIZEN",
        "enrollments": "ENROLLMENT",
        "audit-logs": "AUDIT_LOG",
        "biometrics": "BIOMETRIC",
        "family-links": "FAMILY_LINK",
    }

    target_type = "RESOURCE"
    target_id = "UNKNOWN"

    for i, part in enumerate(parts):
        if part.lower() in _collections:
            target_type = _collections[part.lower()]
            if i + 1 < len(parts) and parts[i + 1] not in _collections:
                target_id = parts[i + 1]
            break

    return target_type, target_id