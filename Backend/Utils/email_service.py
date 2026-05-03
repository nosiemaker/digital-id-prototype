
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

# --- Third-Party Institution Notifications ---

def send_third_party_registration_confirmation(institution_name: str, email: str):
    """Notify the third party that their application is received."""
    subject = "Institutional Partnership Application Received - ZDID"
    message = f"""
Hello {institution_name},

Thank you for applying to become a Trusted Service Partner with the Zambia Digital Identity System (ZDID).

Your application has been received and is currently under review by our registration team. We will verify your institutional details and data security compliance.

What happens next?
- Our team will review your application within 3-5 business days.
- You will receive another email once your account has been approved and activated.

Thank you for your patience.

Regards,
ZDID Institutional Programme Team
    """
    _send_email(subject, message, [email])

def notify_officers_of_third_party_pending(institution_name: str):
    """Notify all Registration Officers of a new institution application."""
    officers = SystemUser.objects.filter(role=UserRole.REGISTRATION_OFFICER, is_active=True)
    recipient_list = [o.email for o in officers if o.email]
    
    if not recipient_list:
        return

    subject = "ACTION REQUIRED: New Third-Party Institution Application"
    message = f"""
Attention Registration Officer,

A new institutional partnership application has been submitted by:
Institution: {institution_name}

This application requires your review and verification. Please log in to the Admin Dashboard to process this request.

Regards,
ZDID System Automator
    """
    _send_email(subject, message, recipient_list)

def send_third_party_approval_email(institution_name: str, email: str, institution_id: str):
    """Notify the third party that they are approved."""
    subject = "Institutional Partnership APPROVED - ZDID"
    message = f"""
Congratulations {institution_name},

We are pleased to inform you that your application for the ZDID Institutional Programme has been APPROVED.

Your account is now active. You can log in to the Partner Portal using your registered email and the password you set during registration.

Your official Institution ID: {institution_id}

You can now:
1. Access the Institutional Dashboard.
2. Manage your API Keys.
3. Start initiating identity verification requests.

Welcome to the network!

Regards,
ZDID Institutional Programme Team
    """
    _send_email(subject, message, [email])
