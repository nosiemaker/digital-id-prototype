
import os
import django
from django.conf import settings

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zdid_core.settings')
django.setup()

from citizens.models import Citizen
from registration.models import EnrollmentRequest

def check_enrollments():
    enrollments = EnrollmentRequest.objects.all().order_by('-submitted_at')[:5]
    print(f"{'ID':<5} | {'Citizen Name':<20} | {'Has User':<8} | {'User Email':<25}")
    print("-" * 65)
    for e in enrollments:
        citizen = e.citizen
        has_user = citizen.user is not None
        email = citizen.user.email if has_user else "N/A"
        print(f"{e.id:<5} | {citizen.full_name:<20} | {str(has_user):<8} | {email:<25}")

if __name__ == "__main__":
    check_enrollments()
