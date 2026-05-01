"""Tests for Webhook Service M3.5.4

TDD RED Phase: Tests that describe expected behavior for webhook notifications.
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import patch, AsyncMock, MagicMock
from uuid import uuid4

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class TestWebhookServiceImports:
    """Test that WebhookService can be imported."""

    def test_webhook_service_importable(self):
        """WebhookService should be importable from services."""
        from app.services.webhook_service import WebhookService
        assert WebhookService is not None

    def test_delivery_result_importable(self):
        """DeliveryResult should be importable for type hints."""
        from app.services.webhook_service import DeliveryResult
        assert DeliveryResult is not None

    def test_notification_channel_importable(self):
        """NotificationChannel should be importable for extensibility."""
        from app.services.webhook_service import NotificationChannel
        assert NotificationChannel is not None

    def test_webhook_channel_importable(self):
        """WebhookChannel should be importable."""
        from app.services.webhook_service import WebhookChannel
        assert WebhookChannel is not None


class TestDeliveryResult:
    """Test DeliveryResult dataclass."""

    def test_delivery_result_success(self):
        """DeliveryResult with success should have success=True."""
        from app.services.webhook_service import DeliveryResult
        
        result = DeliveryResult(success=True, attempts=1)
        assert result.success is True
        assert result.attempts == 1
        assert result.error is None
        assert result.status_code is None

    def test_delivery_result_failure(self):
        """DeliveryResult with failure should have success=False."""
        from app.services.webhook_service import DeliveryResult
        
        result = DeliveryResult(success=False, attempts=3, error="Connection refused")
        assert result.success is False
        assert result.attempts == 3
        assert result.error == "Connection refused"

    def test_delivery_result_with_status_code(self):
        """DeliveryResult should track status_code."""
        from app.services.webhook_service import DeliveryResult
        
        result = DeliveryResult(success=True, attempts=1, status_code=200)
        assert result.status_code == 200

    def test_delivery_result_dataclass_fields(self):
        """DeliveryResult should have all required fields."""
        from app.services.webhook_service import DeliveryResult
        from dataclasses import fields
        
        result = DeliveryResult(success=True, attempts=1)
        field_names = [f.name for f in fields(result)]
        
        assert 'success' in field_names
        assert 'attempts' in field_names
        assert 'error' in field_names
        assert 'status_code' in field_names


class TestWebhookChannel:
    """Test WebhookChannel implementation."""

    @pytest.mark.asyncio
    async def test_webhook_channel_send_success(self):
        """WebhookChannel.send should return success on 200-299."""
        from app.services.webhook_service import WebhookChannel
        
        channel = WebhookChannel()
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )
            
            result = await channel.send("https://example.com/webhook", {"test": True})
            
            assert result.success is True
            assert result.attempts == 1
            assert result.status_code == 200

    @pytest.mark.asyncio
    async def test_webhook_channel_send_failure(self):
        """WebhookChannel.send should return failure on non-2xx."""
        from app.services.webhook_service import WebhookChannel
        
        channel = WebhookChannel()
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 500
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )
            
            result = await channel.send("https://example.com/webhook", {"test": True})
            
            assert result.success is False
            assert result.attempts == 1
            assert result.status_code == 500


class TestWebhookService:
    """Test WebhookService methods."""

    def test_service_instantiation(self):
        """WebhookService should be instantiable with default values."""
        from app.services.webhook_service import WebhookService
        
        service = WebhookService()
        assert service is not None
        assert service.max_retries == 3
        assert service.base_delay == 1.0

    def test_service_custom_retries(self):
        """WebhookService should accept custom max_retries."""
        from app.services.webhook_service import WebhookService
        
        service = WebhookService(max_retries=5)
        assert service.max_retries == 5

    def test_service_custom_channel(self):
        """WebhookService should accept custom notification channel."""
        from app.services.webhook_service import WebhookService, NotificationChannel
        
        mock_channel = MagicMock(spec=NotificationChannel)
        service = WebhookService(channel=mock_channel)
        
        assert service.channel == mock_channel

    def test_build_payload_basic(self):
        """build_payload should create basic payload structure."""
        from app.services.webhook_service import WebhookService
        
        service = WebhookService()
        payload = service.build_payload(
            event="secret.expiring",
            project_id=str(uuid4()),
            environment="production",
            secret_key="DATABASE_URL",
            expires_at=datetime(2026, 12, 31, tzinfo=timezone.utc),
            notify_days_before=7
        )
        
        assert payload["event"] == "secret.expiring"
        assert payload["environment"] == "production"
        assert payload["secret_key"] == "DATABASE_URL"
        assert "expires_at" in payload
        assert "notify_days_before" in payload
        assert "timestamp" in payload

    def test_build_payload_never_includes_secret_value(self):
        """build_payload should NEVER include secret values."""
        from app.services.webhook_service import WebhookService
        
        service = WebhookService()
        payload = service.build_payload(
            event="secret.expiring",
            project_id=str(uuid4()),
            environment="production",
            secret_key="API_KEY",
            expires_at=datetime(2026, 12, 31, tzinfo=timezone.utc),
            notify_days_before=7
        )
        
        # Should never contain these fields
        assert "secret_value" not in payload
        assert "encrypted_value" not in payload
        assert "ciphertext" not in payload
        assert "plaintext" not in payload

    def test_build_payload_includes_days_until_expiration(self):
        """build_payload should include days_until_expiration when provided."""
        from app.services.webhook_service import WebhookService
        
        service = WebhookService()
        payload = service.build_payload(
            event="secret.expiring",
            project_id=str(uuid4()),
            environment="production",
            secret_key="API_KEY",
            expires_at=datetime(2026, 12, 31, tzinfo=timezone.utc),
            notify_days_before=7,
            days_until_expiration=5
        )
        
        assert payload["days_until_expiration"] == 5

    def test_build_payload_includes_all_required_fields(self):
        """build_payload should have all documented fields."""
        from app.services.webhook_service import WebhookService
        
        service = WebhookService()
        payload = service.build_payload(
            event="secret.expired",
            project_id="550e8400-e29b-41d4-a716-446655440000",
            environment="staging",
            secret_key="SECRET_KEY",
            expires_at=datetime(2026, 5, 1, tzinfo=timezone.utc),
            notify_days_before=14
        )
        
        required_fields = [
            "event", "project_id", "environment", "secret_key",
            "expires_at", "notify_days_before", "timestamp"
        ]
        
        for field in required_fields:
            assert field in payload, f"Missing required field: {field}"

    @pytest.mark.asyncio
    async def test_send_success_first_attempt(self):
        """send should return success if first attempt succeeds."""
        from app.services.webhook_service import WebhookService
        
        service = WebhookService()
        
        mock_channel = MagicMock()
        mock_channel.send = AsyncMock(return_value=MagicMock(
            success=True, attempts=1, status_code=200
        ))
        service.channel = mock_channel
        
        result = await service.send(
            webhook_url="https://example.com/hook",
            event="secret.expiring",
            payload={"test": True}
        )
        
        assert result.success is True
        assert result.attempts == 1

    @pytest.mark.asyncio
    async def test_send_retries_on_failure(self):
        """send should retry on failure with exponential backoff."""
        from app.services.webhook_service import WebhookService
        
        service = WebhookService(max_retries=3, base_delay=0.1)
        
        # Mock channel that fails first 2 times, succeeds on 3rd
        mock_channel = MagicMock()
        mock_channel.send = AsyncMock(side_effect=[
            MagicMock(success=False, attempts=1, status_code=500),
            MagicMock(success=False, attempts=1, status_code=500),
            MagicMock(success=True, attempts=1, status_code=200)
        ])
        service.channel = mock_channel
        
        result = await service.send(
            webhook_url="https://example.com/hook",
            event="secret.expiring",
            payload={"test": True}
        )
        
        assert result.success is True
        assert result.attempts == 3

    @pytest.mark.asyncio
    async def test_send_max_retries_exhausted(self):
        """send should return failure after max_retries exhausted."""
        from app.services.webhook_service import WebhookService
        
        service = WebhookService(max_retries=3, base_delay=0.01)
        
        # Mock channel that always fails
        mock_channel = MagicMock()
        mock_channel.send = AsyncMock(side_effect=[
            MagicMock(success=False, attempts=1, status_code=500),
            MagicMock(success=False, attempts=1, status_code=500),
            MagicMock(success=False, attempts=1, status_code=500)
        ])
        service.channel = mock_channel
        
        result = await service.send(
            webhook_url="https://example.com/hook",
            event="secret.expiring",
            payload={"test": True}
        )
        
        assert result.success is False
        assert result.attempts == 3

    @pytest.mark.asyncio
    async def test_send_handles_exception(self):
        """send should handle exceptions gracefully."""
        from app.services.webhook_service import WebhookService
        
        service = WebhookService(max_retries=2, base_delay=0.01)
        
        # Mock channel that raises exception
        mock_channel = MagicMock()
        mock_channel.send = AsyncMock(side_effect=[
            Exception("Connection refused"),
            Exception("Connection refused")
        ])
        service.channel = mock_channel
        
        result = await service.send(
            webhook_url="https://example.com/hook",
            event="secret.expiring",
            payload={"test": True}
        )
        
        assert result.success is False
        assert result.attempts == 2
        assert result.error is not None


class TestWebhookChannelTimeout:
    """Test WebhookChannel timeout configuration."""

    def test_channel_default_timeout(self):
        """WebhookChannel should have default timeout."""
        from app.services.webhook_service import WebhookChannel
        
        channel = WebhookChannel()
        assert channel.timeout == 10.0

    def test_channel_custom_timeout(self):
        """WebhookChannel should accept custom timeout."""
        from app.services.webhook_service import WebhookChannel
        
        channel = WebhookChannel(timeout=30.0)
        assert channel.timeout == 30.0


class TestNotificationChannelInterface:
    """Test NotificationChannel abstract interface."""

    def test_notification_channel_is_protocol(self):
        """NotificationChannel should be a Protocol (structural typing)."""
        from app.services.webhook_service import NotificationChannel
        import typing
        
        # Check it's a Protocol class
        assert hasattr(NotificationChannel, '__protocol_attrs__') or hasattr(NotificationChannel, '__issubclass__')

    def test_webhook_channel_is_notification_channel(self):
        """WebhookChannel should be a NotificationChannel (structural typing)."""
        from app.services.webhook_service import WebhookChannel, NotificationChannel
        
        channel = WebhookChannel()
        assert isinstance(channel, NotificationChannel)


class TestWebhookServiceIntegration:
    """Integration tests for WebhookService."""

    @pytest.mark.asyncio
    async def test_full_webhook_flow(self):
        """Test complete webhook flow with mock httpx."""
        from app.services.webhook_service import WebhookService, WebhookChannel
        
        service = WebhookService(channel=WebhookChannel())
        
        # Build payload
        payload = service.build_payload(
            event="secret.expiring",
            project_id=str(uuid4()),
            environment="production",
            secret_key="DATABASE_URL",
            expires_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
            notify_days_before=7,
            days_until_expiration=5
        )
        
        # Should be valid JSON-serializable
        import json
        json_str = json.dumps(payload)
        parsed = json.loads(json_str)
        
        assert parsed["event"] == "secret.expiring"
        assert parsed["days_until_expiration"] == 5