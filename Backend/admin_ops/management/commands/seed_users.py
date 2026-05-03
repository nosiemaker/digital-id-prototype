import random
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
from Utils.auth import hash_password
from admin_ops.models import SystemUser, UserRole
from citizens.models import Citizen, CitizenStatus, Gender, Language, District

# 50 authentic Zambian names (Bemba, Nyanja, Tonga, Lozi, Lunda, etc.)
ZAMBIAN_PROFILES = [
    {"first": "Chilufya", "last": "Chileshe", "gender": "MALE"},
    {"first": "Mwila", "last": "Kabwe", "gender": "MALE"},
    {"first": "Sampa", "last": "Chilala", "gender": "FEMALE"},
    {"first": "Namakando", "last": "Sikazwe", "gender": "FEMALE"},
    {"first": "Mumba", "last": "Mwape", "gender": "MALE"},
    {"first": "Kunda", "last": "Lombe", "gender": "FEMALE"},
    {"first": "Mutambo", "last": "Chisanga", "gender": "MALE"},
    {"first": "Mwansa", "last": "Kabamba", "gender": "MALE"},
    {"first": "Chilenga", "last": "Mwanza", "gender": "FEMALE"},
    {"first": "Simwanza", "last": "Mweetwa", "gender": "MALE"},
    {"first": "Mubanga", "last": "Chibwe", "gender": "MALE"},
    {"first": "Kapasa", "last": "Musonda", "gender": "FEMALE"},
    {"first": "Bwalya", "last": "Zulu", "gender": "MALE"},
    {"first": "Nkonde", "last": "Mwale", "gender": "MALE"},
    {"first": "Chileshe", "last": "Kabwe", "gender": "FEMALE"},
    {"first": "Sikazwe", "last": "Mumba", "gender": "MALE"},
    {"first": "Mwape", "last": "Kunda", "gender": "FEMALE"},
    {"first": "Lombe", "last": "Mutambo", "gender": "FEMALE"},
    {"first": "Chisanga", "last": "Mwansa", "gender": "MALE"},
    {"first": "Kabamba", "last": "Chilenga", "gender": "FEMALE"},
    {"first": "Mwanza", "last": "Simwanza", "gender": "MALE"},
    {"first": "Mweetwa", "last": "Mubanga", "gender": "FEMALE"},
    {"first": "Chibwe", "last": "Kapasa", "gender": "MALE"},
    {"first": "Musonda", "last": "Chilufya", "gender": "MALE"},
    {"first": "Mutale", "last": "Mwila", "gender": "FEMALE"},
    {"first": "Kapembwa", "last": "Bwalya", "gender": "MALE"},
    {"first": "Chilufya", "last": "Mutale", "gender": "FEMALE"},
    {"first": "Zulu", "last": "Nkonde", "gender": "MALE"},
    {"first": "Mwale", "last": "Chileshe", "gender": "FEMALE"},
    {"first": "Kabwe", "last": "Sampa", "gender": "MALE"},
    {"first": "Chilala", "last": "Mubita", "gender": "FEMALE"},
    {"first": "Mubita", "last": "Namakando", "gender": "MALE"},
    {"first": "Tembo", "last": "Lungu", "gender": "MALE"},
    {"first": "Lungu", "last": "Phiri", "gender": "FEMALE"},
    {"first": "Phiri", "last": "Banda", "gender": "MALE"},
]


class Command(BaseCommand):
    help = "Seeds 50 users with authentic Zambian names, random districts, random statuses, and a shared password"

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            type=str,
            default="ZambiaTest123!",
            help="Shared password for all seeded users (default: ZambiaTest123!)",
        )

    def handle(self, *args, **options):
        password = options["password"]
        hashed_pw = hash_password(password)
        created = 0
        skipped = 0

        # Fetch available districts
        districts = list(District.objects.filter(is_active=True))
        if not districts:
            self.stdout.write(self.style.WARNING(
                "⚠️ No active districts found. Run your province/district seed first. Citizens will have district=NULL."
            ))

        # Realistic status distribution for testing
        possible_statuses = [
            CitizenStatus.PENDING,
            CitizenStatus.ACTIVE,
            CitizenStatus.REJECTED,
            CitizenStatus.SUSPENDED,
        ]

        self.stdout.write("🌍 Seeding 50 Zambian users with random districts & statuses...")

        with transaction.atomic():
            for i, profile in enumerate(ZAMBIAN_PROFILES, start=1):
                first = profile["first"]
                last = profile["last"]
                gender = profile["gender"]

                username = f"{first.lower()}.{last.lower()}{i}"
                email = f"{first.lower()}.{last.lower()}{i}@zambiatest.co.zm"

                # Idempotency guard
                if SystemUser.objects.filter(username=username).exists():
                    skipped += 1
                    continue

                # 1. Create SystemUser (bypasses OTP for testing)
                user = SystemUser.objects.create(
                    username=username,
                    email=email,
                    password=hashed_pw,
                    role=UserRole.CITIZEN,
                    is_active=True,
                    is_email_verified=True,
                    first_name=first,
                    last_name=last,
                )

                # 2. Generate realistic Citizen data
                dob = date.today() - timedelta(days=random.randint(6500, 23000))  # ~18 to 63 yrs
                age = (date.today() - dob).days // 365

                if age < 16:
                    citizen_type = "CHILD_UNDER_16"
                elif age < 18:
                    citizen_type = "CHILD_ABOVE_16"
                elif age >= 60:
                    citizen_type = "SENIOR"
                else:
                    citizen_type = "ADULT"

                nrc = f"{random.randint(100000, 999999)}/{random.randint(10, 99)}/{random.randint(1, 9)}"
                phone = f"+26097{random.randint(1000000, 9999999)}"
                city = random.choice(["Lusaka", "Ndola", "Kitwe", "Livingstone", "Kasama", "Chipata", "Mongu"])

                # Random district & status assignment
                assigned_district = random.choice(districts) if districts else None
                assigned_status = random.choice(possible_statuses)

                Citizen.objects.create(
                    user=user,
                    full_name=f"{first} {last}",
                    dob=dob,
                    gender=gender,
                    nrc=nrc,
                    phone=phone,
                    residential_address=f"Plot {random.randint(1, 999)}, {city}",
                    nationality="Zambian",
                    status=assigned_status,
                    language=Language.ENGLISH,
                    citizen_type=citizen_type,
                    district=assigned_district,
                    public_key="-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE_SEEDING_DUMMY_KEY\n-----END PUBLIC KEY-----",
                )
                created += 1

        self.stdout.write(self.style.SUCCESS(f"✅ Created {created} users."))
        if skipped:
            self.stdout.write(self.style.WARNING(f"⏭️  Skipped {skipped} existing users."))
        self.stdout.write(self.style.SUCCESS(f"🔑 Shared Password: {password}"))
        self.stdout.write(self.style.SUCCESS("📝 Districts & statuses assigned randomly. Ready for testing."))