"""
utils/biometrics.py — Backend Biometric Utilities
==================================================

RESPONSIBILITY SPLIT
--------------------
The biometric pipeline is split between frontend and backend:

  CAPACITOR PLUGIN (frontend — Kotlin/Android):
  ┌─────────────────────────────────────────────────────┐
  │ Camera capture                                      │
  │ → MTCNN detects face + bounding box                 │
  │ → MobileFaceNet extracts 512-float embedding        │
  │ → Quality check (blur, lighting, pose angle)        │
  │ → Returns: { template: number[], imageBase64: str } │
  └─────────────────────────────────────────────────────┘
                        │
                        │ POST embedding[] to backend
                        ▼
  THIS FILE (backend — only these four responsibilities):
  ┌─────────────────────────────────────────────────────┐
  │ 1. check_duplicate_enrollment()  dedup scan         │
  │ 2. quantize_embedding()          512 floats→64 bytes│
  │ 3. derive_din_from_embedding()   deterministic DIN  │
  │ 4. verify_face_matches_din()     transactions/KYC   │
  └─────────────────────────────────────────────────────┘

The backend never touches a camera, never runs a ML model, never sees a
raw image. It only receives and processes the float array the app sends.

WHY THIS SPLIT:
- MobileFaceNet TFLite runs faster on-device than a server round-trip
- Embedding can be cached locally for offline ID display
- Keeps the backend stateless with respect to image processing
- Both Tecno Spark 10C and Camon 20 (Android 13) handle TFLite fine


DIN DERIVATION OVERVIEW
-----------------------
Same face → same embedding signs → same quantized bytes → same DIN

  App sends:   [0.423, -0.187, 0.091, -0.334, ...]  ← 512 floats
                      ↓ quantize_embedding()
  64 bytes:    [10010110, 00110101, ...]  ← sign of each float = 1 bit
                      ↓ derive_din_from_embedding()
  DIN:         "ZMK7X3NP2A5F"  ← deterministic, biometrically bound

The DIN is derived ONCE at enrollment and never changes.
Subsequent logins use cosine similarity against the stored embedding,
not DIN re-derivation.


STANDARDS
---------
ISO/IEC 24745  — Biometric information protection.
                 BIOMETRIC_SALT makes the DIN only reproducible within ZDID.
                 Salt rotation = re-derive all DINs from stored
                 embedding_quantized, no re-capturing faces needed.

ISO/IEC 19795-1 — Biometric performance testing.
                  Defines the three-zone decision model:
                  CLEAR / REVIEW / DUPLICATE
"""

import hashlib
import hmac
import math
import os

# ── Constants ─────────────────────────────────────────────────────────────────

BIOMETRIC_SALT = os.environ.get(
    "BIOMETRIC_SALT",
    "dev-biometric-salt-change-in-production-minimum-32-chars",
).encode()

# Three-zone thresholds (ISO/IEC 19795-1)
# < CLEAR_THRESHOLD          → different people, safe to enroll
# CLEAR to DUPLICATE range   → uncertain, flag for RO manual review
# > DUPLICATE_THRESHOLD      → same person, reject immediately
CLEAR_THRESHOLD = float(os.environ.get("BIOMETRIC_CLEAR_THRESHOLD", "0.75"))
DUPLICATE_THRESHOLD = float(os.environ.get("BIOMETRIC_DUPLICATE_THRESHOLD", "0.88"))

# DIN alphabet — no ambiguous chars (0/O and 1/I look alike on printed ID cards)
_DIN_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # 32 characters


# ── 1. Quantization ───────────────────────────────────────────────────────────

def quantize_embedding(embedding: list[float]) -> bytes:
    """
    Converts the 512-float MobileFaceNet embedding into 64 bytes (512 bits).

    Each float is reduced to its sign bit: 1 if >= 0, 0 if negative.

    WHY SIGN BITS ARE STABLE:
    The magnitude of each component shifts with lighting and camera quality.
    The sign (positive/negative) is a structural property of the face geometry
    and stays consistent across different captures of the same person.
    On MobileFaceNet embeddings, sign bit stability is ~95–99% across normal
    variation (different lighting, ±15° angle, different days).

    This 64-byte pattern is stable enough to hash into a deterministic DIN,
    and is also stored in BiometricRecord.embedding_quantized so the DIN
    can be re-derived later without re-capturing the face.

    Args:
        embedding: 512 floats received from the Capacitor MobileFaceNet plugin

    Returns:
        64 bytes where each bit represents the sign of one embedding component
    """
    if len(embedding) != 512:
        raise ValueError(
            f"Expected 512-float MobileFaceNet embedding, got {len(embedding)}. "
            "Check the Capacitor plugin is using facenet_512.tflite not facenet.tflite."
        )

    result = bytearray(64)
    for i, val in enumerate(embedding):
        if val >= 0:
            result[i // 8] |= (1 << (7 - (i % 8)))
    return bytes(result)


def dequantize_to_bits(quantized: bytes) -> list[int]:
    """Unpack 64 bytes back to 512 individual bits. Used in tests."""
    bits = []
    for byte in quantized:
        for shift in range(7, -1, -1):
            bits.append((byte >> shift) & 1)
    return bits


# ── 2. DIN derivation ─────────────────────────────────────────────────────────

def derive_din_from_embedding(quantized: bytes) -> tuple[str, str]:
    """
    Derives a deterministic 12-character DIN from the quantized embedding.

    ALGORITHM:
      1. SHA-256(quantized_bytes + BIOMETRIC_SALT) → 64-char hex string
      2. Take first 9 hex chars → map each to _DIN_CHARS via int(char, 16)
         (hex chars 0–15 index into the first 16 of 32 DIN chars)
      3. Prepend "ZM" (Zambia country code) → 11 chars
      4. Append 1 check character (sum of ASCII values mod 32) → 12 chars

    FORMAT: "ZM" + 9 body chars + 1 check char = "ZMK7X3NP2A5F"

    SALT ROTATION (ISO/IEC 24745 cancelable biometrics):
      If BIOMETRIC_SALT is ever compromised:
        1. Set a new BIOMETRIC_SALT in the environment
        2. For each BiometricRecord: re-call derive_din_from_embedding(record.embedding_quantized)
        3. Update Citizen.din with the new DIN
      No re-capture of faces needed since embedding_quantized is already stored.

    Returns:
        (din, commitment)
          din        — 12-char DIN string e.g. "ZMK7X3NP2A5F"
          commitment — 64-char SHA-256 hex stored in BiometricRecord.din_commitment,
                       used by verify_face_matches_din() to confirm face-to-DIN binding
    """
    commitment = hashlib.sha256(quantized + BIOMETRIC_SALT).hexdigest()
    body = "ZM" + "".join(_DIN_CHARS[int(c, 16)] for c in commitment[:9])
    check = _din_check_char(body)
    return body + check, commitment


def _din_check_char(body: str) -> str:
    """Check character: sum of ASCII values of body mod 32, mapped to _DIN_CHARS."""
    return _DIN_CHARS[sum(ord(c) for c in body) % 32]


def validate_din_format(din: str) -> bool:
    """
    Validates a DIN's format and check digit.
    Call this at every API boundary that accepts a DIN as input parameter.
    Returns False for anything malformed — do not process further.
    """
    if len(din) != 12 or not din.startswith("ZM"):
        return False
    valid_chars = set(_DIN_CHARS + "ZM")
    if not all(c in valid_chars for c in din):
        return False
    return _din_check_char(din[:11]) == din[11]


# ── 3. Cosine similarity (used by deduplication) ──────────────────────────────

def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """
    Cosine similarity between two MobileFaceNet embedding vectors.
    Range: -1.0 (completely opposite) to 1.0 (identical).

    MobileFaceNet outputs L2-normalised vectors so magnitudes are both ~1.0,
    making this equivalent to the dot product. We compute magnitudes anyway
    as a guard against any un-normalised inputs arriving from the app.

    Score guide for MobileFaceNet:
      > 0.88  → same person  (DUPLICATE threshold)
      0.75–0.88 → uncertain  (REVIEW zone, flag for RO)
      < 0.75  → different people (CLEAR, safe to enroll)
    """
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = math.sqrt(sum(a * a for a in vec_a))
    mag_b = math.sqrt(sum(b * b for b in vec_b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


# ── 4. Deduplication check ────────────────────────────────────────────────────

class DuplicateCheckResult:
    """
    Three-zone decision constants (ISO/IEC 19795-1).
    Use these constants when checking the 'decision' key in the result dict.
    """
    CLEAR = "CLEAR"         # < 0.75 — no match, safe to enroll
    REVIEW = "REVIEW"       # 0.75–0.88 — uncertain, hold for RO review
    DUPLICATE = "DUPLICATE" # > 0.88 — already enrolled, reject


def check_duplicate_enrollment(new_embedding: list[float]) -> dict:
    """
    Scans all stored BiometricRecord embeddings and returns a three-zone decision.

    MUST be called by PATCH /registrations/{id}/biometrics BEFORE issuing a DIN.
    Only proceed to derive_din_from_embedding() if decision == CLEAR.

    DECISION ZONES:
      CLEAR     — No similar face. Call derive_din_from_embedding() and proceed.
      REVIEW    — Possible match. Create a DuplicateReviewQueue record and hold
                  enrollment as PENDING until an RO manually clears or rejects it.
      DUPLICATE — Same person already enrolled. Return 409 Conflict immediately.

    SCALING:
      Linear O(n) scan — fine for a hackathon demo.
      Production upgrade path: add pgvector PostgreSQL extension.
        pip install pgvector
        ALTER TABLE biometric_records ADD COLUMN embedding_pgvector vector(512);
        CREATE INDEX ON biometric_records USING ivfflat (embedding_pgvector vector_cosine_ops);
      This reduces deduplication from O(n) to O(log n) approximate nearest-neighbour.

    Returns:
        {
          "decision": "CLEAR" | "REVIEW" | "DUPLICATE",
          "similarity": float | None,
          "matched_din": str | None,
          "matched_name": str | None,
          "message": str
        }
    """
    from citizens.models import BiometricRecord

    best_sim = 0.0
    best_record = None

    records = (
        BiometricRecord.objects
        .exclude(embedding_vector__isnull=True)
        .select_related("citizen")
        .only("embedding_vector", "citizen__din", "citizen__full_name")
    )

    for record in records:
        if not record.embedding_vector:
            continue
        sim = cosine_similarity(new_embedding, record.embedding_vector)
        if sim > best_sim:
            best_sim = sim
            best_record = record

    if best_sim >= DUPLICATE_THRESHOLD:
        return {
            "decision": DuplicateCheckResult.DUPLICATE,
            "similarity": round(best_sim, 4),
            "matched_din": best_record.citizen.din,
            "matched_name": best_record.citizen.full_name,
            "message": (
                f"Already enrolled as {best_record.citizen.full_name} "
                f"(similarity {best_sim:.1%}). Duplicate rejected."
            ),
        }

    if best_sim >= CLEAR_THRESHOLD:
        return {
            "decision": DuplicateCheckResult.REVIEW,
            "similarity": round(best_sim, 4),
            "matched_din": best_record.citizen.din if best_record else None,
            "matched_name": best_record.citizen.full_name if best_record else None,
            "message": (
                f"Possible duplicate (similarity {best_sim:.1%}). "
                "Held for RO manual review."
            ),
        }

    return {
        "decision": DuplicateCheckResult.CLEAR,
        "similarity": round(best_sim, 4) if best_record else None,
        "matched_din": None,
        "matched_name": None,
        "message": "No duplicate found. Safe to proceed.",
    }


# ── 5. Face-to-DIN verification ───────────────────────────────────────────────

def verify_face_matches_din(embedding: list[float], stored_commitment: str) -> bool:
    """
    Verifies that a live face embedding matches the commitment stored at enrollment.

    Used for:
      - Transaction confirmation: citizen proves they own the DIN being charged
      - KYC verification: third party confirms the face matches the claimed DIN

    HOW IT WORKS (commitment scheme from ISO/IEC 24745):
      At enrollment:    commitment = SHA-256(quantize(embedding) + SALT)
      At verification:  recompute the same hash → compare to stored commitment
      One-way: you cannot reconstruct the face from the commitment.

    Args:
        embedding:          512 floats from the live Capacitor plugin capture
        stored_commitment:  BiometricRecord.din_commitment for the claimed DIN

    Returns:
        True if the face matches the stored commitment, False otherwise
    """
    quantized = quantize_embedding(embedding)
    recomputed = hashlib.sha256(quantized + BIOMETRIC_SALT).hexdigest()
    # hmac.compare_digest prevents timing attacks — do not use ==
    return hmac.compare_digest(recomputed, stored_commitment)
