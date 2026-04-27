# districts.py (Router)
# Public endpoints for province and district lookups.
# Used by the frontend to populate province → district dropdowns.
# No authentication required — this is reference data.

from fastapi import APIRouter, Query
from asgiref.sync import sync_to_async
from citizens.models import Province, District

router = APIRouter()


def _get_provinces():
    provinces = Province.objects.filter(is_active=True).prefetch_related("districts").order_by("name")
    return [
        {
            "id": p.id,
            "name": p.name,
            "code": p.code,
        }
        for p in provinces
    ]


def _get_districts(province_code: str | None):
    qs = District.objects.select_related("province").filter(is_active=True).order_by("name")
    if province_code:
        from django.db.models import Q
        search_val = province_code.upper()
        qs = qs.filter(Q(province__code=search_val ) | Q(province__name__iexact=search_val))
    return [
        {
            "id": d.id,
            "name": d.name,
            "code": d.code,
            "province_name": d.province.name,
            "province_code": d.province.code,
        }
        for d in qs
    ]

@router.get("/", summary="List districts, optionally filtered by province code")
async def list_districts(
    province_code: str | None = Query(
        default=None,
        description="Filter by province code e.g. LUSAKA, COPPERBELT"
    )
):
    """
    Returns districts, optionally filtered by province code.
    Called whenever the user selects a province on the identity submission form.

    Example: GET /districts/?province_code=LUSAKA
    """
    return await sync_to_async(_get_districts)(province_code)

@router.get("/provinces", summary="List all active provinces")
async def list_provinces():
    """
    Returns all active provinces.
    Used to populate the province dropdown on the identity submission form.
    """
    return await sync_to_async(_get_provinces)()
