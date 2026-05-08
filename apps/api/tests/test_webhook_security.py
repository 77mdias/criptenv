"""Test Mercado Pago Webhook Signature Validation

Tests for webhook signature parsing and HMAC-SHA256 verification.
"""

import pytest
from unittest.mock import patch

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.webhook_security import (
    validate_mercadopago_signature,
    _extract_signature_parts,
    WebhookSignatureError,
)


class TestExtractSignatureParts:
    """Test parsing of X-Signature header."""
    
    def test_valid_signature(self):
        ts, sig = _extract_signature_parts("ts=1234567890,v1=abcdef123456")
        assert ts == "1234567890"
        assert sig == "abcdef123456"
    
    def test_valid_signature_with_spaces(self):
        ts, sig = _extract_signature_parts("ts=1234567890, v1=abcdef123456")
        assert ts == "1234567890"
        assert sig == "abcdef123456"
    
    def test_missing_v1(self):
        ts, sig = _extract_signature_parts("ts=1234567890")
        assert ts == "1234567890"
        assert sig is None
    
    def test_missing_ts(self):
        ts, sig = _extract_signature_parts("v1=abcdef123456")
        assert ts is None
        assert sig == "abcdef123456"
    
    def test_empty_string(self):
        ts, sig = _extract_signature_parts("")
        assert ts is None
        assert sig is None


class TestValidateSignature:
    """Test full signature validation flow."""
    
    @patch("app.services.webhook_security.settings.MERCADO_PAGO_WEBHOOK_SECRET", "")
    def test_no_secret_skips_validation(self):
        """When no secret is configured, validation is skipped."""
        result = validate_mercadopago_signature(
            x_signature="ts=123,v1=abc",
            x_request_id="req-123",
            data_id="pay-123",
        )
        assert result is True
    
    @patch("app.services.webhook_security.settings.MERCADO_PAGO_WEBHOOK_SECRET", "my-secret")
    def test_missing_signature_header(self):
        result = validate_mercadopago_signature(
            x_signature=None,
            x_request_id="req-123",
            data_id="pay-123",
        )
        assert result is False
    
    @patch("app.services.webhook_security.settings.MERCADO_PAGO_WEBHOOK_SECRET", "my-secret")
    def test_missing_request_id(self):
        result = validate_mercadopago_signature(
            x_signature="ts=123,v1=abc",
            x_request_id=None,
            data_id="pay-123",
        )
        assert result is False
    
    @patch("app.services.webhook_security.settings.MERCADO_PAGO_WEBHOOK_SECRET", "my-secret")
    def test_missing_data_id(self):
        result = validate_mercadopago_signature(
            x_signature="ts=123,v1=abc",
            x_request_id="req-123",
            data_id=None,
        )
        assert result is False
    
    @patch("app.services.webhook_security.settings.MERCADO_PAGO_WEBHOOK_SECRET", "my-secret")
    def test_valid_signature(self):
        """Test with a correctly computed signature."""
        import hmac
        import hashlib
        
        secret = "my-secret"
        ts = "1234567890"
        request_id = "req-123"
        data_id = "pay-123"
        
        manifest = f"id:{data_id};request-id:{request_id};ts:{ts};"
        expected_sig = hmac.new(
            secret.encode("utf-8"),
            manifest.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        
        x_signature = f"ts={ts},v1={expected_sig}"
        
        result = validate_mercadopago_signature(
            x_signature=x_signature,
            x_request_id=request_id,
            data_id=data_id,
        )
        assert result is True
    
    @patch("app.services.webhook_security.settings.MERCADO_PAGO_WEBHOOK_SECRET", "my-secret")
    def test_invalid_signature(self):
        """Test with an incorrect signature."""
        result = validate_mercadopago_signature(
            x_signature="ts=1234567890,v1=wrongsignature1234567890",
            x_request_id="req-123",
            data_id="pay-123",
        )
        assert result is False
    
    @patch("app.services.webhook_security.settings.MERCADO_PAGO_WEBHOOK_SECRET", "my-secret")
    def test_malformed_signature_header(self):
        """Test with malformed X-Signature header."""
        result = validate_mercadopago_signature(
            x_signature="not-a-valid-signature",
            x_request_id="req-123",
            data_id="pay-123",
        )
        assert result is False
