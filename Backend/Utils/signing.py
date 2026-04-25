from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

def load_private_key() -> ec.EllipticCurvePrivateKey:
    pem = getattr(settings, "ZDID_SIGNING_PRIVATE_KEY", None)
    if not pem:
        raise ImproperlyConfigured("ZDID_SIGNING_PRIVATE_KEY is not set.")
    try:
        key = serialization.load_pem_private_key(
            pem.encode() if isinstance(pem, str) else pem,
            password=None,
        )
    except Exception as exc:
        raise ImproperlyConfigured(f"ZDID_SIGNING_PRIVATE_KEY invalid: {exc}") from exc
    if not isinstance(key, ec.EllipticCurvePrivateKey):
        raise ImproperlyConfigured("ZDID_SIGNING_PRIVATE_KEY must be an ECDSA key.")
    if not isinstance(key.curve, ec.SECP256R1):
        raise ImproperlyConfigured(f"Must use P-256, got: {key.curve.name}")
    return key

def load_public_key_pem() -> ec.EllipticCurvePublicKey:
    pem = getattr(settings, "ZDID_SIGNING_PUBLIC_KEY", None)
    if not pem:
        raise ImproperlyConfigured("ZDID_SIGNING_PUBLIC_KEY is not set.")
    return pem.strip()

def load_public_key() -> ec.EllipticCurvePublicKey:
    pem = load_public_key_pem()
    try:
        return load_pem_public_key(pem.encode() if isinstance(pem, str) else pem)
    except Exception as exc:
        raise ImproperlyConfigured(f"ZDID_SIGNING_PUBLIC_KEY invalid: {exc}") from exc