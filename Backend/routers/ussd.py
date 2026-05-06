"""
USSD Router
==========
Handles USSD sessions via Africa's Talking API.

Request format (from Africa's Talking):
    {
        "sessionId": "session123",
        "serviceCode": "*123#",
        "phoneNumber": "+260971234567",
        "text": "1"  # User's input
    }

Response format (to Africa's Talking):
    CON <message>  # Continue session
    END <message>  # End session

Menu Flow:
    1. Main Menu:
       - 1. Register (new users)
       - 2. Login (existing users, enter password)
    
    2. Register Flow (matches mobile registration):
       - Enter NRC
       - Enter Full Name
       - Enter DOB (format YYYYMMDD)
       - Enter Gender (1=Male, 2=Female)
       - Enter District
       - Enter password (4 digits)
       - Confirm password
       - Success message (pending RO approval)
    
    3. Login Flow:
       - Enter password
       - Show: Name, DIN, Status (or pending message if no DIN yet)
"""

from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse
from typing import Optional, Dict, Any
import hashlib
import logging
from datetime import datetime
from asgiref.sync import sync_to_async

from admin_ops.models import UssdUser
from citizens.models import Citizen, CitizenStatus, District
from registration.models import EnrollmentRequest, EnrollmentStatus

router = APIRouter(tags=["ussd"])


# =============================================================================
# SESSION STATE MANAGEMENT
# =============================================================================
ussd_sessions: Dict[str, dict] = {}

# Session states
STATE_MAIN_MENU = "MAIN_MENU"
STATE_REGISTER_NRC = "REGISTER_NRC"
STATE_REGISTER_NAME = "REGISTER_NAME"
STATE_REGISTER_DOB = "REGISTER_DOB"
STATE_REGISTER_GENDER = "REGISTER_GENDER"
STATE_REGISTER_DISTRICT = "REGISTER_DISTRICT"
STATE_REGISTER_PASSWORD = "REGISTER_PASSWORD"
STATE_REGISTER_CONFIRM = "REGISTER_CONFIRM"
STATE_LOGIN_PASSWORD = "LOGIN_PASSWORD"
STATE_USER_MENU = "USER_MENU"


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def hash_password(password: str) -> str:
    """Hash password using SHA256."""
    return hashlib.sha256(password.encode()).hexdigest()


def normalize_phone(phone: str) -> str:
    """Normalize phone number to +260 format."""
    phone = phone.strip().replace(" ", "")
    if phone.startswith("0"):
        return "+260" + phone[1:]
    elif phone.startswith("260"):
        return "+" + phone
    return phone


def get_or_create_session(session_id: str, phone: str) -> dict:
    """Get or create a session."""
    if session_id not in ussd_sessions:
        ussd_sessions[session_id] = {
            "state": STATE_MAIN_MENU,
            "phone": normalize_phone(phone),
            "data": {}
        }
    else:
        if not ussd_sessions[session_id].get("phone"):
            ussd_sessions[session_id]["phone"] = normalize_phone(phone)
    return ussd_sessions[session_id]


def clear_session(session_id: str):
    """Clear a session."""
    if session_id in ussd_sessions:
        del ussd_sessions[session_id]


def get_session_id(session: dict) -> str:
    """Get session ID from session dict (hacky but needed for clear_session)."""
    for sid, sess in ussd_sessions.items():
        if sess is session:
            return sid
    return ""


# =============================================================================
# USSD ENDPOINT
# =============================================================================

@router.post("/ussd")
async def handle_ussd(request: Request):
    """Main USSD handler - accepts both JSON and form-data from Africa's Talking."""
    import logging
    logger = logging.getLogger(__name__)
    
    # Log raw request details for debugging
    logger.info(f"USSD request received - Content-Type: {request.headers.get('content-type')}")
    
    # Parse the body - Africa's Talking sends form-urlencoded
    content_type = request.headers.get("content-type", "")
    
    data = {}
    if "application/x-www-form-urlencoded" in content_type:
        form_data = await request.form()
        data = dict(form_data)
        logger.info(f"Form data received: {data}")
    elif "application/json" in content_type:
        data = await request.json()
        logger.info(f"JSON data received: {data}")
    else:
        # Try both
        try:
            body = await request.body()
            logger.info(f"Raw body: {body}")
            data = await request.json()
        except Exception:
            try:
                form_data = await request.form()
                data = dict(form_data)
            except Exception as e:
                logger.error(f"Failed to parse request: {e}")
                return PlainTextResponse(content="END Session error. Please try again.")
    
    logger.info(f"Parsed data: {data}")
    
    # Extract fields (handle both camelCase and snake_case)
    session_id = data.get("sessionId", data.get("session_id", ""))
    phone = data.get("phoneNumber", data.get("phone_number", ""))
    text = data.get("text", "")
    
    if not session_id or not phone:
        logger.warning(f"Missing required fields: sessionId={session_id}, phoneNumber={phone}")
        return PlainTextResponse(content="END Session error. Please dial *123# to try again.")
    
    session = get_or_create_session(session_id, phone)
    state = session.get("state", STATE_MAIN_MENU)
    session_data_keys = list(session.get("data", {}).keys())
    
    logger.info(f"Session state={state}, data_keys={session_data_keys}, text='{text}'")
    
    input_levels = text.split("*") if text else []
    current_input = input_levels[-1] if input_levels else ""
    
    try:
        from django.db import close_old_connections, DatabaseError
        close_old_connections()
        return await sync_to_async(process_ussd)(session, state, current_input, input_levels, phone, session_id, logger)
    except (DatabaseError, Exception) as e:
        logger.error(f"USSD processing error: {e}", exc_info=True)
        close_old_connections()
        return PlainTextResponse(content="END A system error occurred. Please try again later.")


def process_ussd(session: dict, state: str, current_input: str, input_levels: list, phone: str, session_id: str, logger=None):
    """Process USSD based on current state."""
    from django.db import close_old_connections, OperationalError
    import time
    
    if logger is None:
        logger = logging.getLogger(__name__)
    
    def db_with_retry(func, max_retries=1):
        """Execute DB operation with retry on connection errors."""
        for attempt in range(max_retries + 1):
            try:
                close_old_connections()
                return func()
            except OperationalError as e:
                if attempt < max_retries:
                    logger = logging.getLogger(__name__)
                    logger.warning(f"DB connection error (attempt {attempt+1}), retrying...")
                    time.sleep(0.2)
                else:
                    raise
    
    # ===================================================================
    # MAIN MENU STATE
    # ===================================================================
    if state == STATE_MAIN_MENU:
        if not current_input or current_input == "":
            response = "CON Welcome to Digital ID Zambia\n"
            response += "1. Register (New User)\n"
            response += "2. Login (Existing User)"
            session["state"] = STATE_MAIN_MENU
            return PlainTextResponse(content=response)
        
        elif current_input == "1":
            session["state"] = STATE_REGISTER_NRC
            session["data"] = {}
            response = "CON Enter your NRC number (e.g., 123456/78/1):"
            return PlainTextResponse(content=response)
        
        elif current_input == "2":
            session["state"] = STATE_LOGIN_PASSWORD
            response = "CON Enter your password:"
            return PlainTextResponse(content=response)
        
        else:
            response = "END Invalid option. Please dial *123# and try again."
            clear_session(session_id)
            return PlainTextResponse(content=response)
    
    # ===================================================================
    # REGISTER: NRC INPUT
    # ===================================================================
    elif state == STATE_REGISTER_NRC:
        nrc = current_input.strip()
        
        if not nrc:
            response = "CON Enter your NRC number (e.g., 123456/78/1):"
            return PlainTextResponse(content=response)
        
        if len(nrc) < 5:
            response = "CON Invalid NRC. Please enter a valid NRC number:"
            return PlainTextResponse(content=response)
        
        # Check if NRC already exists in any Citizen
        if db_with_retry(lambda: Citizen.objects.filter(nrc=nrc).exists()):
            response = "END NRC already registered. Please login instead."
            clear_session(session_id)
            return PlainTextResponse(content=response)
        
        # Check if NRC already in enrollment request
        if db_with_retry(lambda: EnrollmentRequest.objects.filter(citizen__nrc=nrc).exists()):
            response = "END NRC already has a pending request. Please contact the registration office."
            clear_session(session_id)
            return PlainTextResponse(content=response)
        
        # Check if already has USSD account with this NRC
        if db_with_retry(lambda: UssdUser.objects.filter(citizen__nrc=nrc).exists()):
            response = "END You already have a USSD account. Please login."
            clear_session(session_id)
            return PlainTextResponse(content=response)
        
        # Store NRC and proceed to name
        session["state"] = STATE_REGISTER_NAME
        session["data"]["nrc"] = nrc
        
        response = "CON Enter your FULL NAME:"
        return PlainTextResponse(content=response)
    
    # ===================================================================
    # REGISTER: FULL NAME INPUT
    # ===================================================================
    elif state == STATE_REGISTER_NAME:
        full_name = current_input.strip()
        
        if not full_name or len(full_name) < 3:
            response = "CON Invalid name. Please enter your full name:"
            return PlainTextResponse(content=response)
        
        # Store name and proceed to DOB
        session["state"] = STATE_REGISTER_DOB
        session["data"]["full_name"] = full_name
        
        response = "CON Enter your DATE OF BIRTH (YYYYMMDD):\ne.g., 19900315 for 15 March 1990"
        return PlainTextResponse(content=response)
    
    # ===================================================================
    # REGISTER: DOB INPUT
    # ===================================================================
    elif state == STATE_REGISTER_DOB:
        dob_str = current_input.strip()
        
        if len(dob_str) != 8 or not dob_str.isdigit():
            response = "CON Invalid format. Enter DOB as YYYYMMDD:"
            return PlainTextResponse(content=response)
        
        try:
            dob = datetime.strptime(dob_str, "%Y%m%d").date()
        except ValueError:
            response = "CON Invalid date. Enter DOB as YYYYMMDD:"
            return PlainTextResponse(content=response)
        
        # Store DOB and proceed to gender
        session["state"] = STATE_REGISTER_GENDER
        session["data"]["dob"] = dob.isoformat()
        
        response = "CON Select Gender:\n1. Male\n2. Female"
        return PlainTextResponse(content=response)
    
    # ===================================================================
    # REGISTER: GENDER INPUT
    # ===================================================================
    elif state == STATE_REGISTER_GENDER:
        gender = current_input.strip()
        
        if gender == "1":
            gender_value = "MALE"
        elif gender == "2":
            gender_value = "FEMALE"
        else:
            response = "CON Invalid. Select:\n1. Male\n2. Female"
            return PlainTextResponse(content=response)
        
        # Store gender and proceed to district
        session["state"] = STATE_REGISTER_DISTRICT
        session["data"]["gender"] = gender_value
        
        response = "CON Enter your District:\ne.g., Lusaka, Kitwe, Ndola"
        return PlainTextResponse(content=response)
    
    # ===================================================================
    # REGISTER: DISTRICT INPUT
    # ===================================================================
    elif state == STATE_REGISTER_DISTRICT:
        district_name = current_input.strip()
        
        if not district_name:
            response = "CON Enter your District:"
            return PlainTextResponse(content=response)
        
        try:
            district = db_with_retry(lambda: District.objects.filter(
                name__iexact=district_name, 
                is_active=True
            ).first())
            
            if not district:
                session["data"]["district"] = None
            else:
                session["data"]["district"] = district
            
            logger.info(f"District lookup for '{district_name}': found={district is not None}")
            
        except Exception as e:
            logger.error(f"District lookup error: {e}")
            session["data"]["district"] = None
        
        session["state"] = STATE_REGISTER_PASSWORD
        response = "CON Create a 4-digit password:"
        return PlainTextResponse(content=response)
    
    # ===================================================================
    # REGISTER: PASSWORD INPUT
    # ===================================================================
    elif state == STATE_REGISTER_PASSWORD:
        password = current_input.strip()
        
        if not password.isdigit() or len(password) != 4:
            response = "CON Password must be 4 digits. Please enter again:"
            return PlainTextResponse(content=response)
        
        session["state"] = STATE_REGISTER_CONFIRM
        session["data"]["password"] = hash_password(password)
        
        response = "CON Confirm your 4-digit password:"
        return PlainTextResponse(content=response)
    
    # ===================================================================
    # REGISTER: CONFIRM PASSWORD & CREATE RECORDS
    # ===================================================================
    elif state == STATE_REGISTER_CONFIRM:
        confirm_password = current_input.strip()
        
        if not confirm_password.isdigit() or len(confirm_password) != 4:
            response = "CON Password must be 4 digits. Please enter again:"
            return PlainTextResponse(content=response)
        
        stored_hash = session["data"].get("password")
        confirm_hash = hash_password(confirm_password)
        
        if stored_hash != confirm_hash:
            response = "CON Passwords do not match. Please enter a new 4-digit password:"
            session["state"] = STATE_REGISTER_PASSWORD
            session["data"].pop("password", None)
            return PlainTextResponse(content=response)
        
        # Get stored data
        data = session["data"]
        nrc = data.get("nrc", "")
        full_name = data.get("full_name", "")
        dob = data.get("dob", "")
        gender = data.get("gender", "MALE")
        district = data.get("district")
        
        try:
            # Derive citizen_type from age
            dob_date = datetime.strptime(dob, "%Y-%m-%d").date()
            age = (datetime.now().date() - dob_date).days // 365
            if age < 16:
                citizen_type = "CHILD_UNDER_16"
            elif age < 18:
                citizen_type = "CHILD_ABOVE_16"
            elif age >= 60:
                citizen_type = "SENIOR"
            else:
                citizen_type = "ADULT"
            
            # 1. Create Citizen (PENDING, no DIN)
            citizen = db_with_retry(lambda: Citizen.objects.create(
                nrc=nrc,
                full_name=full_name,
                dob=dob_date,
                phone=phone,
                gender=gender,
                district=district,
                status=CitizenStatus.PENDING,
                citizen_type=citizen_type,
            ))
            
            # 2. Create EnrollmentRequest (PENDING)
            enrollment = db_with_retry(lambda: EnrollmentRequest.objects.create(
                citizen=citizen,
                status=EnrollmentStatus.PENDING,
            ))
            
            # 3. Create UssdUser (for USSD login)
            ussd_user = db_with_retry(lambda: UssdUser.objects.create(
                phone=phone,
                password_hash=stored_hash,
                citizen=citizen
            ))
            
            response = "END Registration Submitted!\n"
            response += f"Name: {full_name}\n"
            response += f"NRC: {nrc}\n\n"
            response += "Your request is pending RO approval.\n"
            response += "You will receive your DIN once approved.\n"
            response += "Dial *123# to check status."
            
            clear_session(session_id)
            return PlainTextResponse(content=response)
            
        except Exception as e:
            response = f"END Error: {str(e)}. Please try again later."
            clear_session(session_id)
            return PlainTextResponse(content=response)
    
    # ===================================================================
    # LOGIN: PASSWORD INPUT
    # ===================================================================
    elif state == STATE_LOGIN_PASSWORD:
        password = current_input.strip()
        
        if not password:
            response = "CON Enter your password:"
            return PlainTextResponse(content=response)
        
        # Lookup user by phone with citizen pre-loaded (single query)
        ussd_user = db_with_retry(lambda: UssdUser.objects.filter(
            phone=phone, is_active=True
        ).select_related('citizen').first())
        
        if not ussd_user:
            response = "END No account found. Please register first."
            clear_session(session_id)
            return PlainTextResponse(content=response)
        
        # Validate password
        input_hash = hash_password(password)
        if ussd_user.password_hash != input_hash:
            response = "END Incorrect password. Please try again."
            clear_session(session_id)
            return PlainTextResponse(content=response)
        
        # Login successful - show menu
        session["state"] = STATE_USER_MENU
        session["data"] = {}
        response = "CON Login Successful!\n1. View Personal Details\n2. Exit"
        return PlainTextResponse(content=response)
    
    # ===================================================================
    # USER MENU (Post-login)
    # ===================================================================
    elif state == STATE_USER_MENU:
        if current_input == "1":
            citizen = db_with_retry(lambda: UssdUser.objects.filter(
                phone=phone, is_active=True
            ).select_related('citizen', 'citizen__district').first())
            
            if not citizen:
                response = "END Session expired. Please dial *123# again."
                clear_session(session_id)
                return PlainTextResponse(content=response)
            
            c = citizen.citizen
            response = f"END Personal Details\n"
            response += f"DIN: {c.din or 'N/A'}\n"
            response += f"Name: {c.full_name}\n"
            response += f"NRC: {c.nrc or 'N/A'}\n"
            response += f"DOB: {c.dob}\n"
            response += f"Gender: {c.gender}\n"
            response += f"Phone: {c.phone}\n"
            if hasattr(c, 'district') and c.district:
                response += f"District: {c.district.name}\n"
            response += f"Status: {c.status}"
            clear_session(session_id)
            return PlainTextResponse(content=response)
        else:
            response = "END Thank you for using Digital ID Zambia. Goodbye!"
            clear_session(session_id)
            return PlainTextResponse(content=response)
    
    # ===================================================================
    # UNKNOWN STATE
    # ===================================================================
    else:
        response = "END Session expired. Please dial *123# to start again."
        clear_session(session_id)
        return PlainTextResponse(content=response)


@router.get("/ussd/health")
async def ussd_health():
    """Health check for USSD endpoint."""
    return {"status": "ok", "service": "USSD"}