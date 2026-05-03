"""
record_of_birth_generator.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Zambia Digital ID System — Civil Registration Module
Generates the Record of Birth (M.F.2 — Stocked by D.M.S.) as a
PDF by overlaying facility birth data onto the official template.

Fields on form:
    Serial No., Place of Birth, File No., Surname of Child,
    Sex, Other Names, BWT (birth weight), Date of Birth,
    Time of Birth, Father's Name, Father's Occupation,
    Father's Present Address (2 lines), Name of Mother,
    Officer-in-Charge, Date

Dependencies:
    pip install Pillow qrcode reportlab

Usage:
    from record_of_birth_generator import generate_record_of_birth

    vhash, output_path = generate_record_of_birth(birth_data, "output.pdf")
"""

from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
import qrcode
import hashlib
import uuid
import os
from datetime import datetime
from io import BytesIO


# ── Configuration ──────────────────────────────────────────────────────────

TEMPLATE_PATH   = os.path.join(os.path.dirname(__file__), "..", "..", "media", "RECORD_OF_BIRTH.png")
VERIFY_BASE_URL = "https://zdid.gov.zm/verify/record-of-birth"
FONT_REGULAR    = "C:\\Windows\\Fonts\\arial.ttf"
FONT_BOLD       = "C:\\Windows\\Fonts\\arialbd.ttf"
FONT_SIZE       = 19
FONT_SIZE_SERIAL = 21
FONT_SIZE_TINY  = 10

# Template dimensions: 693 × 980 px  (portrait A5-ish card)
# All (x, y) coordinates calibrated to this resolution.
# The form is simpler — short labels then a long underline per field.

FIELD_COORDS = {
    # --- Header ---
    "serial_number"         : (580,  40),   # Serial No. ______

    # --- Row 1: Place of Birth / File No ---
    "place_of_birth"        : (171, 225),   # Place of Birth: ___
    "file_number"           : (547, 225),   # File No: ___

    # --- Row 2: Surname of Child / Sex ---
    "child_surname"         : (202, 272),   # Surname of Child: ___
    "sex"                   : (521, 272),   # Sex: ___

    # --- Row 3: Other Names / BWT ---
    "child_other_names"     : (165, 315),   # Other Names: ___
    "birth_weight_kg"       : (530, 315),   # BWT: ___

    # --- Row 4: Date of Birth / Time of Birth ---
    "date_of_birth"         : (165, 360),   # Date of Birth: ___
    "time_of_birth"         : (560, 360),   # Time of Birth: ___

    # --- Father's Details ---
    "father_name"           : (172, 406),   # Father's Name: ___
    "father_occupation"     : (217, 450),   # Father's Occupation: ___
    "father_address_line1"  : (250, 497),   # Father's Present Address: ___ (line 1)
    "father_address_line2"  : (40,  540),   # (line 2 continuation)

    # --- Mother ---
    "mother_name"           : (185, 639),   # Name of Mother: ___

    # --- Official Sign-off ---
    "officer_in_charge"     : (340, 778),   # Officer-in-Charge (signature line)
    "date_signed"           : (382, 912),   # Date ___
}

QR_SIZE = 90

# Max chars before father's address wraps to line 2
ADDRESS_LINE_LIMIT = 45


# ── Internal helpers ───────────────────────────────────────────────────────

def _load_fonts():
    try:
        return (
            ImageFont.truetype(FONT_REGULAR, FONT_SIZE),
            ImageFont.truetype(FONT_BOLD,    FONT_SIZE),
            ImageFont.truetype(FONT_BOLD,    FONT_SIZE_SERIAL),
            ImageFont.truetype(FONT_REGULAR, FONT_SIZE_TINY),
        )
    except OSError:
        d = ImageFont.load_default()
        return d, d, d, d


def _generate_cert_number() -> str:
    return "ROB" + str(uuid.uuid4().int)[:10]


def _generate_hash(data: dict, cert_no: str) -> str:
    raw = (
        f"{cert_no}"
        f"{data.get('child_surname','')}"
        f"{data.get('date_of_birth','')}"
        f"{data.get('mother_name','')}"
    )
    return hashlib.sha256(raw.encode()).hexdigest()[:16].upper()


def _make_qr(cert_no: str, vhash: str) -> Image.Image:
    url = f"{VERIFY_BASE_URL}/{cert_no}?h={vhash}"
    qr  = qrcode.QRCode(version=1, box_size=3, border=1)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    return img.resize((QR_SIZE, QR_SIZE), Image.LANCZOS)


def _write_field(draw, key, value, font, fill=(10, 10, 10)):
    if key in FIELD_COORDS and value:
        draw.text(FIELD_COORDS[key], str(value), font=font, fill=fill)


def _split_address(address: str) -> tuple[str, str]:
    """Wrap a long address across two lines at a word boundary."""
    if len(address) <= ADDRESS_LINE_LIMIT:
        return address, ""
    split_at = address.rfind(" ", 0, ADDRESS_LINE_LIMIT)
    if split_at == -1:
        split_at = ADDRESS_LINE_LIMIT
    return address[:split_at].strip(), address[split_at:].strip()


# ── Public API ─────────────────────────────────────────────────────────────

def generate_record_of_birth(birth_data: dict, output_pdf: str) -> tuple[str, str]:
    """
    Generate a Record of Birth (M.F.2) PDF.

    Parameters
    ----------
    birth_data : dict
        Keys:
            serial_number        — pre-printed serial on the form
            place_of_birth       — e.g. "UTH, LUSAKA"
            file_number          — facility file/case number
            child_surname        — surname of child
            sex                  — "M" or "F"
            child_other_names    — given/other names of child
            birth_weight_kg      — e.g. "3.20 KG"
            date_of_birth        — e.g. "27-04-2026"
            time_of_birth        — e.g. "14:22"
            father_name          — full name of father (optional)
            father_occupation    — father's occupation (optional)
            father_address       — father's present address (auto-wrapped)
            mother_name          — full name of mother
            officer_in_charge    — name of signing officer
            date_signed          — date signed

    output_pdf : str
        File path for the generated PDF.

    Returns
    -------
    (vhash, output_pdf) : tuple[str, str]
    """
    cert_no = _generate_cert_number()
    vhash   = _generate_hash(birth_data, cert_no)

    template = Image.open(TEMPLATE_PATH).convert("RGB")
    draw     = ImageDraw.Draw(template)
    font_reg, font_bold, font_sn, font_tiny = _load_fonts()

    BLACK = (10,  10,  10)
    BLUE  = (0,   0,  180)
    GREY  = (120, 120, 120)

    g = birth_data.get

    # Header
    _write_field(draw, "serial_number",       g("serial_number", cert_no[-8:]),         font_sn,   BLUE)

    # Child details
    _write_field(draw, "place_of_birth",      g("place_of_birth", ""),                  font_reg,  BLACK)
    _write_field(draw, "file_number",         g("file_number", ""),                     font_reg,  BLACK)
    _write_field(draw, "child_surname",       g("child_surname", "").upper(),            font_bold, BLACK)
    _write_field(draw, "sex",                 g("sex", ""),                              font_reg,  BLACK)
    _write_field(draw, "child_other_names",   g("child_other_names", "").upper(),        font_bold, BLACK)
    _write_field(draw, "birth_weight_kg",     str(g("birth_weight_kg", "")) + " KG",    font_reg,  BLACK)
    _write_field(draw, "date_of_birth",       g("date_of_birth", ""),                   font_reg,  BLACK)
    _write_field(draw, "time_of_birth",       g("time_of_birth", ""),                   font_reg,  BLACK)

    # Father's details
    _write_field(draw, "father_name",         g("father_name", "NIL").upper(),           font_reg,  BLACK)
    _write_field(draw, "father_occupation",   g("father_occupation", "NIL"),             font_reg,  BLACK)

    # Father's address — auto-wrap across two lines
    addr = g("father_address", "NIL")
    addr_line1, addr_line2 = _split_address(addr)
    _write_field(draw, "father_address_line1", addr_line1,                               font_reg,  BLACK)
    if addr_line2:
        _write_field(draw, "father_address_line2", addr_line2,                           font_reg,  BLACK)

    # Mother
    _write_field(draw, "mother_name",         g("mother_name", "").upper(),              font_bold, BLACK)

    # Official sign-off
    _write_field(draw, "officer_in_charge",   g("officer_in_charge", ""),                font_reg,  BLACK)
    _write_field(draw, "date_signed",         g("date_signed", datetime.now().strftime("%d-%m-%Y")), font_reg, BLACK)

    # QR + verification hash (bottom right — below stamp box area)
    w, h = template.size
    qr_img = _make_qr(cert_no, vhash)
    qr_x   = w - QR_SIZE - 15
    qr_y   = h - QR_SIZE - 30
    template.paste(qr_img, (qr_x, qr_y))
    draw.text((qr_x, qr_y + QR_SIZE + 4), f"Verify: {vhash}", font=font_tiny, fill=GREY)

    buf = BytesIO()
    template.save(buf, format="PNG", dpi=(200, 200))
    buf.seek(0)

    c = rl_canvas.Canvas(output_pdf, pagesize=A4)
    pw, ph = A4
    c.drawImage(ImageReader(buf), 0, 0, width=pw, height=ph, preserveAspectRatio=False)
    c.save()

    return vhash, output_pdf


# ── Quick test ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    sample = {
        "serial_number"     : "MF2-00891",
        "place_of_birth"    : "CHIPATA HEALTH CENTRE",
        "file_number"       : "CHC-2026-441",
        "child_surname"     : "PHIRI",
        "sex"               : "F",
        "child_other_names" : "THANDIWE GRACE",
        "birth_weight_kg"   : "2.95",
        "date_of_birth"     : "27-04-2026",
        "time_of_birth"     : "06:45",
        "father_name"       : "JAMES PHIRI",
        "father_occupation" : "FARMER",
        "father_address"    : "PLOT 3, CHIPATA COMPOUND, CHIPATA, EASTERN PROVINCE",
        "mother_name"       : "MERCY PHIRI",
        "officer_in_charge" : "NURSE CHANDA MUTALE",
        "date_signed"       : "27-04-2026",
    }

    vhash, path = generate_record_of_birth(sample, os.path.join(os.path.dirname(__file__), "..", "..", "media", "test_record_of_birth.pdf"))
    print(f"Record of Birth generated → {path}")
    print(f"Verify hash               : {vhash}")
