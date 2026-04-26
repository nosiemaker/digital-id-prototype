import os
import sys
import django
from datetime import datetime, date

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "zdid_core.settings")
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from hospital.models import BirthRecord, DeathRecord, BirthRecordSubmissions, DeathRecordSubmissions, RecordStatus
from citizens.models import Citizen
from admin_ops.models import SystemUser, UserRole

def seed_records():
    print("Seeding Birth and Death Records...")

    # Get a mother for birth records
    mother = Citizen.objects.filter(full_name="Mary Zulu").first()
    if not mother:
        print("Could not find Mary Zulu (seed.py must be run first)")
        return

    # Get a health worker
    hw = SystemUser.objects.filter(role=UserRole.HEALTH_WORKER).first()
    if not hw:
        print("Could not find a Health Worker (seed.py must be run first)")
        return

    # 1. Create a Pending Birth Record
    birth_record = BirthRecord.objects.create(
        mother_din=mother.din,
        mother=mother,
        facility="UTH Lusaka",
        location="Lusaka",
        child_full_name="Baby Boy Mulenga",
        child_dob=date(2024, 3, 20),
        child_sex="MALE",
        born_at=datetime(2024, 3, 20, 14, 30),
        status=RecordStatus.PENDING,
        created_at=datetime.now()
    )

    BirthRecordSubmissions.objects.create(
        record=birth_record,
        health_worker=hw,
        status=RecordStatus.PENDING
    )
    print(f"  Pending Birth Record Created: {birth_record.child_full_name}")

    # 2. Create a Pending Death Record
    # We need a citizen to die. Let's find one or create a temporary one.
    deceased = Citizen.objects.filter(full_name="John Mulenga").first()
    if deceased:
        death_record = DeathRecord.objects.create(
            deceased_din=deceased.din if deceased.din else "PENDING_DIN",
            deceased=deceased,
            health_worker=hw,
            facility="Levy Mwanawasa Hospital",
            cause_icd11="JA00",
            cause_description="Pneumonia",
            died_at=datetime(2024, 3, 18, 0, 0),
            status=RecordStatus.PENDING
        )

        DeathRecordSubmissions.objects.create(
            record=death_record,
            health_worker=hw,
            status=RecordStatus.PENDING
        )
        print(f"  Pending Death Record Created for: {deceased.full_name}")
    else:
        print("  Skipping Death Record (John Mulenga not found)")

    print("\nRecord Seeding Complete.")

if __name__ == "__main__":
    seed_records()
