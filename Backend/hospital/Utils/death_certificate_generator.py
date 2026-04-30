"""
death_certificate_generator.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Zambia Digital ID System — Civil Registration Module
Generates the official Death Certificate as a PDF by overlaying
deceased/registration data onto the Registrar-General template.

This is the FINAL document in the death registration workflow.
It should be auto-populated from the approved NoticeOfDeath
and MCCD records — not filled manually.

Dependencies:
    pip install Pillow qrcode reportlab

Usage:
    from death_certificate_generator import generate_death_certificate

    vhash, output_path = generate_death_certificate(cert_data, "output.pdf")
"""

from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.utils import ImageReader
import qrcode
import hashlib
import uuid
import os
from datetime import datetime
from io import BytesIO


# ── Configuration ──────────────────────────────────────────────────────────

TEMPLATE_PATH   = os.path.join(os.path.dirname(__file__), "..", "..", "media", "DEATH CERT TEMPLATE.png")
VERIFY_BASE_URL = "https://zdid.gov.zm/verify/death"
FONT_REGULAR    = "C:\\Windows\\Fonts\\arial.ttf"
FONT_BOLD       = "C:\\Windows\\Fonts\\arialbd.ttf"
FONT_SIZE       = 20
FONT_SIZE_SERIAL = 22
FONT_SIZE_TINY  = 10

# Template dimensions: 864 × 1212 px
# All (x, y) coordinates calibrated to this resolution.

FIELD_COORDS = {
    # --- Header ---
    "registration_no"               : (230, 208),

    # --- Core Fields ---
    "date_of_death"                 : (220, 240),
    "district"                      : (612, 240),
    "place_of_death"                : (220, 273),
    "deceased_names_and_surname"    : (377, 302),
    "sex"                           : (125, 335),
    "age"                           : (280, 335),
    "nationality"                   : (455, 335),
    "occupation"                    : (656, 333),
    "napsa_social_security_no"      : (402, 365),
    "national_identity_no"          : (718, 365),
    "cause_of_death_line1"          : (225, 396),
    "cause_of_death_line2"          : (90,  428),
    "informant_name"                : (253, 460),
    "informant_relationship"        : (305, 492),
    "date_of_registration"          : (265, 522),
    "registrar_name"                : (245, 554),
    "register_kept_at"              : (710, 650),
    "dated_day"                     : (250, 710),
    "dated_month"                   : (425, 710),
    "dated_year"                    : (719, 710),
    "registrar_general_name"        : (250, 806),
    "qr_code"                       : (60,  1090),
    "verify_code"                   : (60,  1195),
}

QR_SIZE = 100

# Max characters before cause_of_death wraps to line 2
CAUSE_LINE_LIMIT = 55

# Render DPI must match what was used when calibrating pixel coordinates.
# PDF points = pixels × (72 / DPI)  →  no stretching, no scaling.
TEMPLATE_DPI = 200
PX_TO_PT     = 72 / TEMPLATE_DPI   # 0.36 pt per pixel


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
    return "ZDC" + str(uuid.uuid4().int)[:10]


def _generate_hash(data: dict, cert_no: str) -> str:
    raw = (
        f"{cert_no}"
        f"{data.get('deceased_names_and_surname','')}"
        f"{data.get('date_of_death','')}"
        f"{data.get('registration_no','')}"
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


def _split_cause(cause: str) -> tuple[str, str]:
    """Split a long cause of death string across two lines."""
    if len(cause) <= CAUSE_LINE_LIMIT:
        return cause, ""
    split_at = cause.rfind(" ", 0, CAUSE_LINE_LIMIT)
    if split_at == -1:
        split_at = CAUSE_LINE_LIMIT
    return cause[:split_at].strip(), cause[split_at:].strip()


# ── Public API ─────────────────────────────────────────────────────────────

def generate_death_certificate(cert_data: dict, output_pdf: str) -> tuple[str, str]:
    """
    Generate a Death Certificate PDF.

    Parameters
    ----------
    cert_data : dict
        Keys:
            registration_no              — official registration number
            date_of_death                — e.g. "25-04-2026"
            district                     — e.g. "LUSAKA"
            place_of_death               — full place description
            deceased_names_and_surname   — full name as on certificate
            sex                          — "M" or "F"
            age                          — e.g. "64 YEARS"
            nationality                  — e.g. "ZAMBIAN"
            occupation                   — e.g. "TEACHER"
            napsa_social_security_no     — NAPSA number or "NIL"
            national_identity_no         — NRC number or "NIL"
            cause_of_death               — full cause string (auto-wrapped)
            informant_name               — full name
            informant_relationship       — e.g. "SPOUSE"
            date_of_registration         — e.g. "27-04-2026"
            registrar_name               — name of registrar
            register_kept_at             — e.g. "LUSAKA DISTRICT REGISTRY"
            registrar_general_name       — signing Registrar-General

    output_pdf : str
        File path for the generated PDF.

    Returns
    -------
    (vhash, output_pdf) : tuple[str, str]
    """
    cert_no = _generate_cert_number()
    vhash   = _generate_hash(cert_data, cert_no)

    template = Image.open(TEMPLATE_PATH).convert("RGB")
    img_w_px, img_h_px = template.size          # e.g. 864 × 1212

    draw     = ImageDraw.Draw(template)
    font_reg, font_bold, font_sn, font_tiny = _load_fonts()

    BLACK = (10,  10,  10)
    BLUE  = (0,   0,  180)
    GREY  = (120, 120, 120)

    g = cert_data.get

    # Header
    _write_field(draw, "registration_no",            g("registration_no", cert_no),             font_sn,   BLUE)

    # Core fields
    _write_field(draw, "date_of_death",              g("date_of_death", ""),                    font_reg,  BLACK)
    _write_field(draw, "district",                   g("district", ""),                         font_reg,  BLACK)
    _write_field(draw, "place_of_death",             g("place_of_death", ""),                   font_reg,  BLACK)
    _write_field(draw, "deceased_names_and_surname", g("deceased_names_and_surname","").upper(), font_bold, BLACK)
    _write_field(draw, "sex",                        g("sex", ""),                              font_reg,  BLACK)
    _write_field(draw, "age",                        g("age", ""),                              font_reg,  BLACK)
    _write_field(draw, "nationality",                g("nationality", "ZAMBIAN"),               font_reg,  BLACK)
    _write_field(draw, "occupation",                 g("occupation", "NIL"),                    font_reg,  BLACK)
    _write_field(draw, "napsa_social_security_no",   g("napsa_social_security_no", "NIL"),      font_reg,  BLACK)
    _write_field(draw, "national_identity_no",       g("national_identity_no", "NIL"),          font_reg,  BLACK)

    # Cause of death — auto-wrap across two lines
    cause = g("cause_of_death", "")
    line1, line2 = _split_cause(cause)
    _write_field(draw, "cause_of_death_line1", line1, font_reg, BLACK)
    if line2:
        _write_field(draw, "cause_of_death_line2", line2, font_reg, BLACK)

    # Informant
    _write_field(draw, "informant_name",         g("informant_name", ""),         font_reg, BLACK)
    _write_field(draw, "informant_relationship", g("informant_relationship", ""), font_reg, BLACK)

    # Registration
    _write_field(draw, "date_of_registration", g("date_of_registration", ""), font_reg, BLACK)
    _write_field(draw, "registrar_name",       g("registrar_name", ""),       font_reg, BLACK)
    _write_field(draw, "register_kept_at",     g("register_kept_at", ""),     font_reg, BLACK)

    # Footer dates
    now = datetime.now()
    _write_field(draw, "dated_day",   str(now.day),               font_reg, BLACK)
    _write_field(draw, "dated_month", now.strftime("%B").upper(), font_reg, BLACK)
    _write_field(draw, "dated_year",  str(now.year),              font_reg, BLACK)

    # Registrar-General
    _write_field(draw, "registrar_general_name", g("registrar_general_name", ""), font_bold, BLACK)

    # QR + hash
    qr_img = _make_qr(cert_no, vhash)
    template.paste(qr_img, FIELD_COORDS["qr_code"])
    draw.text(FIELD_COORDS["verify_code"], f"Verify: {vhash}", font=font_tiny, fill=GREY)

    # ── FIX: Size the PDF page to exactly match the template image ──
    # page dimensions in points = pixel dimensions × (72 pt/inch ÷ render DPI)
    # This gives a 1-to-1 mapping so ReportLab draws the image at true size
    # with zero stretching in either axis.
    page_w_pt = img_w_px * PX_TO_PT   # e.g. 864 × 0.36 = 311.04 pt
    page_h_pt = img_h_px * PX_TO_PT   # e.g. 1212 × 0.36 = 436.32 pt

    buf = BytesIO()
    template.save(buf, format="PNG", dpi=(TEMPLATE_DPI, TEMPLATE_DPI))
    buf.seek(0)

    c = rl_canvas.Canvas(output_pdf, pagesize=(page_w_pt, page_h_pt))
    c.drawImage(
        ImageReader(buf),
        x=0, y=0,
        width=page_w_pt,
        height=page_h_pt,
        preserveAspectRatio=True,   # safety net — redundant but harmless
        mask="auto",
    )
    c.save()

    return vhash, output_pdf


# ── Quick test ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    sample = {
        "registration_no"               : "LUS-2026-00441",
        "date_of_death"                 : "25-04-2026",
        "district"                      : "LUSAKA",
        "place_of_death"                : "UNIVERSITY TEACHING HOSPITAL, LUSAKA",
        "deceased_names_and_surname"    : "PETER CHANDA MWANSA",
        "sex"                           : "M",
        "age"                           : "64 YEARS",
        "nationality"                   : "ZAMBIAN",
        "occupation"                    : "TEACHER",
        "napsa_social_security_no"      : "NAPSA-114432",
        "national_identity_no"          : "278945/67/1",
        "cause_of_death"                : "ACUTE MYOCARDIAL INFARCTION DUE TO CORONARY ARTERY DISEASE",
        "informant_name"                : "GRACE MWANSA",
        "informant_relationship"        : "SPOUSE",
        "date_of_registration"          : "27-04-2026",
        "registrar_name"                : "GETRUDE NAWILA",
        "register_kept_at"              : "LUSAKA DISTRICT REGISTRY",
        "registrar_general_name"        : "PROF. MARJORIE MULENGA",
    }

    vhash, path = generate_death_certificate(sample, os.path.join(os.path.dirname(__file__), "..", "..", "media", "test_death_certificate.pdf"))
    print(f"Death Certificate generated → {path}")
    print(f"Verify hash                 : {vhash}")
    print(f"QR URL: {VERIFY_BASE_URL}/{sample['registration_no']}?h={vhash}")
