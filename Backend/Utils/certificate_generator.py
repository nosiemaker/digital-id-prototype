"""
certificate_generator.py
━━━━━━━━━━━━━━━━━━━━━━━━
Zambia Digital ID System — Civil Registration Module
Generates official birth certificates as PDFs by overlaying
citizen data onto the Reg-Gen Form No. IV (Rule 5) template.

Dependencies:
    pip install Pillow qrcode reportlab

Usage:
    from certificate_generator import generate_certificate

    cert_no, vhash = generate_certificate(citizen_data, "output.pdf")
"""

from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
import qrcode
import hashlib
import uuid
from datetime import datetime
from io import BytesIO
 

# ── Configuration ──────────────────────────────────────────────────────────

TEMPLATE_PATH = r"C:\Users\LENOVO\Downloads\Birth Certificate Template.png"
VERIFY_BASE_URL  = "https://zdid.gov.zm/verify/birth"
FONT_REGULAR = "C:\\Windows\\Fonts\\arial.ttf" 
FONT_BOLD    = "C:\\Windows\\Fonts\\arialbd.ttf"
FONT_SIZE        = 20
FONT_SIZE_SERIAL = 22
FONT_SIZE_TINY   = 11

# Template dimensions: 864 × 1212 px
# All (x, y) coordinates calibrated to this resolution.
# If you change the template image, re-calibrate these values.

# Calibrated for 864 x 1212 px resolution
# Text is shifted up slightly (y-axis) to rest neatly on the dotted baselines.

FIELD_COORDS = {
    # (x, y) — top-left corner where the field VALUE is written
    "serial_number"        : (710, 135),   # Nº ______ (top right)
    
    # --- Block 1: Core Details (30px line height) ---
    "reg_no"               : (115, 350),   # No::
    "district"             : (430, 350),   # District:
    "date_of_birth"        : (210, 380),   # Date of Birth:
    "sex"                  : (600, 380),   # Sex:
    "place_of_birth"       : (210, 410),   # Place of Birth:
    "surname"              : (245, 440),   # Surname of Child:
    "other_names"          : (205, 470),   # Other Names:
    
    # --- Block 2: Father's Details ---
    "father_name"          : (320, 500),   # Names and Surname of Father:
    "father_occupation"    : (255, 530),   # Occupation of Father:
    "father_nssf"          : (400, 560),   # Father's Social Security Scheme Number:
    "father_nationality"   : (250, 590),   # Father's Nationality:
    "father_nid"           : (300, 620),   # Father's National Identity No.:
    
    # --- Block 3: Mother's Details ---
    "mother_name"          : (320, 650),   # Name and Surname of Mother:
    "mother_maiden"        : (285, 680),   # Mother's Maiden Surname:
    "mother_nssf"          : (400, 710),   # Mother's Social Security Scheme Number:
    "mother_nationality"   : (250, 740),   # Mother's Nationality:
    "mother_nid"           : (300, 770),   # Mother's National Identity No.:
    
    # --- Block 4: Informant & Addresses ---
    "informant_name"       : (250, 800),   # Name of Informant:
    "informant_address"    : (315, 830),   # Informant's Residential Address:
    # (Blank dotted line skipped at y=860)
    "postal_address"       : (210, 890),   # Postal Address:
    # (Blank dotted line skipped at y=920)
    
    # --- Block 5: Registration Details ---
    "date_of_registration" : (245, 950),   # Date of Registration:
    "registrar_name"       : (235, 980),   # Name of Registrar:
    
    # --- Block 6: Footer Dates ---
    "dated_day"            : (285, 1060),  # Dated this ___
    "dated_month"          : (445, 1060),  # day of ___
    "dated_year"           : (655, 1060),  # , 20__
    
    # --- Block 7: System Appends ---
    "qr_code"              : (60,  1090),  # QR code paste position
    "verify_code"          : (60,  1195),  # Verification hash (tiny text)
}

QR_SIZE = 100  # pixels


# ── Internal helpers ───────────────────────────────────────────────────────

def _load_fonts():
    """Load DejaVu fonts with graceful fallback."""
    try:
        return (
            ImageFont.truetype(FONT_REGULAR, FONT_SIZE),
            ImageFont.truetype(FONT_BOLD,    FONT_SIZE),
            ImageFont.truetype(FONT_BOLD,    FONT_SIZE_SERIAL),
            ImageFont.truetype(FONT_REGULAR, FONT_SIZE_TINY),
        )
    except OSError:
        default = ImageFont.load_default()
        return default, default, default, default


def _generate_cert_number() -> str:
    """Generate a unique ZMB-prefixed certificate number."""
    return "ZMB" + str(uuid.uuid4().int)[:10]


def _generate_hash(data: dict, cert_no: str) -> str:
    """Generate a SHA-256 verification hash for the certificate."""
    raw = f"{cert_no}{data.get('surname', '')}{data.get('date_of_birth', '')}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16].upper()


def _make_qr(cert_no: str, vhash: str) -> Image.Image:
    """Generate a QR code pointing to the verification endpoint."""
    url = f"{VERIFY_BASE_URL}/{cert_no}?h={vhash}"
    qr  = qrcode.QRCode(version=1, box_size=3, border=1)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    return img.resize((QR_SIZE, QR_SIZE), Image.LANCZOS)


def _write_field(draw, key, value, font, fill=(10, 10, 10)):
    """Write a value at the coordinate mapped to the given field key."""
    if key in FIELD_COORDS:
        draw.text(FIELD_COORDS[key], str(value), font=font, fill=fill)


# ── Public API ─────────────────────────────────────────────────────────────

def generate_certificate(citizen_data: dict, output_pdf: str) -> tuple[str, str]:
    """
    Generate a birth certificate PDF.

    Parameters
    ----------
    citizen_data : dict
        Keys (all optional — defaults to empty string or 'NIL'):
            reg_no, district, date_of_birth, sex, place_of_birth,
            surname, other_names, father_name, father_occupation,
            father_nssf, father_nationality, father_nid,
            mother_name, mother_maiden, mother_nssf,
            mother_nationality, mother_nid,
            informant_name, informant_address, postal_address,
            date_of_registration, registrar_name

    output_pdf : str
        File path for the generated PDF.

    Returns
    -------
    (cert_no, vhash) : tuple[str, str]
        The unique certificate number and verification hash.
    """
    # Generate identifiers
    cert_no = _generate_cert_number()
    vhash   = _generate_hash(citizen_data, cert_no)

    # Open template
    template = Image.open(TEMPLATE_PATH).convert("RGB")
    draw     = ImageDraw.Draw(template)

    # Load fonts
    font_reg, font_bold, font_sn, font_tiny = _load_fonts()

    BLACK = (10,  10,  10)
    BLUE  = (0,   0,  180)
    GREY  = (120, 120, 120)

    g = citizen_data.get  # shorthand

    # ── Write all fields ───────────────────────────────────────────────────
    _write_field(draw, "serial_number",       cert_no[-7:],                           font_sn,   BLUE)
    _write_field(draw, "reg_no",              g("reg_no", cert_no),                   font_reg,  BLACK)
    _write_field(draw, "district",            g("district", ""),                      font_reg,  BLACK)
    _write_field(draw, "date_of_birth",       g("date_of_birth", ""),                 font_reg,  BLACK)
    _write_field(draw, "sex",                 g("sex", ""),                           font_reg,  BLACK)
    _write_field(draw, "place_of_birth",      g("place_of_birth", ""),               font_reg,  BLACK)
    _write_field(draw, "surname",             g("surname", "").upper(),               font_bold, BLACK)
    _write_field(draw, "other_names",         g("other_names", "").upper(),           font_bold, BLACK)
    _write_field(draw, "father_name",         g("father_name", ""),                  font_reg,  BLACK)
    _write_field(draw, "father_occupation",   g("father_occupation", "NIL"),          font_reg,  BLACK)
    _write_field(draw, "father_nssf",         g("father_nssf", "NIL"),               font_reg,  BLACK)
    _write_field(draw, "father_nationality",  g("father_nationality", "ZAMBIAN"),     font_reg,  BLACK)
    _write_field(draw, "father_nid",          g("father_nid", "NIL"),                font_reg,  BLACK)
    _write_field(draw, "mother_name",         g("mother_name", ""),                  font_reg,  BLACK)
    _write_field(draw, "mother_maiden",       g("mother_maiden", "NIL"),             font_reg,  BLACK)
    _write_field(draw, "mother_nssf",         g("mother_nssf", "NIL"),               font_reg,  BLACK)
    _write_field(draw, "mother_nationality",  g("mother_nationality", "ZAMBIAN"),     font_reg,  BLACK)
    _write_field(draw, "mother_nid",          g("mother_nid", "NIL"),                font_reg,  BLACK)
    _write_field(draw, "informant_name",      g("informant_name", ""),               font_reg,  BLACK)
    _write_field(draw, "informant_address",   g("informant_address", ""),            font_reg,  BLACK)
    _write_field(draw, "postal_address",      g("postal_address", "NIL"),            font_reg,  BLACK)
    _write_field(draw, "date_of_registration",g("date_of_registration", ""),         font_reg,  BLACK)
    _write_field(draw, "registrar_name",      g("registrar_name", ""),              font_reg,  BLACK)

    # Dated this __ day of __, 20__
    now = datetime.now()
    _write_field(draw, "dated_day",   str(now.day),                font_reg, BLACK)
    _write_field(draw, "dated_month", now.strftime("%B").upper(),  font_reg, BLACK)
    _write_field(draw, "dated_year",  str(now.year),               font_reg, BLACK)

    # QR code
    qr_img = _make_qr(cert_no, vhash)
    template.paste(qr_img, FIELD_COORDS["qr_code"])

    # Verification hash (tiny footer text)
    draw.text(FIELD_COORDS["verify_code"], f"Verify: {vhash}", font=font_tiny, fill=GREY)

    # ── Export to A4 PDF ───────────────────────────────────────────────────
    buf = BytesIO()
    template.save(buf, format="PNG", dpi=(200, 200))
    buf.seek(0)

    c = rl_canvas.Canvas(output_pdf, pagesize=A4)
    pw, ph = A4
    c.drawImage(ImageReader(buf), 0, 0, width=pw, height=ph, preserveAspectRatio=False)
    c.save()

    return vhash ,output_pdf


# ── Quick test ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    sample = {
        "reg_no"               : "ZMB0014886543",
        "district"             : "LUSAKA",
        "date_of_birth"        : "07-04-2008",
        "sex"                  : "FEMALE",
        "place_of_birth"       : "CHIPATA HEALTH CENTRE",
        "surname"              : "LIKANDO",
        "other_names"          : "MARGARET",
        "father_name"          : "SISHWATI LIKANDO",
        "father_occupation"    : "NIL",
        "father_nssf"          : "NIL",
        "father_nationality"   : "ZAMBIAN",
        "father_nid"           : "NIL",
        "mother_name"          : "THERESA CHILESHE",
        "mother_maiden"        : "NIL",
        "mother_nssf"          : "NIL",
        "mother_nationality"   : "ZAMBIAN",
        "mother_nid"           : "NIL",
        "informant_name"       : "THERESA CHILESHE",
        "informant_address"    : "ZANIMUONE - LUSAKA",
        "postal_address"       : "NIL",
        "date_of_registration" : "12-08-2024",
        "registrar_name"       : "GETRUDE NAWILA",
    }

    cert_no, vhash = generate_certificate(sample, r"C:\Users\LENOVO\Downloads\test_certificate.pdf")
    print(f" Certificate generated")
    print(f"   Cert No : {cert_no}")
    print(f"   Hash    : {vhash}")
    print(f"   QR URL  : {VERIFY_BASE_URL}/{cert_no}?h={vhash}")
