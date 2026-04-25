"""
Seed Script — ZDID
------------------
Run once after migrations to populate test data for development/demo.

Usage:
    cd backend
    python seed.py

Creates one user per role + one test citizen with a pending enrollment.
Resets cleanly — deletes existing seed data before inserting.
"""

import os
import sys
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "zdid_core.settings")
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from admin_ops.models import SystemUser, UserRole                     # noqa: E402
from citizens.models import Citizen, CitizenStatus                    # noqa: E402
from registration.models import EnrollmentRequest, EnrollmentStatus  # noqa: E402
from Utils.auth import hash_password                                  # noqa: E402
from Utils.biometrics import (                                        # noqa: E402
    quantize_embedding,
    derive_din_from_embedding,
)

SEED_EMAILS = [
    "ro@zdid.zm",
    "registrar@zdid.zm",
    "supervisor@zdid.zm",
    "healthworker@zdid.zm",
    "citizen@zdid.zm",
    "mary@zdid.zm",
]

print("🌱 Seeding ZDID database...")

# ── Clean existing seed users ──────────────────────────────────────────────────
deleted, _ = SystemUser.objects.filter(email__in=SEED_EMAILS).delete()
print(f"  Removed {deleted} existing seed user(s)")

deleted_citizens, _ = Citizen.objects.filter(nrc__in=["123456/78/1", "987654/32/1"]).delete()
print(f"  Removed {deleted_citizens} existing seed citizen(s)")

# ── Create system users ────────────────────────────────────────────────────────
pw = hash_password("zdid1234")  # All dev accounts use the same password

ro = SystemUser.objects.create(
    role=UserRole.REGISTRATION_OFFICER,
    email="ro@zdid.zm",
    password_hash=pw,
    name="Moses Banda",
    is_active=True,
)
print(f"  ✅ RO created: {ro.email}")

registrar = SystemUser.objects.create(
    role=UserRole.REGISTRAR,
    email="registrar@zdid.zm",
    password_hash=pw,
    name="Grace Mwale",
    is_active=True,
)
print(f"  ✅ Registrar created: {registrar.email}")

supervisor = SystemUser.objects.create(
    role=UserRole.SUPERVISOR,
    email="supervisor@zdid.zm",
    password_hash=pw,
    name="James Phiri",
    is_active=True,
)
print(f"  ✅ Supervisor created: {supervisor.email}")

hw = SystemUser.objects.create(
    role=UserRole.HEALTH_WORKER,
    email="healthworker@zdid.zm",
    password_hash=pw,
    name="Charity Tembo",
    is_active=True,
)
print(f"  ✅ Health Worker created: {hw.email}")

# ── Create a test citizen ──────────────────────────────────────────────────────
# Simulates a citizen who has submitted their enrollment
citizen_user = SystemUser.objects.create(
    role=UserRole.CITIZEN,
    email="citizen@zdid.zm",
    password_hash=pw,
    name="John Mulenga",
    is_active=True,
)

citizen = Citizen.objects.create(
    nrc="123456/78/1",
    full_name="John Mulenga",
    dob="1990-05-15",
    phone="+260971234567",
    public_key="-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEPLACO+placeholder+key+here==\n-----END PUBLIC KEY-----",
    status=CitizenStatus.PENDING,
)

EnrollmentRequest.objects.create(
    citizen=citizen,
    status=EnrollmentStatus.PENDING,
)

# Link citizen user to citizen record
citizen_user.citizen_din = None  # Will be set after RO approves
citizen_user.save()

print(f"  ✅ Citizen created: {citizen_user.email} (enrollment PENDING)")

# ── Create an approved citizen for demo ───────────────────────────────────────
# In real enrollment, the DIN comes from process_enrollment_biometrics(image_bytes).
# For seeding, we simulate a pre-computed embedding (all zeros = placeholder).
# This gives us a deterministic DIN for demo purposes.
_seed_embedding = [0.01 * (i % 100 - 50) for i in range(512)]  # stable placeholder
_seed_quantized = quantize_embedding(_seed_embedding)
approved_din, _commitment = derive_din_from_embedding(_seed_quantized)

approved_citizen = Citizen.objects.create(
    din=approved_din,
    nrc="987654/32/1",
    full_name="Mary Zulu",
    dob="1985-11-22",
    phone="+260977654321",
    public_key="-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEApprovedPlaceholderKeyHere==\n-----END PUBLIC KEY-----",
    status=CitizenStatus.ACTIVE,
)

approved_user = SystemUser.objects.create(
    role=UserRole.CITIZEN,
    email="mary@zdid.zm",
    password_hash=pw,
    name="Mary Zulu",
    citizen_din=approved_din,
    is_active=True,
)
print(f"  ✅ Approved citizen created: {approved_user.email} DIN={approved_din}")

# ── Summary ────────────────────────────────────────────────────────────────────
print("\n🎉 Seed complete. All accounts use password: zdid1234\n")
print("  ro@zdid.zm             → Registration Officer")
print("  registrar@zdid.zm      → Registrar")
print("  supervisor@zdid.zm     → Supervisor")
print("  healthworker@zdid.zm   → Health Worker")
print("  citizen@zdid.zm        → Citizen (pending enrollment)")
print("  mary@zdid.zm           → Citizen (active, DIN issued)")
