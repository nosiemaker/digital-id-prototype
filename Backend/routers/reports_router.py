"""
reports_router.py — ZDID Reports Aggregation & Export Audit
Mount in main.py:
    from reports_router import router as reports_router
    app.include_router(reports_router, prefix="/api/reports", tags=["Reports"])
"""
from __future__ import annotations
from fastapi import APIRouter, Query, Depends, Request
from pydantic import BaseModel
from typing import Optional
from datetime import date
from asgiref.sync import sync_to_async
from django.db.models import Count
from django.db.models.functions import TruncMonth

from dependencies.auth import require_groups, UserRole
# Adjust import path to match your project structure
from Utils.audit_logger import audit
from citizens.models import Citizen, CitizenStatus
from registration.models import EnrollmentRequest, EnrollmentStatus
from admin_ops.models import SystemUser, UserRole as AdminUserRole

router = APIRouter()

class ExportLogRequest(BaseModel):
    export_type: str  # "births", "deaths", "all"
    record_count: int

class ReportsSummaryResponse(BaseModel):
    kpi: dict
    monthly_trends: dict
    demographics: dict

class AdminStatsResponse(BaseModel):
    kpi: dict
    staff_breakdown: dict
    distributions: dict
    recent_registrations: list
    trends: list

def _compute_summary(date_from: Optional[date], date_to: Optional[date], district: Optional[str]) -> dict:
    """
    Synchronous Django ORM aggregation.
    Wrapped in sync_to_async for FastAPI compatibility.
    """
    # Base querysets with related objects pre-fetched
    b_qs = BirthRecords.objects.select_related("notice_of_birth")
    d_qs = DeathRecords.objects.select_related("medical_certificate_of_death", "notice_of_death")

    # Apply filters
    if date_from:
        b_qs = b_qs.filter(notice_of_birth__date_of_birth__gte=date_from)
        d_qs = d_qs.filter(medical_certificate_of_death__death_date__gte=date_from)
    if date_to:
        b_qs = b_qs.filter(notice_of_birth__date_of_birth__lte=date_to)
        d_qs = d_qs.filter(medical_certificate_of_death__death_date__lte=date_to)
    if district and district.lower() != "all":
        b_qs = b_qs.filter(notice_of_birth__district__iexact=district)
        d_qs = d_qs.filter(medical_certificate_of_death__district__iexact=district)

    # KPI Counts
    b_counts = {s: b_qs.filter(status=s).count() for s in ["PENDING", "APPROVED", "REJECTED"]}
    d_counts = {s: d_qs.filter(status=s).count() for s in ["PENDING", "APPROVED", "REJECTED"]}

    total = sum(b_counts.values()) + sum(d_counts.values())
    approved = b_counts["APPROVED"] + d_counts["APPROVED"]
    pending = b_counts["PENDING"] + d_counts["PENDING"]
    rejected = b_counts["REJECTED"] + d_counts["REJECTED"]
    approval_rate = round((approved / total * 100), 1) if total else 0.0

    # Avg Processing Time (hours) for approved records
    approved_b = list(b_qs.filter(status="APPROVED", reviewed_at__isnull=False).values_list("submitted_at", "reviewed_at"))
    approved_d = list(d_qs.filter(status="APPROVED", reviewed_at__isnull=False).values_list("submitted_at", "reviewed_at"))
    diffs = [(r - c).total_seconds() for c, r in approved_b + approved_d if r and c]
    avg_hours = round(sum(diffs) / len(diffs) / 3600, 1) if diffs else 0.0

    # Monthly Trends
    b_monthly = list(
        b_qs.annotate(month=TruncMonth("notice_of_birth__date_of_birth"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )
    d_monthly = list(
        d_qs.annotate(month=TruncMonth("medical_certificate_of_death__death_date"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )

    # Demographics
    b_sex = dict(
        b_qs.values("notice_of_birth__sex")
        .annotate(c=Count("id"))
        .values_list("notice_of_birth__sex", "c")
    )
    b_place = dict(
        b_qs.values("notice_of_birth__place_of_birth")
        .annotate(c=Count("id"))
        .values_list("notice_of_birth__place_of_birth", "c")
    )
    d_place = dict(
        d_qs.values("notice_of_death__place_of_death")
        .annotate(c=Count("id"))
        .values_list("notice_of_death__place_of_death", "c")
    )
    d_causes = list(
        d_qs.exclude(medical_certificate_of_death__cause_a__isnull=True)
        .exclude(medical_certificate_of_death__cause_a__exact="")
        .values("medical_certificate_of_death__cause_a")
        .annotate(c=Count("id"))
        .order_by("-c")[:5]
    )

    return {
        "kpi": {
            "total": total,
            "approved": approved,
            "pending": pending,
            "rejected": rejected,
            "approval_rate": approval_rate,
            "avg_processing_hours": avg_hours,
        },
        "monthly_trends": {
            "births": [{"date": str(x["month"].isoformat()), "count": x["count"]} for x in b_monthly],
            "deaths": [{"date": str(x["month"].isoformat()), "count": x["count"]} for x in d_monthly],
        },
        "demographics": {
            "births_by_sex": b_sex,
            "births_by_place": b_place,
            "deaths_by_place": d_place,
            "top_death_causes": [{"cause": c["medical_certificate_of_death__cause_a"], "count": c["c"]} for c in d_causes],
        },
    }

@router.get("/summary", response_model=ReportsSummaryResponse)
async def get_reports_summary(
    date_from: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    district: Optional[str] = Query("all", description="Filter by district"),
    user: dict = Depends(require_groups([UserRole.REGISTRAR, UserRole.SUPERVISOR])),
):
    """
    Aggregated vital statistics & monthly trends for the Reports dashboard.
    Computes KPIs, trends, and demographics server-side for performance.
    """
    result = await sync_to_async(_compute_summary)(date_from, date_to, district)
    return result


def _get_admin_stats():
    # Citizen KPIs
    total_citizens = Citizen.objects.count()
    verified_citizens = Citizen.objects.filter(status=CitizenStatus.ACTIVE).count()
    pending_enrollments = EnrollmentRequest.objects.filter(status=EnrollmentStatus.PENDING).count()
    rejected_enrollments = EnrollmentRequest.objects.filter(status=EnrollmentStatus.REJECTED).count()

    # Staff Breakdown
    total_staff = SystemUser.objects.exclude(role=AdminUserRole.CITIZEN).count()
    ro_count = SystemUser.objects.filter(role=AdminUserRole.REGISTRATION_OFFICER).count()
    hw_count = SystemUser.objects.filter(role=AdminUserRole.HEALTH_WORKER).count()
    registrar_count = SystemUser.objects.filter(role=AdminUserRole.REGISTRAR).count()

    # --- New Detailed Analytics ---
    # Citizen Type Distribution
    types_count = Citizen.objects.values("citizen_type").annotate(count=Count("id"))
    types_map = {item["citizen_type"]: item["count"] for item in types_count}
    
    # Gender Distribution
    gender_count = Citizen.objects.values("gender").annotate(count=Count("id"))
    gender_map = {item["gender"]: item["count"] for item in gender_count}

    # Education Distribution
    edu_count = Citizen.objects.values("education_level").annotate(count=Count("id"))
    edu_map = {item["education_level"]: item["count"] for item in edu_count if item["education_level"]}

    # Recent Registrations (Last 7)
    recent = EnrollmentRequest.objects.select_related("citizen").order_by("-submitted_at")[:7]
    recent_list = [
        {
            "id": r.id,
            "name": r.citizen.full_name,
            "date": r.submitted_at.strftime("%d %b %Y"),
            "status": r.status,
            "nrc": r.citizen.nrc
        }
        for r in recent
    ]

    # Trends (Mocked for now)
    trends = [65, 72, 68, 80, 88, 91, 85, 95, 102, 98, 110, 115]

    return {
        "kpi": {
            "total_citizens": f"{total_citizens:,}",
            "verified_ids": f"{verified_citizens:,}",
            "pending_registrations": f"{pending_enrollments:,}",
            "rejected_applications": f"{rejected_enrollments:,}"
        },
        "staff_breakdown": {
            "total": total_staff,
            "ro_count": ro_count,
            "hw_count": hw_count,
            "registrar_count": registrar_count,
            "ro_pct": round((ro_count / total_staff * 100), 0) if total_staff else 0,
            "hw_pct": round((hw_count / total_staff * 100), 0) if total_staff else 0,
        },
        "distributions": {
            "citizen_types": [
                {"label": "Adults", "value": types_map.get("ADULT", 0)},
                {"label": "Seniors", "value": types_map.get("SENIOR", 0)},
                {"label": "Children (>16)", "value": types_map.get("CHILD_ABOVE_16", 0)},
                {"label": "Children (<16)", "value": types_map.get("CHILD_UNDER_16", 0)},
            ],
            "gender": [
                {"label": "Male", "value": gender_map.get("MALE", 0)},
                {"label": "Female", "value": gender_map.get("FEMALE", 0)},
            ],
            "education": [
                {"label": label, "value": count} for label, count in edu_map.items()
            ]
        },
        "recent_registrations": recent_list,
        "trends": trends
    }

@router.get("/admin-stats", response_model=AdminStatsResponse)
async def get_admin_dashboard_stats(
    user: dict = Depends(require_groups([UserRole.REGISTRAR, UserRole.SUPERVISOR, UserRole.REGISTRATION_OFFICER])),
):
    """
    Real-time statistics for the main Admin Dashboard.
    """
    return await sync_to_async(_get_admin_stats)()


@router.post("/log-export")
async def log_export_action(
    payload: ExportLogRequest,
    request: Request,
    user: dict = Depends(require_groups([UserRole.REGISTRAR, UserRole.SUPERVISOR])),
):
    """
    Audit log for CSV/PDF report exports (compliance tracking).
    Uses the centralized audit_logger to ensure non-blocking, tamper-evident logging.
    """
    actor_id = str(user.get("id") or user.get("din") or "unknown")
    actor_role = user.get("role", "REGISTRAR")
    ip = request.client.host if request.client else None

    await audit.alog(
        actor_id=actor_id,
        actor_role=actor_role,
        action="REPORT_EXPORT",
        target_type="REPORT",
        target_id=payload.export_type,
        meta={"record_count": payload.record_count, "export_type": payload.export_type},
        ip_address=ip,
    )
    return {"status": "logged", "message": "Export action recorded in audit trail"}

@router.get("/health")
async def reports_health():
    return {"status": "ok", "message": "Reports router is active"}