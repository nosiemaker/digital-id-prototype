
import secrets
import logging
from datetime import datetime, timedelta, timezone
from django.contrib.auth.hashers import make_password, check_password
from django.core.mail import send_mail
from django.conf import settings
from fastapi import HTTPException, status
from admin_ops.models import SystemUser
from Utils.audit_logger import audit

logger = logging.getLogger(__name__)

OTP_TTL_MINUTES = 10

def _generate_otp() -> str:
    """Return a zero-padded 6-digit code using a CSPRNG."""
    return f"{secrets.randbelow(1_000_000):06d}"

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _deliver_otp_email(email: str, otp: str) -> None:
    """
    Delivers the OTP via email using Django's send_mail.
    """
    subject = "Your ZAMREN Digital ID Verification Code"
    message = f"""
Hello,

Your verification code for the ZAMREN Digital ID system is:

{otp}

This code will expire in {OTP_TTL_MINUTES} minutes.

If you did not request this code, please ignore this email.

Regards,
ZAMREN Digital ID Team
    """
    
    # Also log to console for development visibility
    border = "=" * 50
    print(f"\n{border}")
    print(f"  📧  OTP EMAIL SENT TO: {email}")
    print(f"  Code: {otp}")
    print(f"{border}\n")

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
    except Exception as e:
        logger.error(f"Failed to send OTP email to {email}: {str(e)}")
        # In development, we might not want to crash if email fails, 
        # but in production this should be handled carefully.
        # For now, we log and continue if in debug, but here we just log.



# ===== Public API ======

def issue_otp(user: SystemUser) -> None:
    """
    Generate a fresh OTP, store its hash on the user, and deliver it.

    We store a HASH of the OTP rather than plaintext so that even if
    the system_users table is compromised the codes cannot be replayed
    without brute-forcing the hash (bcrypt rounds make this expensive).

    Called after account creation and from resend-otp.
    """
    raw_otp = _generate_otp()
    expires_at = _now_utc() + timedelta(minutes=OTP_TTL_MINUTES)

    # Hash the OTP before storing (Django's make_password uses PBKDF2/bcrypt)
    user.otp_code = make_password(raw_otp)
    user.otp_expires_at = expires_at
    user.is_email_verified = False
    user.save(update_fields=["otp_code", "otp_expires_at", "is_email_verified"])

    _deliver_otp_email(user.email, raw_otp)

    audit.alog(
        actor_id=user.id,
        actor_role=user.role,
        action="OTP_ISSUED",
        target_type="SYSTEM_USER",
        target_id=user.id,
        meta={"email": user.email}
    )


def verify_otp(email: str, raw_otp: str) -> SystemUser:
    """
    Verify the OTP for the given email.

    Raises HTTPException on:
      • Unknown email
      • Already verified
      • No OTP issued
      • Expired OTP
      • Invalid OTP

    Returns the SystemUser on success and clears the OTP fields.
    """
    try:
        user = SystemUser.objects.get(email=email)
    except SystemUser.DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with that email address.",
        )

    if user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already verified.",
        )

    if not user.otp_code or not user.otp_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No OTP has been issued for this account. Request a new one.",
        )

    if _now_utc() > user.otp_expires_at.replace(tzinfo=timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=f"OTP has expired. Please request a new code.",
        )

    if not check_password(raw_otp, user.otp_code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP. Please check the code and try again.",
        )

    # ── Success: mark verified and clear the OTP fields ───────────────────
    user.is_email_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    user.is_active = True
    user.save(update_fields=["is_email_verified", "otp_code", "otp_expires_at", "is_active"])

    audit.alog(
        actor_id=user.id,
        actor_role=user.role,
        action="OTP_ISSUED",
        target_type="SYSTEM_USER",
        target_id=user.id,
        meta={"email": user.email}
    )

    return user
