"""
notice_of_death_generator.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Zambia Digital ID System — Civil Registration Module
Generates the Notice of Death (two-page DNRPC form) as a PDF
by overlaying informant/deceased data onto the official template.

Sections covered:
    A — Details of Deceased
    B — Cause of Death (ICD codes — official use)
    C — Police / Brought-in-Dead Certificate (+ Doctor's Remarks)
    D — Details of Informant
    E — Appendices checklist

Dependencies:
    pip install Pillow qrcode reportlab

Usage:
    from notice_of_death_generator import generate_notice_of_death

    vhash, output_path = generate_notice_of_death(notice_data, "output.pdf")
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

TEMPLATE_PATH_P1 = os.path.join(os.path.dirname(__file__), "..", "..", "media", "NOTICE OF DEATH 1.png")
TEMPLATE_PATH_P2 = os.path.join(os.path.dirname(__file__), "..", "..", "media", "NOTICE OF DEATH 2.png")
VERIFY_BASE_URL  = "https://zdid.gov.zm/verify/notice-of-death"
FONT_REGULAR     = "C:\\Windows\\Fonts\\arial.ttf"
FONT_BOLD        = "C:\\Windows\\Fonts\\arialbd.ttf"
FONT_SIZE        = 17
FONT_SIZE_SERIAL = 14
FONT_SIZE_TINY   = 10

# Render DPI must match what was used when calibrating pixel coordinates.
# PDF points = pixels × (72 / DPI)  →  no stretching, no scaling.
TEMPLATE_DPI = 200
PX_TO_PT     = 72 / TEMPLATE_DPI   # 0.36 pt per pixel

# ── Page 1 Field Coordinates ───────────────────────────────────────────────
# Template: 864 × 1212 px

FIELD_COORDS_P1 = {
    # --- Header (shaded official fields) ---
    "serial_number"             : (525,  196),
    "application_no"            : (715,   65),
    "date_and_time"             : (715,  112),

    # --- Section A: Details of Deceased ---
    "surname"                   : (353, 221),
    "district"                  : (851, 196),
    "other_names"               : (353, 242),
    "occupation"                : (353, 265),
    "residential_address"       : (353, 287),
    "date_of_death"             : (681, 310),
    "place_of_death"            : (554, 326),
    "place_of_death_name"       : (554, 349),
    "date_of_birth"             : (678, 395),
    "age_at_death"              : (353, 417),
    "sex"                       : (884, 417),
    "nationality"               : (353, 440),
    "national_identity_no"      : (353, 460),
    "social_security_no"        : (353, 480),
    "education_level"           : (984, 503),

    # --- Section B: Cause of Death (official use) ---
    "immediate_cause"           : (353, 590),
    "immediate_cause_icd"       : (820, 590),
    "antecedent_cause"          : (353, 611),
    "antecedent_cause_icd"      : (820, 611),
    "underlying_cause"          : (353, 635),
    "underlying_cause_icd"      : (820, 635),

    # --- Section C: Police / Brought-in-Dead Certificate ---
    "police_certifier_name"         : (353, 680),
    "police_certifier_residence"    : (353, 706),
    "police_certifier_relationship" : (353, 720),
    "deceased_surname_police"       : (353, 756),
    "deceased_other_names_police"   : (353, 787),
    "deceased_age_police"           : (116, 809),
    "passed_away_date"              : (602, 809),
    "passed_away_time"              : (933, 809),
    "passed_away_place"             : (353, 830),
    "suddenly_suffering_from"       : (353, 850),
    "treatment_was_at"              : (353, 873),
    "is_natural_death"              : (376, 901),
    "is_sudden_death_postmortem"    : (376, 953),
}

# ── Page 2 Field Coordinates ───────────────────────────────────────────────

FIELD_COORDS_P2 = {
    # Police officer sign-off (bottom of Section C)
    "police_no_and_rank"            : (344,  10),
    "police_formation"              : (711,  10),
    "police_officer_name"           : (140,  48),
    "police_officer_date"           : (530,  69),

    # --- Doctor's Remarks (back of Section C) ---
    "doctors_remarks"               : (353,  92),
    "pupils_dilated_and_fixed"      : (353, 170),
    "certifying_doctor_name"        : (233, 221),
    "certifying_doctor_date"        : (118, 294),

    # --- Section D: Details of Informant ---
    "informant_surname"             : (353, 372),
    "informant_other_names"         : (353, 395),
    "informant_relationship"        : (353, 412),
    "informant_contact_no"          : (353, 435),
    "informant_national_id"         : (353, 455),
    "informant_nationality"         : (353, 473),
    "informant_residential_address" : (353, 496),
    "informant_postal_address"      : (353, 537),
    "date_of_registration"          : (353, 577),

    # --- Informant's Declaration ---
    "informant_declaration_name"    : (36,  786),
    "informant_declaration_date"    : (644, 786),

    # --- For Official Use Only ---
    "assistant_registrar_name"      : (90,  881),
    "registrar_name"                : (90,  940),

    # --- System Appends ---
    "qr_code"                       : (24,  1001),
    "verify_code"                   : (24,  1072),
}

QR_SIZE = 100


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
    return "NOD" + str(uuid.uuid4().int)[:10]


def _generate_hash(data: dict, cert_no: str) -> str:
    raw = f"{cert_no}{data.get('surname','')}{data.get('date_of_death','')}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16].upper()


def _make_qr(cert_no: str, vhash: str) -> Image.Image:
    url = f"{VERIFY_BASE_URL}/{cert_no}?h={vhash}"
    qr  = qrcode.QRCode(version=1, box_size=3, border=1)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    return img.resize((QR_SIZE, QR_SIZE), Image.LANCZOS)


def _write(draw, coords, key, value, font, fill=(10, 10, 10)):
    if key in coords and value:
        draw.text(coords[key], str(value), font=font, fill=fill)


def _tick(draw, coords, key, condition, font, fill=(10, 10, 10)):
    """Write ✓ or — depending on boolean condition."""
    if key in coords:
        draw.text(coords[key], "✓" if condition else "—", font=font, fill=fill)


# ── Public API ─────────────────────────────────────────────────────────────

def generate_notice_of_death(notice_data: dict, output_pdf: str) -> tuple[str, str]:
    """
    Generate a Notice of Death PDF (two pages).

    Parameters
    ----------
    notice_data : dict
        Keys — Section A:
            serial_number, application_no, date_and_time,
            surname, district, other_names, occupation,
            residential_address, date_of_death, place_of_death,
            place_of_death_name, date_of_birth, age_at_death, sex,
            nationality, national_identity_no, social_security_no,
            education_level
        Keys — Section B (official use):
            death_type, immediate_cause, immediate_cause_icd,
            antecedent_cause, antecedent_cause_icd,
            underlying_cause, underlying_cause_icd
        Keys — Section C:
            police_certifier_name, police_certifier_residence,
            police_certifier_relationship, deceased_surname_police,
            deceased_other_names_police, deceased_age_police,
            passed_away_date, passed_away_time, passed_away_place,
            suddenly_suffering_from, treatment_was_at,
            is_natural_death (bool), is_sudden_death_postmortem (bool),
            police_no_and_rank, police_formation, police_officer_name,
            police_officer_date,
            doctors_remarks, pupils_dilated_and_fixed (bool),
            certifying_doctor_name, certifying_doctor_date
        Keys — Section D:
            informant_surname, informant_other_names,
            informant_relationship, informant_contact_no,
            informant_national_id, informant_nationality,
            informant_residential_address, informant_postal_address,
            date_of_registration
        Keys — Section E:
            has_mccd (bool), has_informant_national_id (bool),
            has_coroner_report (bool)
        Keys — Declaration:
            informant_declaration_name, informant_declaration_date
        Keys — Official:
            assistant_registrar_name, registrar_name

    output_pdf : str
        File path for the generated PDF.

    Returns
    -------
    (vhash, output_pdf) : tuple[str, str]
    """
    cert_no = _generate_cert_number()
    vhash   = _generate_hash(notice_data, cert_no)

    font_reg, font_bold, font_sn, font_tiny = _load_fonts()
    BLACK = (10,  10,  10)
    BLUE  = (0,   0,  180)
    GREY  = (120, 120, 120)
    g = notice_data.get

    # ── PAGE 1 ─────────────────────────────────────────────────────────────
    p1 = Image.open(TEMPLATE_PATH_P1).convert("RGB")
    d1 = ImageDraw.Draw(p1)

    # Header
    _write(d1, FIELD_COORDS_P1, "serial_number",  g("serial_number", cert_no[-8:]), font_sn,  BLUE)
    _write(d1, FIELD_COORDS_P1, "application_no", g("application_no", ""),          font_reg, BLACK)
    _write(d1, FIELD_COORDS_P1, "date_and_time",  g("date_and_time", ""),           font_reg, BLACK)

    # Section A
    _write(d1, FIELD_COORDS_P1, "surname",             g("surname","").upper(),     font_bold, BLACK)
    _write(d1, FIELD_COORDS_P1, "district",            g("district",""),            font_reg,  BLACK)
    _write(d1, FIELD_COORDS_P1, "other_names",         g("other_names","").upper(), font_bold, BLACK)
    _write(d1, FIELD_COORDS_P1, "occupation",          g("occupation","NIL"),       font_reg,  BLACK)
    _write(d1, FIELD_COORDS_P1, "residential_address", g("residential_address",""), font_reg,  BLACK)
    _write(d1, FIELD_COORDS_P1, "date_of_death",       g("date_of_death",""),       font_reg,  BLACK)
    _write(d1, FIELD_COORDS_P1, "place_of_death",      g("place_of_death",""),      font_reg,  BLACK)
    _write(d1, FIELD_COORDS_P1, "place_of_death_name", g("place_of_death_name",""), font_reg,  BLACK)
    _write(d1, FIELD_COORDS_P1, "date_of_birth",       g("date_of_birth",""),       font_reg,  BLACK)
    _write(d1, FIELD_COORDS_P1, "age_at_death",        str(g("age_at_death","")),   font_reg,  BLACK)
    _write(d1, FIELD_COORDS_P1, "sex",                 g("sex",""),                 font_reg,  BLACK)
    _write(d1, FIELD_COORDS_P1, "nationality",         g("nationality","ZAMBIAN"),  font_reg,  BLACK)
    _write(d1, FIELD_COORDS_P1, "national_identity_no",g("national_identity_no","NIL"), font_reg, BLACK)
    _write(d1, FIELD_COORDS_P1, "social_security_no",  g("social_security_no","NIL"),   font_reg, BLACK)
    _write(d1, FIELD_COORDS_P1, "education_level",     g("education_level",""),     font_reg,  BLACK)

    # Section B
    _write(d1, FIELD_COORDS_P1, "death_type",           g("death_type",""),           font_reg, BLACK)
    _write(d1, FIELD_COORDS_P1, "immediate_cause",      g("immediate_cause",""),      font_reg, BLACK)
    _write(d1, FIELD_COORDS_P1, "immediate_cause_icd",  g("immediate_cause_icd",""),  font_reg, BLACK)
    _write(d1, FIELD_COORDS_P1, "antecedent_cause",     g("antecedent_cause","NIL"),  font_reg, BLACK)
    _write(d1, FIELD_COORDS_P1, "antecedent_cause_icd", g("antecedent_cause_icd",""), font_reg, BLACK)
    _write(d1, FIELD_COORDS_P1, "underlying_cause",     g("underlying_cause","NIL"),  font_reg, BLACK)
    _write(d1, FIELD_COORDS_P1, "underlying_cause_icd", g("underlying_cause_icd",""), font_reg, BLACK)

    # Section C
    _write(d1, FIELD_COORDS_P1, "police_certifier_name",         g("police_certifier_name",""),         font_reg, BLACK)
    _write(d1, FIELD_COORDS_P1, "police_certifier_residence",    g("police_certifier_residence",""),    font_reg, BLACK)
    _write(d1, FIELD_COORDS_P1, "police_certifier_relationship", g("police_certifier_relationship",""), font_reg, BLACK)
    _write(d1, FIELD_COORDS_P1, "deceased_surname_police",       g("deceased_surname_police","").upper(),      font_bold, BLACK)
    _write(d1, FIELD_COORDS_P1, "deceased_other_names_police",   g("deceased_other_names_police","").upper(),  font_bold, BLACK)
    _write(d1, FIELD_COORDS_P1, "deceased_age_police",           str(g("deceased_age_police","")),      font_reg, BLACK)
    _write(d1, FIELD_COORDS_P1, "passed_away_date",              g("passed_away_date",""),              font_reg, BLACK)
    _write(d1, FIELD_COORDS_P1, "passed_away_time",              g("passed_away_time",""),              font_reg, BLACK)
    _write(d1, FIELD_COORDS_P1, "passed_away_place",             g("passed_away_place",""),             font_reg, BLACK)
    _write(d1, FIELD_COORDS_P1, "suddenly_suffering_from",       g("suddenly_suffering_from",""),       font_reg, BLACK)
    _write(d1, FIELD_COORDS_P1, "treatment_was_at",              g("treatment_was_at",""),              font_reg, BLACK)
    _write(d1, FIELD_COORDS_P1, "is_natural_death",
           "✓ YES" if g("is_natural_death", False) else "✓ NO",                                        font_reg, BLACK)
    _write(d1, FIELD_COORDS_P1, "is_sudden_death_postmortem",
           "✓ YES" if g("is_sudden_death_postmortem", False) else "—",                                 font_reg, BLACK)

    # ── PAGE 2 ─────────────────────────────────────────────────────────────
    p2 = Image.open(TEMPLATE_PATH_P2).convert("RGB")
    d2 = ImageDraw.Draw(p2)

    _write(d2, FIELD_COORDS_P2, "police_no_and_rank",  g("police_no_and_rank",""),  font_reg, BLACK)
    _write(d2, FIELD_COORDS_P2, "police_formation",    g("police_formation",""),    font_reg, BLACK)
    _write(d2, FIELD_COORDS_P2, "police_officer_name", g("police_officer_name",""), font_reg, BLACK)
    _write(d2, FIELD_COORDS_P2, "police_officer_date", g("police_officer_date",""), font_reg, BLACK)

    # Doctor's remarks
    _write(d2, FIELD_COORDS_P2, "doctors_remarks",        g("doctors_remarks",""),    font_reg, BLACK)
    _write(d2, FIELD_COORDS_P2, "pupils_dilated_and_fixed",
           "YES" if g("pupils_dilated_and_fixed", False) else "NO",                   font_reg, BLACK)
    _write(d2, FIELD_COORDS_P2, "certifying_doctor_name", g("certifying_doctor_name",""), font_reg, BLACK)
    _write(d2, FIELD_COORDS_P2, "certifying_doctor_date", g("certifying_doctor_date",""), font_reg, BLACK)

    # Section D
    _write(d2, FIELD_COORDS_P2, "informant_surname",             g("informant_surname","").upper(),     font_bold, BLACK)
    _write(d2, FIELD_COORDS_P2, "informant_other_names",         g("informant_other_names","").upper(), font_bold, BLACK)
    _write(d2, FIELD_COORDS_P2, "informant_relationship",        g("informant_relationship",""),        font_reg,  BLACK)
    _write(d2, FIELD_COORDS_P2, "informant_contact_no",          g("informant_contact_no",""),          font_reg,  BLACK)
    _write(d2, FIELD_COORDS_P2, "informant_national_id",         g("informant_national_id","NIL"),      font_reg,  BLACK)
    _write(d2, FIELD_COORDS_P2, "informant_nationality",         g("informant_nationality","ZAMBIAN"),  font_reg,  BLACK)
    _write(d2, FIELD_COORDS_P2, "informant_residential_address", g("informant_residential_address",""), font_reg,  BLACK)
    _write(d2, FIELD_COORDS_P2, "informant_postal_address",      g("informant_postal_address","NIL"),   font_reg,  BLACK)
    _write(d2, FIELD_COORDS_P2, "date_of_registration",          g("date_of_registration",""),          font_reg,  BLACK)

    # Section E — tick boxes
    _tick(d2, FIELD_COORDS_P2, "has_mccd",                  g("has_mccd", False),                  font_bold, BLACK)
    _tick(d2, FIELD_COORDS_P2, "has_informant_national_id", g("has_informant_national_id", False),  font_bold, BLACK)
    _tick(d2, FIELD_COORDS_P2, "has_coroner_report",        g("has_coroner_report", False),         font_bold, BLACK)

    # Declaration
    _write(d2, FIELD_COORDS_P2, "informant_declaration_name", g("informant_declaration_name",""), font_reg,  BLACK)
    _write(d2, FIELD_COORDS_P2, "informant_declaration_date", g("informant_declaration_date",""), font_reg,  BLACK)

    # Official use
    _write(d2, FIELD_COORDS_P2, "assistant_registrar_name", g("assistant_registrar_name",""), font_reg,  BLACK)
    _write(d2, FIELD_COORDS_P2, "registrar_name",           g("registrar_name",""),           font_bold, BLACK)

    # QR on page 2
    qr_img = _make_qr(cert_no, vhash)
    p2.paste(qr_img, FIELD_COORDS_P2["qr_code"])
    d2.text(FIELD_COORDS_P2["verify_code"], f"Verify: {vhash}", font=font_tiny, fill=GREY)

    # ── FIX: Export both pages with pixel-accurate page sizing ─────────────
    # Each page's dimensions in points = pixel dimensions × (72 pt/inch ÷ render DPI).
    # The Canvas is initialised with page 1's size; page 2 uses setPageSize()
    # so each page fits its template exactly with zero stretching.
    def _page_size(img: Image.Image) -> tuple[float, float]:
        w, h = img.size
        return w * PX_TO_PT, h * PX_TO_PT

    p1_w, p1_h = _page_size(p1)
    p2_w, p2_h = _page_size(p2)

    c = rl_canvas.Canvas(output_pdf, pagesize=(p1_w, p1_h))

    for page_img, (pw, ph) in [(p1, (p1_w, p1_h)), (p2, (p2_w, p2_h))]:
        c.setPageSize((pw, ph))
        buf = BytesIO()
        page_img.save(buf, format="PNG", dpi=(TEMPLATE_DPI, TEMPLATE_DPI))
        buf.seek(0)
        c.drawImage(
            ImageReader(buf),
            x=0, y=0,
            width=pw, height=ph,
            preserveAspectRatio=True,   # safety net — redundant but harmless
            mask="auto",
        )
        c.showPage()

    c.save()
    return vhash, output_pdf


# ── Quick test ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    sample = {
        "serial_number"                 : "NOD-004821",
        "date_and_time"                 : "27-04-2026  09:30",
        "surname"                       : "MWANSA",
        "district"                      : "LUSAKA",
        "other_names"                   : "PETER CHANDA",
        "occupation"                    : "TEACHER",
        "residential_address"           : "PLOT 22, GARDEN COMPOUND, LUSAKA",
        "date_of_death"                 : "25-04-2026",
        "place_of_death"                : "HEALTH FACILITY",
        "place_of_death_name"           : "UNIVERSITY TEACHING HOSPITAL",
        "date_of_birth"                 : "12-06-1961",
        "age_at_death"                  : 64,
        "sex"                           : "M",
        "nationality"                   : "ZAMBIAN",
        "national_identity_no"          : "278945/67/1",
        "social_security_no"            : "NAPSA-114432",
        "education_level"               : "SECONDARY",
        "death_type"                    : "HEALTH FACILITY",
        "immediate_cause"               : "ACUTE MYOCARDIAL INFARCTION",
        "immediate_cause_icd"           : "I21.9",
        "antecedent_cause"              : "CORONARY ARTERY DISEASE",
        "antecedent_cause_icd"          : "I25.1",
        "underlying_cause"              : "HYPERTENSION",
        "underlying_cause_icd"          : "I10",
        "is_natural_death"              : True,
        "is_sudden_death_postmortem"    : False,
        "informant_surname"             : "MWANSA",
        "informant_other_names"         : "GRACE",
        "informant_relationship"        : "SPOUSE",
        "informant_contact_no"          : "0977001122",
        "informant_national_id"         : "234100/78/1",
        "informant_nationality"         : "ZAMBIAN",
        "informant_residential_address" : "PLOT 22, GARDEN COMPOUND, LUSAKA",
        "date_of_registration"          : "27-04-2026",
        "has_mccd"                      : True,
        "has_informant_national_id"     : True,
        "has_coroner_report"            : False,
        "informant_declaration_name"    : "GRACE MWANSA",
        "informant_declaration_date"    : "27-04-2026",
        "assistant_registrar_name"      : "MUTALE CHIPIMO",
        "registrar_name"                : "GETRUDE NAWILA",
    }

    vhash, path = generate_notice_of_death(sample, os.path.join(os.path.dirname(__file__), "..", "..", "media", "test_notice_of_death.pdf"))
    print(f"Notice of Death generated → {path}")
    print(f"Verify hash               : {vhash}")
