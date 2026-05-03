
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

def send_notice_of_death_link_email(informant_email: str, informant_name: str, death_record_id: int, base_url: str = 'http://localhost:3000'):
    """
    Send the informant a secure link to submit the Notice of Death form.
    Called automatically after a Health Worker submits the MCCD.
    """
    url = settings.FRONTEND_URL or base_url
    subject = "Action Required: Submit Notice of Death Form"
    submission_url = f"{url}/submit-notice/{death_record_id}"

    message = f"""
    Hello {informant_name or 'there'},

    A Medical Certificate of Cause of Death (MCCD) has been submitted for your case.
    To complete the death registration process, you are required to submit the Notice of Death form.

    Please click the link below to access and complete the form:
    {submission_url}

    This link is unique to your case reference. Please complete the form at your earliest convenience so the Registrar can process the documentation.

    Regards,
    ZAMREN Digital ID Team
    """
    _send_email(subject, message, [informant_email])

def send_partner_link_email(citizen_name: str, citizen_email: str, partner_name: str, permitted_scopes: list):
    """Notify the citizen that their account has been linked to a partner."""
    subject = f"ZAMREN Digital ID - Account Linked to {partner_name}"
    
    scopes_formatted = "\n".join([f"- {scope.replace('_', ' ').title()}" for scope in permitted_scopes])
    if not scopes_formatted:
        scopes_formatted = "- Basic Identity Verification"
        
    message = f"""
Hello {citizen_name},

This email is to confirm that your ZAMREN Digital ID has been successfully linked to:
**{partner_name}**

By linking your account, you allow this partner to request identity verification. When you use their services, they may request access to the following details from your profile:

{scopes_formatted}

Please note: Linking an account does not share your data immediately. It establishes a secure connection so you can choose what to share when you use their specific services.

If you did not authorize this action, please log in to your Digital ID Wallet immediately and unlink the partner from the 'Partners' tab.

Regards,
ZAMREN Digital ID Team
    """
    _send_email(subject, message, [citizen_email])