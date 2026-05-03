"""
notice_of_birth_generator.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Zambia Digital ID System — Civil Registration Module
Generates the Hospital Notice of Birth (Form VIII — 2016 Rev.,
Rules 16, 17, 18 and 23, Stocked by DNRPC) as a PDF by
overlaying citizen/birth data onto the official template.

Sections covered:
    Header      — Nº, Serial No., District, Date and Time
    Section 1   — Details of Birth (child + place + sex + weight)
    Section 2   — Details of Father
    Section 3   — Details of Mother
    Parenthood  — Acknowledgement of Parenthood

Dependencies:
    pip install Pillow qrcode reportlab

Usage:
    from notice_of_birth_generator import generate_notice_of_birth

    vhash, output_path = generate_notice_of_birth(birth_data, "output.pdf")
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

TEMPLATE_PATH   = os.path.join(os.path.dirname(__file__), "..", "..", "media", "HOSPITAL_NOTICE_OF_BIRTH.png")
VERIFY_BASE_URL = "https://zdid.gov.zm/verify/notice-of-birth"
FONT_REGULAR    = "C:\\Windows\\Fonts\\arial.ttf"
FONT_BOLD       = "C:\\Windows\\Fonts\\arialbd.ttf"
FONT_SIZE       = 17
FONT_SIZE_SERIAL = 20
FONT_SIZE_TINY  = 10

# Template dimensions: 864 × 1212 px
# All (x, y) coordinates calibrated to this resolution.
# The form uses a dense grid — each row is ~28px apart.
# Text is shifted up ~4px from the baseline to sit neatly on the dotted lines.

FIELD_COORDS = {
    # ── Header ────────────────────────────────────────────────────────────
    "form_serial_no"            : (615,  87),   # Nº 0050984 (top right, pre-printed red)
    "serial_no"                 : (590, 169),   # Serial No.: (shaded field)
    "district"                  : (592, 187),   # District:
    "date_and_time"             : (590, 202),   # Date and Time:

    # ── Section 1: Details of Birth ───────────────────────────────────────
    # Date of Birth  DD / MM / YYYY — written as a single formatted string
    "date_of_birth"             : (400, 219),

    # Place of birth — tick written next to the matching option
    # Health Facility tick position
    "place_hf_tick"             : (388, 228),
    # Home tick position
    "place_home_tick"           : (602,229),
    # Other (specify)
    "place_other_text"          : (388, 244),

    "health_facility_name"      : (380, 272),   # Health Facility Name:
    "home_address"              : (287, 287),   # Home Address:
    "other_specify"             : (178, 304),   # Other (Specify):

    # Child name grid
    "child_surname"             : (256, 323),   # Surname:
    "child_given_name"          : (256, 343),   # Given Name:
    "child_other_names"         : (256, 361),   # Other Name(s):
    "birth_weight"              : (256, 380),   # Birth Weight:

    # Sex tick — M or F
    "sex"                : (656, 255),   # M tick
    

    # ── Section 2: Details of Father ──────────────────────────────────────
    "father_surname"            : (256, 413),
    "father_other_names"        : (256, 436),
    "father_dob"                : (256, 456),
    "father_national_id"        : (256, 480),
    "father_occupation"         : (256, 502),
    "father_social_id"          : (256, 520),
    "father_village"            : (256, 540),
    "father_chief"              : (552, 540),
    "father_district"           : (552, 557),
    "father_tribe"              : (256, 557),
    "father_nationality"        : (256, 573),
    "father_residential_address": (256, 591),
    "father_contact_no"         : (256, 611),

    # ── Section 3: Details of Mother ──────────────────────────────────────
    "mother_surname"            : (256, 655),
    "mother_other_names"        : (256, 676),
    "mother_maiden_surname"     : (256, 701),
    "mother_dob"                : (256, 724),
    "mother_national_id"        : (256, 771),
    "mother_nationality"        : (658, 764),
    "mother_occupation"         : (256, 787),
    "mother_social_id"          : (256, 803),
    "mother_village"            : (256, 821),
    "mother_chief"              : (554, 816),
    "mother_district"           : (554, 830),
    "mother_tribe"              : (256, 836),
    # Education tick — written as text beside the applicable box
    "mother_education"          : (256, 853),
    "mother_residential_address": (256, 870),
    "mother_usual_residence"    : (256, 903),

    # Attendant at birth — written beside applicable option
    "attendant_type"            : (256, 924),
    "attendant_other"           : (401, 937),

    # ── Acknowledgement of Parenthood ─────────────────────────────────────
    # Marital status — written beside applicable box
    "marital_status"            : (256, 984),

    # Not-married section
    "father_acknowledgement_name" : (274, 1014),
    "father_acknowledgement_date" : (587, 1052),
    "mother_consent_name"         : (329, 1092),
    "mother_consent_date"         : (595, 1130),

    # ── System Appends ────────────────────────────────────────────────────
    "qr_code"                   : (38,  1159),
    "verify_code"               : (60,  1195),
}

QR_SIZE = 70


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
    return "NOB" + str(uuid.uuid4().int)[:10]


def _generate_hash(data: dict, cert_no: str) -> str:
    raw = (
        f"{cert_no}"
        f"{data.get('child_surname','')}"
        f"{data.get('date_of_birth','')}"
        f"{data.get('mother_surname','')}"
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


def _tick(draw, key, condition, font, fill=(10, 10, 10)):
    """Write ✓ at the coordinate if condition is True."""
    if condition and key in FIELD_COORDS:
        draw.text(FIELD_COORDS[key], "✓", font=font, fill=fill)


# ── Public API ─────────────────────────────────────────────────────────────

def generate_notice_of_birth(birth_data: dict, output_pdf: str) -> tuple[str, str]:
    """
    Generate a Hospital Notice of Birth (Form VIII) PDF.

    Parameters
    ----------
    birth_data : dict

        Header:
            form_serial_no       — pre-printed Nº on form (e.g. "0050984")
            serial_no            — official serial (shaded field)
            district             — district name
            date_and_time        — official date and time recorded

        Section 1 — Details of Birth:
            date_of_birth        — "DD-MM-YYYY"
            place_of_birth       — "HEALTH_FACILITY" | "HOME" | "OTHER"
            health_facility_name — required if HEALTH_FACILITY
            home_address         — required if HOME
            other_specify        — required if OTHER
            child_surname        — child's surname
            child_given_name     — child's given name
            child_other_names    — child's other names
            birth_weight         — e.g. "3.20 KG"
            sex                  — "M" or "F"

        Section 2 — Details of Father (all optional):
            father_surname, father_other_names, father_dob,
            father_national_id, father_occupation, father_social_id,
            father_village, father_chief, father_district, father_tribe,
            father_nationality, father_residential_address, father_contact_no

        Section 3 — Details of Mother:
            mother_surname, mother_other_names, mother_maiden_surname,
            mother_dob, mother_national_id, mother_nationality,
            mother_occupation, mother_social_id, mother_village,
            mother_chief, mother_district, mother_tribe,
            mother_education    — "NONE"|"PRIMARY"|"SECONDARY"|"TERTIARY"
            mother_residential_address, mother_usual_residence

        Attendant:
            attendant_type       — "MIDWIFE" | "TBA" | "OTHER"
            attendant_other      — text if OTHER

        Parenthood:
            marital_status       — "MARRIED" | "NOT_MARRIED"
            father_acknowledgement_name  — required if NOT_MARRIED
            father_acknowledgement_date
            mother_consent_name
            mother_consent_date

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
    RED   = (180,  0,   0)
    GREY  = (120, 120, 120)

    g = birth_data.get

    # ── Header ────────────────────────────────────────────────────────────
    _write_field(draw, "form_serial_no",  g("form_serial_no", cert_no[-7:]),  font_sn,   RED)
    _write_field(draw, "serial_no",       g("serial_no", ""),                 font_reg,  BLACK)
    _write_field(draw, "district",        g("district", ""),                  font_reg,  BLACK)
    _write_field(draw, "date_and_time",   g("date_and_time", ""),             font_reg,  BLACK)

    # ── Section 1: Details of Birth ───────────────────────────────────────
    _write_field(draw, "date_of_birth",   g("date_of_birth", ""),             font_reg,  BLACK)

    # Place of birth tick
    place = g("place_of_birth", "")
    _tick(draw, "place_hf_tick",   place == "HEALTH_FACILITY",  font_bold, BLACK)
    _tick(draw, "place_home_tick", place == "HOME",              font_bold, BLACK)
    if place == "OTHER":
        _write_field(draw, "place_other_text", g("other_specify", ""),        font_reg, BLACK)

    _write_field(draw, "health_facility_name", g("health_facility_name", ""), font_reg, BLACK)
    _write_field(draw, "home_address",          g("home_address", ""),        font_reg, BLACK)
    _write_field(draw, "other_specify",         g("other_specify", ""),       font_reg, BLACK)

    # Child name — uppercase bold in grid boxes
    _write_field(draw, "child_surname",     g("child_surname", "").upper(),    font_bold, BLACK)
    _write_field(draw, "child_given_name",  g("child_given_name", "").upper(), font_bold, BLACK)
    _write_field(draw, "child_other_names", g("child_other_names","").upper(), font_reg,  BLACK)
    _write_field(draw, "birth_weight",      str(g("birth_weight", "")) + " KG", font_reg, BLACK)

    # Sex tick
    sex = g("sex", "")
    _tick(draw, "sex", sex == "MALE", font_bold, BLACK)


    # ── Section 2: Details of Father ──────────────────────────────────────
    _write_field(draw, "father_surname",             g("father_surname","NIL").upper(),      font_reg, BLACK)
    _write_field(draw, "father_other_names",         g("father_other_names","NIL").upper(),  font_reg, BLACK)
    _write_field(draw, "father_dob",                 g("father_dob",""),                     font_reg, BLACK)
    _write_field(draw, "father_national_id",         g("father_national_id","NIL"),          font_reg, BLACK)
    _write_field(draw, "father_occupation",          g("father_occupation","NIL"),           font_reg, BLACK)
    _write_field(draw, "father_social_id",           g("father_social_id","NIL"),            font_reg, BLACK)
    _write_field(draw, "father_village",             g("father_village",""),                 font_reg, BLACK)
    _write_field(draw, "father_chief",               g("father_chief",""),                   font_reg, BLACK)
    _write_field(draw, "father_district",            g("father_district",""),                font_reg, BLACK)
    _write_field(draw, "father_tribe",               g("father_tribe",""),                   font_reg, BLACK)
    _write_field(draw, "father_nationality",         g("father_nationality","ZAMBIAN"),      font_reg, BLACK)
    _write_field(draw, "father_residential_address", g("father_residential_address",""),     font_reg, BLACK)
    _write_field(draw, "father_contact_no",          g("father_contact_no",""),              font_reg, BLACK)

    # ── Section 3: Details of Mother ──────────────────────────────────────
    _write_field(draw, "mother_surname",             g("mother_surname","").upper(),         font_bold, BLACK)
    _write_field(draw, "mother_other_names",         g("mother_other_names","").upper(),     font_bold, BLACK)
    _write_field(draw, "mother_maiden_surname",      g("mother_maiden_surname","NIL"),       font_reg,  BLACK)
    _write_field(draw, "mother_dob",                 g("mother_dob",""),                     font_reg,  BLACK)
    _write_field(draw, "mother_national_id",         g("mother_national_id","NIL"),          font_reg,  BLACK)
    _write_field(draw, "mother_nationality",         g("mother_nationality","ZAMBIAN"),      font_reg,  BLACK)
    _write_field(draw, "mother_occupation",          g("mother_occupation","NIL"),           font_reg,  BLACK)
    _write_field(draw, "mother_social_id",           g("mother_social_id","NIL"),            font_reg,  BLACK)
    _write_field(draw, "mother_village",             g("mother_village",""),                 font_reg,  BLACK)
    _write_field(draw, "mother_chief",               g("mother_chief",""),                   font_reg,  BLACK)
    _write_field(draw, "mother_district",            g("mother_district",""),                font_reg,  BLACK)
    _write_field(draw, "mother_tribe",               g("mother_tribe",""),                   font_reg,  BLACK)
    _write_field(draw, "mother_education",           g("mother_education",""),               font_reg,  BLACK)
    _write_field(draw, "mother_residential_address", g("mother_residential_address",""),     font_reg,  BLACK)
    _write_field(draw, "mother_usual_residence",     g("mother_usual_residence",""),         font_reg,  BLACK)

    # Attendant
    attendant_map = {
        "MIDWIFE": "QUALIFIED MIDWIFE",
        "TBA":     "TRADITIONAL BIRTH ATTENDANT",
        "OTHER":   g("attendant_other", ""),
    }
    _write_field(draw, "attendant_type",  attendant_map.get(g("attendant_type",""), ""), font_reg, BLACK)

    # ── Acknowledgement of Parenthood ─────────────────────────────────────
    marital = g("marital_status", "MARRIED")
    _write_field(draw, "marital_status",
                 "✓ MARRIED" if marital == "MARRIED" else "✓ NOT MARRIED",               font_reg, BLACK)

    if marital == "NOT_MARRIED":
        _write_field(draw, "father_acknowledgement_name", g("father_acknowledgement_name",""), font_reg, BLACK)
        _write_field(draw, "father_acknowledgement_date", g("father_acknowledgement_date",""), font_reg, BLACK)
        _write_field(draw, "mother_consent_name",         g("mother_consent_name",""),         font_reg, BLACK)
        _write_field(draw, "mother_consent_date",         g("mother_consent_date",""),         font_reg, BLACK)

    # ── QR + Verification Hash ────────────────────────────────────────────
    qr_img = _make_qr(cert_no, vhash)
    template.paste(qr_img, FIELD_COORDS["qr_code"])
    draw.text(FIELD_COORDS["verify_code"], f"Verify: {vhash}", font=font_tiny, fill=GREY)

    # ── Export to A4 PDF ──────────────────────────────────────────────────
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
        # Header
        "form_serial_no"            : "0050985",
        "serial_no"                 : "NOB-2026-004",
        "district"                  : "LUSAKA",
        "date_and_time"             : "08:15",

        # Section 1 — Birth
        "date_of_birth"             : "27-04-2026",
        "place_of_birth"            : "HEALTH_FACILITY",
        "health_facility_name"      : "CHIPATA HEALTH CENTRE",
        "child_surname"             : "PHIRI",
        "child_given_name"          : "THANDIWE",
        "child_other_names"         : "GRACE",
        "birth_weight"              : "3.10",
        "sex"                       : "F",

        # Section 2 — Father
        "father_surname"            : "PHIRI",
        "father_other_names"        : "JAMES CHANDA",
        "father_dob"                : "14-03-1985",
        "father_national_id"        : "234100/78/1",
        "father_occupation"         : "FARMER",
        "father_social_id"          : "NAPSA-228801",
        "father_village"            : "KAPATA",
        "father_chief"              : "NZAMANE",
        "father_district"           : "CHIPATA",
        "father_tribe"              : "NGONI",
        "father_nationality"        : "ZAMBIAN",
        "father_residential_address": "PLOT 3, KAPATA, CHIPATA",
        "father_contact_no"         : "0977112233",

        # Section 3 — Mother
        "mother_surname"            : "PHIRI",
        "mother_other_names"        : "MERCY CHISOMO",
        "mother_maiden_surname"     : "BANDA",
        "mother_dob"                : "22-07-1990",
        "mother_national_id"        : "278945/67/1",
        "mother_nationality"        : "ZAMBIAN",
        "mother_occupation"         : "NURSE",
        "mother_social_id"          : "NAPSA-339021",
        "mother_village"            : "KAPATA",
        "mother_chief"              : "NZAMANE",
        "mother_district"           : "CHIPATA",
        "mother_tribe"              : "NGONI",
        "mother_education"          : "TERTIARY",
        "mother_residential_address": "PLOT 3, KAPATA, CHIPATA",
        "mother_usual_residence"    : "PLOT 3, KAPATA, CHIPATA",

        # Attendant
        "attendant_type"            : "MIDWIFE",

        # Parenthood
        "marital_status"            : "MARRIED",
    }

    vhash, path = generate_notice_of_birth(sample, os.path.join(os.path.dirname(__file__), "..", "..", "media", "test_notice_of_birth.pdf"))
    print(f"Notice of Birth generated → {path}")
    print(f"Verify hash               : {vhash}")
