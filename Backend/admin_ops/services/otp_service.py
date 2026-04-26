
import secrets
import logging
from datetime import datetime, timedelta, timezone
from django.contrib.auth.hashers import make_password, check_password
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


def _deliver_otp_console(email: str, otp: str) -> None:
    """
    Prototype delivery: log the OTP to the console.
    Replace with real email sending before going to production.

    Example production swap (SendGrid):
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        sg = SendGridAPIClient(api_key=settings.SENDGRID_KEY)
        msg = Mail(from_email="noreply@zdid.gov.zm",
                   to_emails=email,
                   subject="Your ZDID Verification Code",
                   plain_text_content=f"Your code is: {otp}")
        sg.send(msg)
    """
    border = "=" * 50
    logger.info(border)
    logger.info(f"  📧  OTP EMAIL (dev mode — not sent)")
    logger.info(f"  To : {email}")
    logger.info(f"  Code: {otp}")
    logger.info(f"  Expires in {OTP_TTL_MINUTES} minutes")
    logger.info(border)
    # Also print to stdout so it's visible without log config:
    print(f"\n{border}")
    print(f"  OTP for {email}:  {otp}  (expires {OTP_TTL_MINUTES} min)")
    print(f"{border}\n")


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

    _deliver_otp_console(user.email, raw_otp)

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
