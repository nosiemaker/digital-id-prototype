"""
burial_permit_generator.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Zambia Digital ID System — Civil Registration Module
Generates the Permit for Burial or Other Disposal of a Body
(Form XI — Rules 30 and 37) as a PDF by overlaying data onto
the official DNRPC template.

Dependencies:
    pip install Pillow qrcode reportlab

Usage:
    from burial_permit_generator import generate_burial_permit

    vhash, output_path = generate_burial_permit(permit_data, "output.pdf")
"""

from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.utils import ImageReader
import qrcode
import hashlib
import uuid
import os
from io import BytesIO


# ── Configuration ──────────────────────────────────────────────────────────

TEMPLATE_PATH   = os.path.join(os.path.dirname(__file__), "..", "..", "media", "DEATH PERMIT TEMPLATE.png")
VERIFY_BASE_URL = "https://zdid.gov.zm/verify/burial-permit"
FONT_REGULAR    = "C:\\Windows\\Fonts\\arial.ttf"
FONT_BOLD       = "C:\\Windows\\Fonts\\arialbd.ttf"
FONT_SIZE       = 20
FONT_SIZE_SERIAL = 22
FONT_SIZE_TINY  = 10

# Template dimensions: 864 × 1212 px
# Form XI is mostly free-text narrative with a few fill-in blanks.
# Coordinates target the blank lines in the authorisation paragraph.

FIELD_COORDS = {
    # --- Reference (top right) ---
    "permit_number"             : (106,  78),   # internal permit number

    # --- Authorisation Paragraph ---
    "authorised_by_name"        : (242, 564),
    "deceased_name"             : (242, 595),
    "place_of_death"            : (856, 595),
    "death_day"                 : (246, 625),
    "death_month"               : (449, 625),
    "death_year"                : (760, 625),

    # --- Issuing Authority (bottom right) ---
    "issuing_authority"         : (820, 740),
    "issuing_officer_name"      : (675, 755),
    "issued_date"               : (1050, 755),

    # --- System Appends ---
    "qr_code"                   : (60,  1090),
    "verify_code"               : (60,  1195),
}

QR_SIZE = 100

# Native template pixel dimensions — used to set PDF page size so there is
# zero stretching.  ReportLab uses 72 dpi points; we render the template at
# 200 dpi, so 1 pt = 200/72 px.
TEMPLATE_DPI    = 200
PT_PER_INCH     = 72
PX_TO_PT        = PT_PER_INCH / TEMPLATE_DPI   # 0.36  pt per pixel


# ── Internal helpers ───────────────────────────────────────────────────────

def _load_fonts():
    try:
        return (
            ImageFont.truetype(FONT_REGULAR,  FONT_SIZE),
            ImageFont.truetype(FONT_BOLD,     FONT_SIZE),
            ImageFont.truetype(FONT_BOLD,     FONT_SIZE_SERIAL),
            ImageFont.truetype(FONT_REGULAR,  FONT_SIZE_TINY),
        )
    except OSError:
        d = ImageFont.load_default()
        return d, d, d, d


def _generate_permit_number() -> str:
    return "BPX" + str(uuid.uuid4().int)[:10]


def _generate_hash(data: dict, permit_no: str) -> str:
    raw = f"{permit_no}{data.get('deceased_name','')}{data.get('death_day','')}{data.get('death_month','')}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16].upper()


def _make_qr(permit_no: str, vhash: str) -> Image.Image:
    url = f"{VERIFY_BASE_URL}/{permit_no}?h={vhash}"
    qr  = qrcode.QRCode(version=1, box_size=3, border=1)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    return img.resize((QR_SIZE, QR_SIZE), Image.LANCZOS)


def _write_field(draw, key, value, font, fill=(10, 10, 10)):
    if key in FIELD_COORDS and value:
        draw.text(FIELD_COORDS[key], str(value), font=font, fill=fill)


# ── Public API ─────────────────────────────────────────────────────────────

def generate_burial_permit(permit_data: dict, output_pdf: str) -> tuple[str, str]:
    """
    Generate a Burial Permit (Form XI) PDF.

    Parameters
    ----------
    permit_data : dict
        Keys:
            authorised_by_name   — person/entity authorised to carry out burial
            deceased_name        — full name of the deceased
            place_of_death       — where the deceased died
            death_day            — day of death (integer or string)
            death_month          — month of death (e.g. "APRIL")
            death_year           — last two digits of year (e.g. "26")
            issuing_authority    — "REGISTRAR" | "MAGISTRATE" | "POLICE" | "OTHER"
            issuing_officer_name — name of the signing officer
            issued_date          — date the permit was issued

    output_pdf : str
        File path for the generated PDF.

    Returns
    -------
    (vhash, output_pdf) : tuple[str, str]
    """
    permit_no = _generate_permit_number()
    vhash     = _generate_hash(permit_data, permit_no)

    template = Image.open(TEMPLATE_PATH).convert("RGB")
    img_w_px, img_h_px = template.size          # e.g. 864 × 1212

    draw     = ImageDraw.Draw(template)
    font_reg, font_bold, font_sn, font_tiny = _load_fonts()

    BLACK = (10,  10,  10)
    BLUE  = (0,   0,  180)
    GREY  = (120, 120, 120)

    g = permit_data.get

    _write_field(draw, "permit_number",       permit_no,                              font_sn,   BLUE)
    _write_field(draw, "authorised_by_name",  g("authorised_by_name", ""),            font_reg,  BLACK)
    _write_field(draw, "deceased_name",       g("deceased_name", "").upper(),         font_bold, BLACK)
    _write_field(draw, "place_of_death",      g("place_of_death", ""),               font_reg,  BLACK)
    _write_field(draw, "death_day",           str(g("death_day", "")),               font_reg,  BLACK)
    _write_field(draw, "death_month",         g("death_month", "").upper(),           font_reg,  BLACK)
    _write_field(draw, "death_year",          str(g("death_year", "")),              font_reg,  BLACK)

    authority_label = {
        "REGISTRAR"  : "*Registrar",
        "MAGISTRATE" : "Magistrate",
        "POLICE"     : "Police Officer",
        "OTHER"      : "Other officer specially empowered",
    }.get(g("issuing_authority", "REGISTRAR"), "*Registrar")

    _write_field(draw, "issuing_officer_name", g("issuing_officer_name", ""),         font_reg,  BLACK)
    _write_field(draw, "issued_date",         g("issued_date", ""),                  font_reg,  BLACK)

    # QR + hash
    qr_img = _make_qr(permit_no, vhash)
    template.paste(qr_img, FIELD_COORDS["qr_code"])
    draw.text(FIELD_COORDS["verify_code"], f"Verify: {vhash}", font=font_tiny, fill=GREY)

    # ── FIX: Save PNG then size the PDF page to EXACTLY match the image ──
    # Convert pixel dimensions → ReportLab points using the render DPI.
    # This guarantees 1:1 mapping with no stretching in either axis.
    page_w_pt = img_w_px * PX_TO_PT   # e.g. 864 * 0.36 = 311.04 pt
    page_h_pt = img_h_px * PX_TO_PT   # e.g. 1212 * 0.36 = 436.32 pt

    buf = BytesIO()
    template.save(buf, format="PNG", dpi=(TEMPLATE_DPI, TEMPLATE_DPI))
    buf.seek(0)

    c = rl_canvas.Canvas(output_pdf, pagesize=(page_w_pt, page_h_pt))

    # Draw image at (0, 0) with width/height = page size.
    # Because page IS the same aspect ratio as the image, nothing stretches.
    c.drawImage(
        ImageReader(buf),
        x=0, y=0,
        width=page_w_pt,
        height=page_h_pt,
        preserveAspectRatio=True,   # safety net — now redundant but harmless
        mask="auto",
    )
    c.save()

    return vhash, output_pdf


# ── Quick test ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    sample = {
        "authorised_by_name"    : "GARDEN MEMORIAL FUNERAL SERVICES",
        "deceased_name"         : "PETER CHANDA MWANSA",
        "place_of_death"        : "UTH, LUSAKA",
        "death_day"             : "25",
        "death_month"           : "APRIL",
        "death_year"            : "26",
        "issuing_authority"     : "REGISTRAR",
        "issuing_officer_name"  : "GETRUDE NAWILA",
        "issued_date"           : "27-04-2026",
    }

    vhash, path = generate_burial_permit(sample, os.path.join(os.path.dirname(__file__), "..", "..", "media", "test_burial_permit.pdf"))
    print(f"Burial Permit generated → {path}")
    print(f"Verify hash             : {vhash}")
