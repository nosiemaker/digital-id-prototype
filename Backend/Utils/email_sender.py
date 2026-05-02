"""
utils/email_sender.py — Non-blocking staff credential emails
Uses threading to avoid blocking FastAPI's async event loop or Django's sync services.
"""
import threading
import logging
import smtplib
import sys
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Ensure logs show up in your terminal
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

def send_staff_credentials_email(to_email: str, employee_id: str, temp_password: str) -> None:
    """Sends welcome credentials in a background thread."""
    def _send():
        try:
            msg = MIMEMultipart()
            msg['From'] = "noreply@zdid.gov.zm"
            msg['To'] = to_email
            msg['Subject'] = "Your ZDID Staff Account Credentials"

            body = f"""
            Welcome to the ZDID Civil Registration System.
            
            Your staff account has been created by the Registrar.
            
            🔑 Employee ID: {employee_id}
            🔒 Temporary Password: {temp_password}
            
            Please log in and change your password immediately.
            This email was sent automatically. Do not reply.
            """
            msg.attach(MIMEText(body, 'plain'))

            # --- TERMINAL DISPLAY (Current Mode) ---
            print("\n" + "="*50)
            print(f"DEBUG: Outgoing Email to {to_email}")
            print(body)
            print("="*50 + "\n")

            # --- GOOGLE SMTP SETUP (Commented out for later use) ---
            # To use this, you must generate an "App Password" in your Google Account settings.
            # 1. Host: smtp.gmail.com
            # 2. Port: 587

            # with smtplib.SMTP('smtp.gmail.com', 587) as server:
            #     server.starttls()  # Upgrade connection to secure
            #     server.login('your-email@gmail.com', 'your-app-specific-password')
            #     server.send_message(msg)

            logger.info(f"✅ Credentials email processed for {to_email}")
        except Exception as e:
            logger.error(f"❌ Failed to send email to {to_email}: {e}")

    threading.Thread(target=_send, daemon=True).start()