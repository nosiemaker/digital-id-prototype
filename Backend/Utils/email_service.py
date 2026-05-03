
import logging
from django.core.mail import send_mail
from django.conf import settings
from admin_ops.models import SystemUser, UserRole

logger = logging.getLogger(__name__)

def _send_email(subject, message, recipient_list):
    """Internal helper to send email and handle errors."""
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipient_list,
            fail_silently=False,
        )
        logger.info(f"Email sent successfully: {subject} to {recipient_list}")
    except Exception as e:
        logger.error(f"Failed to send email '{subject}' to {recipient_list}: {str(e)}")

def send_account_verified_email(user: SystemUser):
    """Notify user that their account is verified and prompt them to complete their profile."""
    subject = "Welcome to ZAMREN Digital ID - Account Verified"
    message = f"""
Hello {user.first_name or 'there'},

Your email address has been successfully verified! 

Your ZAMREN Digital ID account is now active. To unlock the full power of your digital identity and access government services online, you must now complete your identity registration.

What to do next:
1. Log in to your wallet.
2. Click on "Complete Your Registration".
3. Upload your NRC and other details.

Thank you for joining the digital transformation of Zambia.

Regards,
ZAMREN Digital ID Team
    """
    _send_email(subject, message, [user.email])

def send_identity_submitted_email(user: SystemUser):
    """Notify user that their identity submission is received."""
    subject = "Identity Registration Submitted - Pending Review"
    message = f"""
Hello {user.first_name},

Thank you for submitting your identity registration details to the ZAMREN Digital ID system.

Your application is now being reviewed by a Registration Officer. Once reviewed, you will receive an email notification regarding the status of your enrollment.

If your application is approved, you will be assigned your official Digital Identification Number (DIN).

Regards,
ZAMREN Digital ID Team
    """
    _send_email(subject, message, [user.email])

def notify_officers_of_pending_review(citizen_name: str):
    """Notify all Registration Officers that a new submission is pending."""
    officers = SystemUser.objects.filter(role=UserRole.REGISTRATION_OFFICER, is_active=True)
    recipient_list = [o.email for o in officers if o.email]
    
    if not recipient_list:
        logger.warning("No Registration Officers found to notify.")
        return

    subject = "New Identity Registration Pending Review"
    message = f"""
Attention Registration Officer,

A new identity registration request has been submitted by {citizen_name} and is now pending your review.

Please log in to the Officer Portal to review the documents and process the enrollment.

Portal Link: http://localhost:3000/officer/dashboard

Regards,
ZDID System Automator
    """
    _send_email(subject, message, recipient_list)

def send_enrollment_approved_email(user: SystemUser, din: str):
    """Notify user that their enrollment was approved."""
    subject = "ZAMREN Digital ID - Enrollment Approved!"
    message = f"""
Congratulations {user.first_name},

Your identity registration has been APPROVED by the Registration Office.

Your official Digital Identification Number (DIN) has been issued:
DIN: {din}

You can now view your Digital ID card in your wallet and use it to access online services.

Regards,
ZAMREN Digital ID Team
    """
    _send_email(subject, message, [user.email])

def send_enrollment_rejected_email(user: SystemUser, reason: str):
    """Notify user that their enrollment was rejected."""
    subject = "ZAMREN Digital ID - Enrollment Update"
    message = f"""
Hello {user.first_name},

We have reviewed your identity registration request. Unfortunately, your enrollment could not be approved at this time.

Reason for Rejection:
{reason}

Please log in to your account, correct the issues mentioned above, and resubmit your application for review.

Regards,
ZAMREN Digital ID Team
    """
    _send_email(subject, message, [user.email])
