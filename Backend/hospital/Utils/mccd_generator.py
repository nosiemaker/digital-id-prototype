"""
mccd_generator.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Zambia Digital ID System — Civil Registration Module
Generates the Medical Certificate of the Cause of Death (MCCD)
as a PDF by overlaying doctor/patient data onto the official
Ministry of Health Medical No. 14 template.

Dependencies:
    pip install Pillow qrcode reportlab

Usage:
    from mccd_generator import generate_mccd

    vhash, output_path = generate_mccd(mccd_data, "output.pdf")
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

TEMPLATE_PATH   = os.path.join(os.path.dirname(__file__), "..", "..", "media", "MCCD TEMPLATE.png")
VERIFY_BASE_URL = "https://zdid.gov.zm/verify/mccd"
FONT_REGULAR    = "C:\\Windows\\Fonts\\arial.ttf"
FONT_BOLD       = "C:\\Windows\\Fonts\\arialbd.ttf"
FONT_SIZE       = 18
FONT_SIZE_SERIAL = 20
FONT_SIZE_TINY  = 10

# Template dimensions: 864 × 1212 px
# All (x, y) coordinates calibrated to this resolution.

FIELD_COORDS = {
    # --- Header ---
    "medical_no"                    : (75,  45),

    # --- Attendance Narrative ---
    "attended_name"                 : (262, 177),
    "during"                        : (554, 182),
    "illness_start_date"            : (830, 184),
    "age_stated"                    : (289, 207),
    "last_attended_alive_date"      : (583, 219),
    "last_attended_alive_day"       : (760, 219),
    "last_attended_alive_month"     : (876, 219),
    "last_attended_alive_year"      : (938, 221),
    "death_day"                     : (163, 235),
    "death_date"                    : (484, 240),
    "death_month"                   : (698, 245),
    "death_year"                    : (787, 248),
    "death_time"                    : (838, 247),
    "body_identified_of"            : (229, 259),
    "belief"                        : (78,  284),

    # --- Post Mortem Line ---
    "postmortem_confirmed"          : (200, 285),

    # --- Cause of Death Table ---
    "cause_a"                       : (327, 383),
    "cause_a_interval"              : (775, 401),
    "cause_a_icd_code"              : (545, 383),
    "cause_b"                       : (161, 418),
    "cause_b_interval"              : (775, 437),
    "cause_b_icd_code"              : (551, 432),
    "cause_c"                       : (108, 556),
    "cause_c_interval"              : (775, 486),
    "cause_c_icd_code"              : (551, 486),
    "other_condition_1"             : (518, 535),
    "other_condition_1_interval"    : (775, 536),
    "other_condition_2"             : (518, 575),
    "other_condition_2_interval"    : (775, 582),

    # --- Doctor Sign-off ---
    "witness_date"                  : (185, 660),
    "witness_month"                 : (416, 660),
    "witness_year"                  : (516, 660),
    "certificate_handed_to"         : (32,  752),
    "medical_attendant_name"        : (617, 655),
    "medical_attendant_signature"   : (648, 690),
    "medical_attendant_qualification": (667, 719),
    "medical_attendant_residence"   : (648, 747),

    # --- Additional Information ---
    "village"                       : (84,  914),
    "chief"                         : (626, 914),
    "district"                      : (74,  950),

    # --- System Appends ---
    "qr_code"                       : (60,  1090),
    "verify_code"                   : (60,  1195),
}

QR_SIZE = 100

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
    return "MCCD" + str(uuid.uuid4().int)[:10]


def _generate_hash(data: dict, cert_no: str) -> str:
    raw = f"{cert_no}{data.get('attended_name','')}{data.get('death_date','')}"
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


# ── Public API ─────────────────────────────────────────────────────────────

def generate_mccd(mccd_data: dict, output_pdf: str) -> tuple[str, str]:
    """
    Generate a Medical Certificate of Cause of Death PDF.

    Parameters
    ----------
    mccd_data : dict
        Keys:
            medical_no, attended_name, illness_start_date, age_stated,
            last_attended_alive_date, last_attended_alive_day,
            death_date, death_day, death_year, death_time,
            body_identified_of, postmortem_confirmed (bool),
            cause_a, cause_a_interval, cause_a_icd_code,
            cause_b, cause_b_interval, cause_b_icd_code,
            cause_c, cause_c_interval, cause_c_icd_code,
            other_condition_1, other_condition_1_interval,
            other_condition_2, other_condition_2_interval,
            witness_date, witness_month, witness_year,
            certificate_handed_to,
            medical_attendant_name, medical_attendant_signature,
            medical_attendant_qualification, medical_attendant_residence,
            village, chief, district

    output_pdf : str
        File path for the generated PDF.

    Returns
    -------
    (vhash, output_pdf) : tuple[str, str]
    """
    cert_no = _generate_cert_number()
    vhash   = _generate_hash(mccd_data, cert_no)

    template = Image.open(TEMPLATE_PATH).convert("RGB")
    img_w_px, img_h_px = template.size          # e.g. 864 × 1212

    draw     = ImageDraw.Draw(template)
    font_reg, font_bold, font_sn, font_tiny = _load_fonts()

    BLACK = (10,  10,  10)
    BLUE  = (0,   0,  180)
    GREY  = (120, 120, 120)

    g = mccd_data.get

    _write_field(draw, "medical_no",                     g("medical_no", cert_no[-8:]),           font_sn,   BLUE)
    _write_field(draw, "attended_name",                  g("attended_name", ""),                  font_reg,  BLACK)
    _write_field(draw, "illness_start_date",             g("illness_start_date", ""),             font_reg,  BLACK)
    _write_field(draw, "age_stated",                     g("age_stated", ""),                     font_reg,  BLACK)
    _write_field(draw, "last_attended_alive_date",       g("last_attended_alive_date", ""),       font_reg,  BLACK)
    _write_field(draw, "last_attended_alive_day",        g("last_attended_alive_day", ""),        font_reg,  BLACK)
    _write_field(draw, "last_attended_alive_month",      g("last_attended_alive_month", ""),      font_reg,  BLACK)
    _write_field(draw, "last_attended_alive_year",       g("last_attended_alive_year", ""),       font_reg,  BLACK)
    _write_field(draw, "death_date",                     g("death_date", ""),                     font_reg,  BLACK)
    _write_field(draw, "death_day",                      g("death_day", ""),                      font_reg,  BLACK)
    _write_field(draw, "death_month",                    g("death_month", ""),                    font_reg,  BLACK)
    _write_field(draw, "death_year",                     g("death_year", ""),                     font_reg,  BLACK)
    _write_field(draw, "death_time",                     g("death_time", ""),                     font_reg,  BLACK)
    _write_field(draw, "body_identified_of",             g("body_identified_of", ""),             font_reg,  BLACK)
    _write_field(draw, "postmortem_confirmed",
                 "CONFIRMED" if g("postmortem_confirmed", False) else "NOT CONFIRMED",            font_reg,  BLACK)

    # Cause of death table
    _write_field(draw, "cause_a",                        g("cause_a", ""),                        font_reg,  BLACK)
    _write_field(draw, "cause_a_interval",               g("cause_a_interval", ""),               font_reg,  BLACK)
    _write_field(draw, "cause_a_icd_code",               g("cause_a_icd_code", ""),               font_reg,  BLACK)
    _write_field(draw, "cause_b",                        g("cause_b", "NIL"),                     font_reg,  BLACK)
    _write_field(draw, "cause_b_interval",               g("cause_b_interval", ""),               font_reg,  BLACK)
    _write_field(draw, "cause_b_icd_code",               g("cause_b_icd_code", ""),               font_reg,  BLACK)
    _write_field(draw, "cause_c",                        g("cause_c", "NIL"),                     font_reg,  BLACK)
    _write_field(draw, "cause_c_interval",               g("cause_c_interval", ""),               font_reg,  BLACK)
    _write_field(draw, "cause_c_icd_code",               g("cause_c_icd_code", ""),               font_reg,  BLACK)
    _write_field(draw, "other_condition_1",              g("other_condition_1", "NIL"),           font_reg,  BLACK)
    _write_field(draw, "other_condition_1_interval",     g("other_condition_1_interval", ""),     font_reg,  BLACK)
    _write_field(draw, "other_condition_2",              g("other_condition_2", "NIL"),           font_reg,  BLACK)
    _write_field(draw, "other_condition_2_interval",     g("other_condition_2_interval", ""),     font_reg,  BLACK)

    # Doctor sign-off
    _write_field(draw, "witness_date",                   g("witness_date", ""),                   font_reg,  BLACK)
    _write_field(draw, "witness_month",                  g("witness_month", ""),                  font_reg,  BLACK)
    _write_field(draw, "witness_year",                   g("witness_year", ""),                   font_reg,  BLACK)
    _write_field(draw, "certificate_handed_to",          g("certificate_handed_to", ""),          font_reg,  BLACK)
    _write_field(draw, "medical_attendant_name",         g("medical_attendant_name", ""),         font_bold, BLACK)
    _write_field(draw, "medical_attendant_qualification",g("medical_attendant_qualification",""), font_reg,  BLACK)
    _write_field(draw, "medical_attendant_residence",    g("medical_attendant_residence", ""),    font_reg,  BLACK)

    # Additional information
    _write_field(draw, "village",                        g("village", ""),                        font_reg,  BLACK)
    _write_field(draw, "chief",                          g("chief", ""),                          font_reg,  BLACK)
    _write_field(draw, "district",                       g("district", ""),                       font_reg,  BLACK)

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
        "medical_no"                    : "MH14-00293",
        "attended_name"                 : "JOHN BANDA",
        "illness_start_date"            : "01-04-2026",
        "age_stated"                    : "62 YEARS",
        "last_attended_alive_date"      : "05-04-2026",
        "last_attended_alive_day"       : "5",
        "death_date"                    : "07-04-2026",
        "death_day"                     : "7",
        "death_year"                    : "26",
        "death_time"                    : "03:15",
        "body_identified_of"            : "JOHN BANDA",
        "postmortem_confirmed"          : False,
        "cause_a"                       : "ACUTE MYOCARDIAL INFARCTION",
        "cause_a_interval"              : "2 HOURS",
        "cause_a_icd_code"              : "I21.9",
        "cause_b"                       : "CORONARY ARTERY DISEASE",
        "cause_b_interval"              : "5 YEARS",
        "cause_b_icd_code"              : "I25.1",
        "cause_c"                       : "NIL",
        "other_condition_1"             : "TYPE 2 DIABETES MELLITUS",
        "other_condition_1_interval"    : "10 YEARS",
        "other_condition_2"             : "NIL",
        "witness_date"                  : "7",
        "witness_month"                 : "APRIL",
        "witness_year"                  : "26",
        "certificate_handed_to"         : "GRACE BANDA — PLOT 14, IBEX HILL, LUSAKA",
        "medical_attendant_name"        : "DR. MWEWA CHILUFYA",
        "medical_attendant_qualification": "MBChB, MMed (Internal Medicine)",
        "medical_attendant_residence"   : "UTH, LUSAKA",
        "village"                       : "IBEX HILL",
        "chief"                         : "CHITANDA",
        "district"                      : "LUSAKA",
    }

    vhash, path = generate_mccd(sample, os.path.join(os.path.dirname(__file__), "..", "..", "media", "test_mccd.pdf"))
    print(f"MCCD generated → {path}")
    print(f"Verify hash    : {vhash}")
