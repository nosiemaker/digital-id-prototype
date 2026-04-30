"""
audit_router.py — ZDID Audit Log Endpoints
============================================

Endpoints
---------
GET /audit-logs/me                  — Citizen: view their own audit trail
GET /audit-logs/citizens/{din}      — Officer+: view any citizen's audit trail
GET /audit-logs/                    — Supervisor+: full log with filters
GET /audit-logs/{log_id}            — Supervisor+: single log entry detail

Mount in main.py:
    from audit.audit_router import router as audit_router
    app.include_router(audit_router, prefix="/audit-logs", tags=["Audit Logs"])
"""

from __future__ import annotations

from  fastapi import APIRouter, Query, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from asgiref.sync import sync_to_async

from audit.models import AuditLog
from dependencies.auth import UserRole, require_groups, get_current_user

router = APIRouter()


class AuditLogOut(BaseModel):
    id: int
    actor_id: str
    actor_role: str
    action: str
    target_type: str
    target_id: str
    outcome: str
    ip_address: Optional[str]
    metastamp: Optional[dict]
    timestamp: datetime

    class Config:
        from_attributes = True
class PaginatedAuditLogs(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[AuditLogOut]

def _qs_to_schema(qs) -> list[AuditLogOut]:
    return [
        AuditLogOut(
            id=log.id,
            actor_id=log.actor_id,
            actor_role=log.actor_role,
            action=log.action,
            target_type=log.target_type,
            target_id=log.target_id,
            outcome=log.outcome,
            ip_address=log.ip_address,
            metastamp=log.metastamp,
            timestamp=log.timestamp,
        )
        for log in qs
    ]

async def _paginate(queryset, page: int, page_size: int) -> tuple[int, list]:
    """Returns (total_count, sliced_queryset) — both DB calls are async."""
    count = await sync_to_async(queryset.count)()
    offset = (page - 1) * page_size
    records = await sync_to_async(list)(queryset[offset : offset + page_size])
    return count, records

@router.get(
    "/me",
    response_model=PaginatedAuditLogs,
    summary="View my audit trail",
    description=(
        "Returns audit log entries where the authenticated citizen is either "
        "the actor or the subject (target_id matches their DIN). "
        "Sensitive system fields are excluded."
    ),
)
async def get_my_audit_logs(
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        action: Optional[str] = Query(None, description="Filter by action, e.g. KYC_CONSENT_GRANTED"),
        outcome: Optional[str] = Query(None, description="Filter by outcome: SUCCESS or FAILURE"),
        user: dict = Depends(require_groups([UserRole.CITIZEN])),
):
    din: str = user.get("din") or user.get("citizen_din")
    if not din:
        raise HTTPException(status_code=400, detail="No DIN associated with your account.")

    # Show entries where the citizen was the actor OR the subject
    qs = AuditLog.objects.filter(
            actor_id=din
    ) | AuditLog.objects.filter(
            target_type="CITIZEN", target_id=din
    )
    qs = qs.order_by("-timestamp")

    if action:
        qs = qs.filter(action__iexact=action)
    if outcome:
        qs = qs.filter(outcome__iexact=outcome)

    total, records = await _paginate(qs, page, page_size)

    # Strip ip_address and metastamp from citizen-facing output for privacy
    results = []
    for log in records:
        results.append(AuditLogOut(
            id=log.id,
            actor_id=log.actor_id,
            actor_role=log.actor_role,
            action=log.action,
            target_type=log.target_type,
            target_id=log.target_id,
            outcome=log.outcome,
            ip_address=None,
            metastamp=None,
            timestamp=log.timestamp,
        ))

    return PaginatedAuditLogs(total=total, page=page, page_size=page_size, results=results)

@router.get(
    "/citizens/{din}",
    response_model=PaginatedAuditLogs,
    summary="View a citizen's audit trail",
    description="Registration Officers and above can view the full audit trail for any citizen by DIN.",
)
async def get_citizen_audit_los(
    din: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: Optional[str] = Query(None),
    outcome: Optional[str] = Query(None),
    user: dict = Depends(require_groups([
        UserRole.REGISTRATION_OFFICER,
        UserRole.REGISTRAR,
        UserRole.SUPERVISOR,
    ])),
):
    qs = (
        AuditLog.objects.filter(actor_id=din) |
        AuditLog.objects.filter(target_type="CITIZEN", target_id=din)
    ).order_by("-timestamp")

    if action:
        qs = qs.filter(action__iexact=action)
    if outcome:
        qs = qs.filter(outcome__iexact=outcome)

    total, records = await _paginate(qs, page, page_size)
    return PaginatedAuditLogs(total=total, page=page, page_size=page_size,
                              results=_qs_to_schema(records),
                              )

# Supervisor+: full system log with broad filters

@router.get(
    "/",
    response_model=PaginatedAuditLogs,
    summary="Browse all audit logs",
    description="Supervisors can query the full system audit log with optional filters.",
)
async def list_audit_logs(
        page: int = Query(1, ge=1),
        page_size: int = Query(50, ge=1, le=200),
        actor_id: Optional[str] = Query(None, description="Filter by actor (user ID or DIN)"),
        actor_role: Optional[str] = Query(None, description="Filter by actor role"),
        action: Optional[str] = Query(None, description="Filter by action"),
        target_type: Optional[str] = Query(None, description="Filter by target type, e.g. CITIZEN"),
        target_id: Optional[str] = Query(None, description="Filter by target ID"),
        outcome: Optional[str] = Query(None, description="SUCCESS or FAILURE"),
        from_date: Optional[datetime] = Query(None, description="Start of date range (ISO 8601)"),
        to_date: Optional[datetime] = Query(None, description="End of date range (ISO 8601)"),
        user: dict = Depends(require_groups([UserRole.SUPERVISOR])),
):
    qs = AuditLog.objects.all().order_by("-timestamp")

    if actor_id:
        qs = qs.filter(actor_id=actor_id)
    if actor_role:
        qs = qs.filter(actor_role__iexact=actor_role)
    if action:
        qs = qs.filter(action__iexact=action)
    if target_type:
        qs = qs.filter(target_type__iexact=target_type)
    if target_id:
        qs = qs.filter(target_id=target_id)
    if outcome:
        qs = qs.filter(outcome__iexact=outcome)
    if from_date:
        qs = qs.filter(timestamp__gte=from_date)
    if to_date:
        qs = qs.filter(timestamp__lte=to_date)

    total, records = await _paginate(qs, page, page_size)
    return PaginatedAuditLogs(
        total=total, page=page, page_size=page_size,
        results=_qs_to_schema(records),
    )

# Supervisor+: single log entry detail
@router.get(
    "/{log_id}",
    response_model=AuditLogOut,
    summary="Get a single audit log entry",
)
async def get_audit_log_entry(
        log_id: int,
        user: dict = Depends(require_groups([UserRole.SUPERVISOR])),
):
    try:
        log = await sync_to_async(AuditLog.objects.get)(id=log_id)
    except AuditLog.DoesNotExist:
        raise HTTPException(status_code=404, detail=f"Audit log {log_id} not found.")
    return AuditLogOut(
        id=log.id,
        actor_id=log.actor_id,
        actor_role=log.actor_role,
        action=log.action,
        target_type=log.target_type,
        target_id=log.target_id,
        outcome=log.outcome,
        ip_address=log.ip_address,
        metastamp=log.metastamp,
        timestamp=log.timestamp,
    )