"""digital_id/service.py — Digital ID Packaging Service
=====================================================

Responsibilities:
- Load the server ECDSA P-256 signing key once at startup
- Build a canonical identity payload from a Citizen record
- Sign the payload and return a DigitalIDPayload

Signing key lifecycle:
- Private key lives in .env as ZDID_SIGNING_PRIVATE_KEY (PEM string)
- Public key lives in .env as ZDID_SIGNING_PUBLIC_KEY (PEM string)
- Both are loaded once into module-level constants at import time
- A missing or malformed key raises ImproperlyConfigured at startup,
  not at request time — so bad config is caught immediately.

Signature format:
- Payload is serialised as canonical JSON (sorted keys, no whitespace)
- Signed with ECDSA P-256 + SHA-256
- Signature is base64url-encoded (no padding) — safe to embed in JSON
"""

from __future__ import annotations

import base64
import json
import logging
import os
from datetime import datetime, timezone

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import (
    decode_dss_signature,
)
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from citizens.models import Citizen, CitizenStatus
from citizens.schema import DigitalIDPayload

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Key loading — happens once at import time
# ---------------------------------------------------------------------------

def _load_private_key() -> ec.EllipticCurvePrivateKey:
    """
    Load the server ECDSA P-256 private key from Django settings.
    Settings reads it from ZDID_SIGNING_PRIVATE_KEY in .env.

    Raises ImproperlyConfigured if the key is missing or not a valid
    PEM-encoded ECDSA P-256 private key.
    """
    pem: str = getattr(settings, "ZDID_SIGNING_PRIVATE_KEY", None)
    if not pem:
        raise ImproperlyConfigured(
            "ZDID_SIGNING_PRIVATE_KEY is not set. "
            "Generate a key with: "
            "openssl ecparam -name prime256v1 -genkey -noout -out key.pem"
        )

    if isinstance(pem, str) and os.path.isfile(pem):
        with open(pem, "rb") as key_file:
            key_data = key_file.read()
    elif isinstance(pem, str):
        key_data = pem.replace('\\n', '\n').encode('utf-8')
    else:
        key_data = pem

    try:
        key = serialization.load_pem_private_key(
            key_data,
            password=None,
        )
    except Exception as exc:
        raise ImproperlyConfigured(
            f"ZDID_SIGNING_PRIVATE_KEY is not a valid PEM private key: {exc}"
        ) from exc

    if not isinstance(key, ec.EllipticCurvePrivateKey):
        raise ImproperlyConfigured(
            "ZDID_SIGNING_PRIVATE_KEY must be an ECDSA key (EC), not RSA or other."
        )
    if not isinstance(key.curve, ec.SECP256R1):
        raise ImproperlyConfigured(
            f"ZDID_SIGNING_PRIVATE_KEY must use curve P-256 (prime256v1), "
            f"got: {key.curve.name}"
        )

    return key


def _load_public_key_pem() -> str:
    """
    Load the server public key PEM from Django settings.
    Included in the DigitalIDPayload so verifiers can confirm the signature
    without needing a separate key-distribution endpoint.
    """
    pem: str = getattr(settings, "ZDID_SIGNING_PUBLIC_KEY", None)
    if not pem:
        raise ImproperlyConfigured(
            "ZDID_SIGNING_PUBLIC_KEY is not set. "
            "Export it with: openssl ec -in key.pem -pubout -out pubkey.pem"
        )
    if isinstance(pem, str) and os.path.isfile(pem):
        with open(pem, "r") as key_file:
            return key_file.read().strip()

    return pem.replace('\\n', '\n').strip()


# Module-level singletons — loaded once, reused for every request
try:
    _SIGNING_KEY: ec.EllipticCurvePrivateKey = _load_private_key()
    _SERVER_PUBLIC_KEY_PEM: str = _load_public_key_pem()
    logger.info("ZDID signing key loaded successfully.")
except ImproperlyConfigured:
    # Re-raise so the app fails fast at startup, not silently mid-request
    raise


# ---------------------------------------------------------------------------
# Payload builder
# ---------------------------------------------------------------------------

def _build_canonical_payload(citizen: Citizen, issued_at: datetime) -> dict:
    """
    Build the exact dict that will be serialised for signing.

    Rules:
    - All values must be JSON-serialisable primitives (str, not date/datetime)
    - Keys are sorted when serialised — callers must not rely on insertion order
    - issued_at is passed in (not generated inside) so the same timestamp
      appears in both the signed bytes and the response body
    """
    return {
        "din": citizen.din,
        "dob": citizen.dob.isoformat(),          # "YYYY-MM-DD"
        "full_name": citizen.full_name,
        "issued_at": issued_at.isoformat(),       # "YYYY-MM-DDTHH:MM:SS+00:00"
        "nrc": citizen.nrc,
        "public_key": citizen.public_key,         # citizen's device key
        "status": citizen.status,
    }


def _sign_payload(payload: dict) -> str:
    """
    Serialise payload to canonical JSON, sign with ECDSA P-256 + SHA-256,
    return the signature as a base64url string (no padding).

    The signature covers exactly the bytes that a verifier will reconstruct
    from the same payload fields — deterministic because keys are sorted.
    """
    canonical_bytes = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()

    # DER-encoded signature from cryptography library
    der_signature = _SIGNING_KEY.sign(canonical_bytes, ec.ECDSA(hashes.SHA256()))

    # Decode DER → raw (r, s) integers → fixed 64-byte P-256 format
    # This is the IEEE P1363 format: 32 bytes r + 32 bytes s
    # More compact and interoperable with mobile SDKs than DER
    r, s = decode_dss_signature(der_signature)
    raw_sig = r.to_bytes(32, "big") + s.to_bytes(32, "big")

    return base64.urlsafe_b64encode(raw_sig).rstrip(b"=").decode()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

class DigitalIDError(Exception):
    """Base for errors raised by this service."""


class CitizenNotFoundError(DigitalIDError):
    pass


class CitizenNotActiveError(DigitalIDError):
    """Raised when the citizen exists but is not ACTIVE."""
    def __init__(self, din: str, status: str):
        self.din = din
        self.status = status
        super().__init__(f"Citizen {din} is not ACTIVE (current status: {status})")


def build_digital_id(din: str) -> DigitalIDPayload:
    """
    Build and sign a DigitalIDPayload for the given DIN.

    Steps:
      1. Fetch citizen — raises CitizenNotFoundError if not found
      2. Guard: must be ACTIVE — raises CitizenNotActiveError otherwise
      3. Build canonical payload
      4. Sign payload
      5. Return DigitalIDPayload

    Args:
        din: The citizen's 12-character DIN

    Returns:
        DigitalIDPayload — ready to serialise and return from the route

    Raises:
        CitizenNotFoundError: DIN does not exist in the database
        CitizenNotActiveError: Citizen exists but is PENDING/SUSPENDED/DECEASED
    """
    # 1. Fetch
    try:
        citizen = Citizen.objects.get(din=din)
    except Citizen.DoesNotExist:
        raise CitizenNotFoundError(f"No citizen found with DIN: {din}")

    # 2. Status guard — only ACTIVE citizens get a Digital ID
    if citizen.status != CitizenStatus.ACTIVE:
        raise CitizenNotActiveError(din=din, status=citizen.status)

    # 3. Build payload (issued_at pinned to now, UTC)
    issued_at = datetime.now(timezone.utc)
    payload = _build_canonical_payload(citizen, issued_at)

    # 4. Sign
    signature = _sign_payload(payload)

    logger.info("Digital ID issued for DIN: %s", din)

    # 5. Return schema
    return DigitalIDPayload(
        din=citizen.din,
        full_name=citizen.full_name,
        nrc=citizen.nrc,
        dob=citizen.dob,
        status=citizen.status,
        public_key=citizen.public_key,
        issued_at=issued_at,
        signature=signature,
    )


def get_server_public_key() -> str:
    """
    Return the server's PEM public key.
    Exposed via GET /digital-id/server-public-key so mobile clients and
    third parties can verify Digital ID signatures without out-of-band key exchange.
    """
    return _SERVER_PUBLIC_KEY_PEM
