import time
from datetime import date
from django.test import TestCase
from citizens.models import Citizen, CitizenStatus
from .service import (
    generate_qr_payload,
    verify_qr_payload,
    CitizenNotFoundError,
    CitizenNotActiveError,
    QRExpiredError,
    QRInvalidSignatureError,
)


class QRServiceTests(TestCase):
    """Test QR code generation and verification."""

    def setUp(self):
        """Create test citizen."""
        self.citizen = Citizen.objects.create(
            din="ZM000000001A",
            nrc="123456/78/1",
            full_name="Test Citizen",
            dob=date(1990, 1, 1),
            public_key="test_public_key",
            status=CitizenStatus.ACTIVE,
        )

    def test_generate_qr_payload_success(self):
        """Test successful QR payload generation."""
        payload = generate_qr_payload("ZM000000001A")
        self.assertEqual(payload["din"], "ZM000000001A")
        self.assertEqual(payload["name"], "Test Citizen")
        self.assertIn("nonce", payload)
        self.assertIn("exp", payload)
        self.assertIn("sig", payload)

    def test_generate_qr_payload_citizen_not_found(self):
        """Test error when citizen doesn't exist."""
        with self.assertRaises(CitizenNotFoundError):
            generate_qr_payload("ZM999999999Z")

    def test_generate_qr_payload_citizen_not_active(self):
        """Test error when citizen status is not ACTIVE."""
        self.citizen.status = CitizenStatus.PENDING
        self.citizen.save()
        with self.assertRaises(CitizenNotActiveError):
            generate_qr_payload("ZM000000001A")

    def test_verify_qr_payload_success(self):
        """Test successful QR verification."""
        payload = generate_qr_payload("ZM000000001A")
        result = verify_qr_payload(
            din=payload["din"],
            nonce=payload["nonce"],
            exp=payload["exp"],
            sig=payload["sig"],
        )
        self.assertTrue(result["verified"])
        self.assertEqual(result["din"], "ZM000000001A")
        self.assertGreater(result["expires_in_seconds"], 0)

    def test_verify_qr_payload_expired(self):
        """Test error when QR is expired."""
        payload = generate_qr_payload("ZM000000001A")
        exp_past = int(time.time()) - 1
        with self.assertRaises(QRExpiredError):
            verify_qr_payload(
                din=payload["din"],
                nonce=payload["nonce"],
                exp=exp_past,
                sig=payload["sig"],
            )

    def test_verify_qr_payload_invalid_signature(self):
        """Test error when signature is invalid."""
        payload = generate_qr_payload("ZM000000001A")
        with self.assertRaises(QRInvalidSignatureError):
            verify_qr_payload(
                din=payload["din"],
                nonce=payload["nonce"],
                exp=payload["exp"],
                sig="invalid_signature",
            )
