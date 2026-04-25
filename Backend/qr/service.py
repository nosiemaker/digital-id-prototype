"""
QR Code Generation Service
==========================

What this module does:
- Generates a signed QR payload for a citizen
- Provides a verify() function usable server-side (testing, admin tools)
- The mobile verifier app calls verify() logic locally — no server roundtrip

QR Payload structure:
    {
        "din":   "ZM000000001A",      # identity anchor — what gets signed
        "name":  "Mwamba Chanda",     # display only — NOT signed
        "nonce": "a3f8b2c1...",       # 16-byte hex, replay protection
        "exp":   1745000000,          # unix timestamp (int, not ISO string)
        "sig":   "IWc_iA..."          # base64url ECDSA signature over din+nonce+exp
    }

What the signature covers:
    canonical = f"{din}.{nonce}.{exp}"   — simple, deterministic, no JSON parsing needed
    signed with ECDSA P-256 + SHA-256 using the server private key

Why a dot-delimited string instead of JSON for the signed bytes:
    - Smaller — no JSON overhead
    - Unambiguous — no key ordering issues
    - Easy to reconstruct on mobile (Kotlin/Swift one-liner)
    - No risk of whitespace/encoding differences between implementations

QR lifetime:
    Default 5 minutes (300 seconds). Short enough to prevent replay attacks,
    long enough for a verifier to scan in a real-world scenario.
    Configurable via ZDID_QR_TTL_SECONDS in .env.

Offline verification flow (mobile verifier):
    1. Scan QR → decode JSON
    2. Check exp > now() — reject if expired
    3. Reconstruct signed_bytes = f"{din}.{nonce}.{exp}".encode()
    4. base64url-decode sig → raw 64 bytes → split r (first 32) + s (last 32)
    5. Encode r,s back to DER
    6. Verify DER signature against signed_bytes using cached server public key
    7. If valid → display name + DIN as verified identity
"""

from __future__ import annotations

import base64
import logging
import os
import time

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import (
    decode_dss_signature,
    encode_dss_signature,
)
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from citizens.models import Citizen, CitizenStatus

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def _get_ttl() -> int:
    """QR code lifetime in seconds. Default 5 minutes."""
    try:
        return int(getattr(settings, "ZDID_QR_TTL_SECONDS", 300))
    except (ValueError, TypeError):
        return 300


# ---------------------------------------------------------------------------
# Key loading — reuse server signing key from digital_id service
# We load it independently here so qr/ has no import dependency on digital_id/
# ---------------------------------------------------------------------------

def _load_private_key() -> ec.EllipticCurvePrivateKey:
    pem: str = getattr(settings, "ZDID_SIGNING_PRIVATE_KEY", None)
    if not pem:
        raise ImproperlyConfigured("ZDID_SIGNING_PRIVATE_KEY is not set.")

    if isinstance(pem, str) and os.path.isfile(pem):
        with open(pem, "rb") as f:
            key_data = f.read()
    elif isinstance(pem, str):
        key_data = pem.replace('\\n', '\n').encode('utf-8')
    else:
        key_data = pem

    try:
        key = serialization.load_pem_private_key(key_data, password=None)
    except Exception as exc:
        raise ImproperlyConfigured(f"ZDID_SIGNING_PRIVATE_KEY invalid: {exc}") from exc
    return key


def _load_public_key() -> ec.EllipticCurvePublicKey:
    pem: str = getattr(settings, "ZDID_SIGNING_PUBLIC_KEY", None)
    if not pem:
        raise ImproperlyConfigured("ZDID_SIGNING_PUBLIC_KEY is not set.")

    if isinstance(pem, str) and os.path.isfile(pem):
        with open(pem, "rb") as f:
            key_data = f.read()
    elif isinstance(pem, str):
        key_data = pem.replace('\\n', '\n').encode('utf-8')
    else:
        key_data = pem

    try:
        return serialization.load_pem_public_key(key_data)
    except Exception as exc:
        raise ImproperlyConfigured(f"ZDID_SIGNING_PUBLIC_KEY invalid: {exc}") from exc


# ---------------------------------------------------------------------------
# Core signing helpers
# ---------------------------------------------------------------------------

def _make_nonce() -> str:
    """16 cryptographically random bytes as lowercase hex (32 chars)."""
    return os.urandom(16).hex()


def _signed_bytes(din: str, nonce: str, exp: int) -> bytes:
    """
    Canonical byte string that the signature covers.
    Format: "{din}.{nonce}.{exp}"

    This exact format must be reproduced by the mobile verifier.
    Simple, unambiguous, no JSON parsing required.
    """
    return f"{din}.{nonce}.{exp}".encode()


def _sign(din: str, nonce: str, exp: int) -> str:
    """
    Sign din+nonce+exp, return base64url signature (no padding).
    IEEE P1363 format: 32 bytes r + 32 bytes s.
    """
    data = _signed_bytes(din, nonce, exp)
    der_sig = _SIGNING_KEY.sign(data, ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(der_sig)
    raw_sig = r.to_bytes(32, "big") + s.to_bytes(32, "big")
    return base64.urlsafe_b64encode(raw_sig).rstrip(b"=").decode()


def _verify_signature(din: str, nonce: str, exp: int, sig: str) -> bool:
    """
    Verify a QR signature. Returns True if valid, False if invalid.
    Never raises — all exceptions are caught and logged.
    """
    try:
        # Decode base64url → raw 64 bytes → r, s integers → DER
        padding = "=" * (4 - len(sig) % 4) if len(sig) % 4 else ""
        raw_sig = base64.urlsafe_b64decode(sig + padding)

        if len(raw_sig) != 64:
            logger.warning("QR verify: invalid signature length %d", len(raw_sig))
            return False

        r = int.from_bytes(raw_sig[:32], "big")
        s = int.from_bytes(raw_sig[32:], "big")
        der_sig = encode_dss_signature(r, s)

        data = _signed_bytes(din, nonce, exp)
        _VERIFY_KEY.verify(der_sig, data, ec.ECDSA(hashes.SHA256()))
        return True

    except InvalidSignature:
        return False
    except Exception:
        logger.exception("QR verify: unexpected error during signature check")
        return False


# ---------------------------------------------------------------------------
# Public exceptions
# ---------------------------------------------------------------------------

class QRGenerationError(Exception):
    """Base for errors raised by this service."""


class CitizenNotFoundError(QRGenerationError):
    pass


class CitizenNotActiveError(QRGenerationError):
    def __init__(self, din: str, status: str):
        self.din = din
        self.status = status
        super().__init__(f"Citizen {din} is not ACTIVE (status: {status})")


class QRExpiredError(Exception):
    """Raised by verify_qr when the QR has expired."""


class QRInvalidSignatureError(Exception):
    """Raised by verify_qr when the signature does not verify."""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_qr_payload(din: str) -> dict:
    """
    Generate a signed QR payload for the citizen with the given DIN.

    Steps:
      1. Fetch citizen — CitizenNotFoundError if not found
      2. Guard: must be ACTIVE — CitizenNotActiveError otherwise
      3. Generate nonce + expiry
      4. Sign din + nonce + exp
      5. Return payload dict (ready to encode as JSON for QR)

    Args:
        din: 12-character citizen DIN

    Returns:
        dict with keys: din, name, nonce, exp, sig

    Raises:
        CitizenNotFoundError
        CitizenNotActiveError
    """
    # 1. Fetch
    try:
        citizen = Citizen.objects.get(din=din)
    except Citizen.DoesNotExist:
        raise CitizenNotFoundError(f"No citizen found with DIN: {din}")

    # 2. Status guard
    if citizen.status != CitizenStatus.ACTIVE:
        raise CitizenNotActiveError(din=din, status=citizen.status)

    # 3. Nonce + expiry
    nonce = _make_nonce()
    exp = int(time.time()) + _get_ttl()

    # 4. Sign
    sig = _sign(din, nonce, exp)

    logger.info("QR payload generated for DIN: %s (exp: %d)", din, exp)

    # 5. Return — name is display-only, not part of the signed bytes
    return {
        "din": citizen.din,
        "name": citizen.full_name,
        "nonce": nonce,
        "exp": exp,
        "sig": sig,
    }


def verify_qr_payload(din: str, nonce: str, exp: int, sig: str) -> dict:
    """
    Verify a scanned QR payload server-side.

    This mirrors the logic the mobile verifier runs offline.
    Use this for testing, admin tools, or any server-side scanning scenario.

    Steps:
      1. Check expiry — QRExpiredError if exp < now
      2. Verify signature — QRInvalidSignatureError if invalid

    Args:
        din:   DIN from the scanned QR
        nonce: nonce from the scanned QR
        exp:   expiry unix timestamp from the scanned QR
        sig:   base64url signature from the scanned QR

    Returns:
        dict with verified=True, din, and the citizen's current status

    Raises:
        QRExpiredError
        QRInvalidSignatureError
    """
    # 1. Expiry check
    now = int(time.time())
    if exp < now:
        seconds_ago = now - exp
        raise QRExpiredError(f"QR expired {seconds_ago}s ago.")

    # 2. Signature check
    if not _verify_signature(din, nonce, exp, sig):
        raise QRInvalidSignatureError("QR signature is invalid.")

    logger.info("QR verified for DIN: %s", din)

    return {
        "verified": True,
        "din": din,
        "expires_in_seconds": exp - now,
    }
