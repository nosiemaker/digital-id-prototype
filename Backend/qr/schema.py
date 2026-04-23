"""
Pydantic schemas for QR endpoints.
"""

from pydantic import BaseModel, Field


class QRPayload(BaseModel):
    """QR payload returned by generate_qr_payload()."""
    din: str
    name: str
    nonce: str
    exp: int
    sig: str


class QRVerifyRequest(BaseModel):
    """Request to verify a scanned QR payload."""
    din: str = Field(..., min_length=12, max_length=12)
    nonce: str
    exp: int
    sig: str


class QRVerifyResponse(BaseModel):
    """Response when verifying a QR payload."""
    verified: bool = Field(..., description="Whether the QR is valid and not expired")
    din: str = Field(..., description="Digital identity number")
    expires_in_seconds: int = Field(..., description="Seconds until expiry")

