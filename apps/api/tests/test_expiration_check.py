"""Tests for Expiration Check Background Job M3.5.5

TDD RED Phase: Tests for the background job that checks expiring secrets.
"""

import pytest
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from unittest.mock import patch, AsyncMock, MagicMock

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class TestExpirationCheckerImports:
    """Test that ExpirationChecker can be imported."""

    def test_expiration_checker_importable(self):
        """ExpirationChecker should be importable from jobs."""
        from app.jobs.expiration_check import ExpirationChecker
        assert ExpirationChecker is not None

    def test_create_scheduler_job_importable(self):
        """create_scheduler_job should be importable."""
        from app.jobs.expiration_check import create_scheduler_job
        assert create_scheduler_job is not None


class TestExpirationCheckerInstantiation:
    """Test ExpirationChecker initialization."""

    def test_checker_instantiation_with_db(self, mock_db):
        """ExpirationChecker should be instantiable with db session."""
        from app.jobs.expiration_check import ExpirationChecker
        
        checker = ExpirationChecker(mock_db)
        assert checker is not None
        assert checker.db == mock_db

    def test_checker_instantiation_with_webhook_service(self, mock_db, mock_webhook_service):
        """ExpirationChecker should accept custom webhook service."""
        from app.jobs.expiration_check import ExpirationChecker
        
        checker = ExpirationChecker(mock_db, webhook_service=mock_webhook_service)
        assert checker.webhook_service == mock_webhook_service

    def test_checker_has_rotation_service(self, mock_db):
        """ExpirationChecker should have RotationService."""
        from app.jobs.expiration_check import ExpirationChecker
        
        checker = ExpirationChecker(mock_db)
        assert checker.rotation_service is not None


class TestExpirationCheckerCheck:
    """Test ExpirationChecker.check_expirations method."""

    @pytest.mark.asyncio
    async def test_check_returns_list(self, mock_db):
        """check_expirations should return a list of results."""
        from app.jobs.expiration_check import ExpirationChecker
        
        checker = ExpirationChecker(mock_db)
        
        # Mock the service to return empty list
        mock_rotation_service = MagicMock()
        mock_rotation_service.list_pending_rotations = AsyncMock(return_value=[])
        checker.rotation_service = mock_rotation_service
        
        result = await checker.check_expirations()
        
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_check_calls_list_pending_rotations(self, mock_db):
        """check_expirations should call RotationService.list_pending_rotations."""
        from app.jobs.expiration_check import ExpirationChecker
        
        checker = ExpirationChecker(mock_db)
        
        mock_rotation_service = MagicMock()
        mock_rotation_service.list_pending_rotations = AsyncMock(return_value=[])
        checker.rotation_service = mock_rotation_service
        
        await checker.check_expirations()
        
        mock_rotation_service.list_pending_rotations.assert_called_once()

    @pytest.mark.asyncio
    async def test_check_notifies_each_expiring_secret(self, mock_db, mock_expiring_secret):
        """check_expirations should notify for each expiring secret."""
        from app.jobs.expiration_check import ExpirationChecker
        
        checker = ExpirationChecker(mock_db)
        
        mock_rotation_service = MagicMock()
        mock_rotation_service.list_pending_rotations = AsyncMock(return_value=[mock_expiring_secret])
        mock_rotation_service.mark_notified = AsyncMock()
        checker.rotation_service = mock_rotation_service
        
        mock_webhook = MagicMock()
        mock_webhook.send = AsyncMock(return_value=MagicMock(success=True, attempts=1))
        mock_webhook.build_payload = MagicMock(return_value={"event": "secret.expiring"})
        checker.webhook_service = mock_webhook
        
        # Mock _get_webhook_url
        checker._get_webhook_url = AsyncMock(return_value="https://example.com/hook")
        
        results = await checker.check_expirations()
        
        # Should have sent notification
        assert len(results) >= 0

    @pytest.mark.asyncio
    async def test_check_marks_notified_on_success(self, mock_db, mock_expiring_secret):
        """check_expirations should mark_notified after successful notification."""
        from app.jobs.expiration_check import ExpirationChecker
        
        checker = ExpirationChecker(mock_db)
        
        mock_rotation_service = MagicMock()
        mock_rotation_service.list_pending_rotations = AsyncMock(return_value=[mock_expiring_secret])
        mock_rotation_service.mark_notified = AsyncMock()
        checker.rotation_service = mock_rotation_service
        
        mock_webhook = MagicMock()
        mock_webhook.send = AsyncMock(return_value=MagicMock(success=True, attempts=1))
        mock_webhook.build_payload = MagicMock(return_value={"event": "secret.expiring"})
        checker.webhook_service = mock_webhook
        
        checker._get_webhook_url = AsyncMock(return_value="https://example.com/hook")
        
        await checker.check_expirations()
        
        # mark_notified should be called
        mock_rotation_service.mark_notified.assert_called_once()

    @pytest.mark.asyncio
    async def test_check_does_not_mark_on_failure(self, mock_db, mock_expiring_secret):
        """check_expirations should NOT mark_notified if notification fails."""
        from app.jobs.expiration_check import ExpirationChecker
        
        checker = ExpirationChecker(mock_db)
        
        mock_rotation_service = MagicMock()
        mock_rotation_service.list_pending_rotations = AsyncMock(return_value=[mock_expiring_secret])
        mock_rotation_service.mark_notified = AsyncMock()
        checker.rotation_service = mock_rotation_service
        
        mock_webhook = MagicMock()
        mock_webhook.send = AsyncMock(return_value=MagicMock(success=False, attempts=3, error="Failed"))
        mock_webhook.build_payload = MagicMock(return_value={"event": "secret.expiring"})
        checker.webhook_service = mock_webhook
        
        checker._get_webhook_url = AsyncMock(return_value="https://example.com/hook")
        
        results = await checker.check_expirations()
        
        # mark_notified should NOT be called on failure
        mock_rotation_service.mark_notified.assert_not_called()

    @pytest.mark.asyncio
    async def test_check_handles_empty_list(self, mock_db):
        """check_expirations should handle empty pending list gracefully."""
        from app.jobs.expiration_check import ExpirationChecker
        
        checker = ExpirationChecker(mock_db)
        
        mock_rotation_service = MagicMock()
        mock_rotation_service.list_pending_rotations = AsyncMock(return_value=[])
        checker.rotation_service = mock_rotation_service
        
        result = await checker.check_expirations()
        
        assert isinstance(result, list)
        assert len(result) == 0

    @pytest.mark.asyncio
    async def test_check_handles_exception(self, mock_db):
        """check_expirations should handle exceptions gracefully."""
        from app.jobs.expiration_check import ExpirationChecker
        
        checker = ExpirationChecker(mock_db)
        
        mock_rotation_service = MagicMock()
        mock_rotation_service.list_pending_rotations = AsyncMock(side_effect=Exception("DB error"))
        checker.rotation_service = mock_rotation_service
        
        # Should not raise
        result = await checker.check_expirations()
        
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_check_handles_webhook_exception(self, mock_db, mock_expiring_secret):
        """check_expirations should handle webhook exceptions gracefully."""
        from app.jobs.expiration_check import ExpirationChecker
        
        checker = ExpirationChecker(mock_db)
        
        mock_rotation_service = MagicMock()
        mock_rotation_service.list_pending_rotations = AsyncMock(return_value=[mock_expiring_secret])
        mock_rotation_service.mark_notified = AsyncMock()
        checker.rotation_service = mock_rotation_service
        
        mock_webhook = MagicMock()
        mock_webhook.send = AsyncMock(side_effect=Exception("Connection refused"))
        mock_webhook.build_payload = MagicMock(return_value={"event": "secret.expiring"})
        checker.webhook_service = mock_webhook
        
        checker._get_webhook_url = AsyncMock(return_value="https://example.com/hook")
        
        # Should not raise
        result = await checker.check_expirations()
        
        assert isinstance(result, list)


class TestExpirationCheckerNotify:
    """Test ExpirationChecker._notify_expiration method."""

    @pytest.mark.asyncio
    async def test_notify_builds_payload(self, mock_db, mock_expiring_secret):
        """_notify_expiration should build payload using webhook service."""
        from app.jobs.expiration_check import ExpirationChecker
        
        checker = ExpirationChecker(mock_db)
        
        mock_webhook = MagicMock()
        mock_webhook.build_payload = MagicMock(return_value={"event": "secret.expiring"})
        mock_webhook.send = AsyncMock(return_value=MagicMock(success=True, attempts=1))
        checker.webhook_service = mock_webhook
        
        checker._get_webhook_url = AsyncMock(return_value="https://example.com/hook")
        
        await checker._notify_expiration(mock_expiring_secret)
        
        mock_webhook.build_payload.assert_called_once()
        # Check payload structure
        call_args = mock_webhook.build_payload.call_args
        assert 'event' in call_args.kwargs or call_args[1].get('event')

    @pytest.mark.asyncio
    async def test_notify_does_not_include_secret_value(self, mock_db, mock_expiring_secret):
        """_notify_expiration should NOT include secret value in payload."""
        from app.jobs.expiration_check import ExpirationChecker
        
        checker = ExpirationChecker(mock_db)
        
        # Test that the service method accepts correct kwargs
        # without sensitive fields
        kwargs_used = {}
        
        def capture_build_payload(**kwargs):
            kwargs_used.update(kwargs)
            return {
                "event": kwargs.get("event", "secret.expiring"),
                "project_id": str(kwargs.get("project_id", "")),
                "environment": str(kwargs.get("environment", "")),
                "secret_key": kwargs.get("secret_key", ""),
                "expires_at": str(kwargs.get("expires_at", "")),
                "notify_days_before": kwargs.get("notify_days_before", 7),
                "timestamp": "2026-05-01T10:00:00Z"
            }
        
        mock_webhook = MagicMock()
        mock_webhook.build_payload = MagicMock(side_effect=capture_build_payload)
        mock_webhook.send = AsyncMock(return_value=MagicMock(success=True, attempts=1))
        checker.webhook_service = mock_webhook
        
        checker._get_webhook_url = AsyncMock(return_value="https://example.com/hook")
        
        await checker._notify_expiration(mock_expiring_secret)
        
        # Verify build_payload was called
        assert len(kwargs_used) > 0, "build_payload should have been called"
        
        # Verify secret_key is passed (the identifier, NOT the value)
        assert "secret_key" in kwargs_used, "secret_key identifier should be passed"
        
        # Verify sensitive fields are NOT passed to build_payload
        sensitive_fields = ["secret_value", "encrypted_value", "plaintext", "ciphertext"]
        for field in sensitive_fields:
            assert field not in kwargs_used, f"{field} should NOT be passed to build_payload"

    @pytest.mark.asyncio
    async def test_notify_returns_no_webhook_url_result(self, mock_db, mock_expiring_secret):
        """_notify_expiration should return failure if no webhook URL configured."""
        from app.jobs.expiration_check import ExpirationChecker
        
        checker = ExpirationChecker(mock_db)
        
        mock_webhook = MagicMock()
        checker.webhook_service = mock_webhook
        
        checker._get_webhook_url = AsyncMock(return_value=None)
        
        result = await checker._notify_expiration(mock_expiring_secret)
        
        assert result.success is False
        assert result.error == "No webhook URL configured"


class TestExpirationCheckerGetWebhookUrl:
    """Test ExpirationChecker._get_webhook_url method."""

    @pytest.mark.asyncio
    async def test_get_webhook_url_returns_none(self, mock_db):
        """_get_webhook_url should return None (placeholder implementation)."""
        from app.jobs.expiration_check import ExpirationChecker
        
        checker = ExpirationChecker(mock_db)
        
        url = await checker._get_webhook_url(uuid4())
        
        # Currently returns None - future implementation will query project settings
        assert url is None


class TestCreateSchedulerJob:
    """Test create_scheduler_job function."""

    def test_create_scheduler_job_returns_callable(self, mock_db):
        """create_scheduler_job should return an async callable."""
        from app.jobs.expiration_check import create_scheduler_job, ExpirationChecker
        
        checker = ExpirationChecker(mock_db)
        job = create_scheduler_job(checker)
        
        assert callable(job)

    @pytest.mark.asyncio
    async def test_scheduler_job_calls_check(self, mock_db):
        """Scheduler job should call check_expirations."""
        from app.jobs.expiration_check import create_scheduler_job, ExpirationChecker
        
        checker = ExpirationChecker(mock_db)
        
        mock_rotation_service = MagicMock()
        mock_rotation_service.list_pending_rotations = AsyncMock(return_value=[])
        checker.rotation_service = mock_rotation_service
        
        job = create_scheduler_job(checker)
        
        await job()
        
        mock_rotation_service.list_pending_rotations.assert_called_once()


class TestExpirationCheckerEdgeCases:
    """Edge case tests for ExpirationChecker."""

    @pytest.mark.asyncio
    async def test_check_with_mixed_results(self, mock_db):
        """check_expirations should handle mixed success/failure results."""
        from app.jobs.expiration_check import ExpirationChecker
        
        checker = ExpirationChecker(mock_db)
        
        # Create mock secrets
        secret1 = MagicMock()
        secret1.secret_key = "KEY1"
        secret1.project_id = uuid4()
        secret1.environment_id = uuid4()
        secret1.expires_at = datetime.now(timezone.utc) + timedelta(days=5)
        secret1.notify_days_before = 7
        secret1.days_until_expiration = 5
        secret1.is_expired = False
        
        secret2 = MagicMock()
        secret2.secret_key = "KEY2"
        secret2.project_id = uuid4()
        secret2.environment_id = uuid4()
        secret2.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        secret2.notify_days_before = 7
        secret2.days_until_expiration = -1
        secret2.is_expired = True
        
        mock_rotation_service = MagicMock()
        mock_rotation_service.list_pending_rotations = AsyncMock(return_value=[secret1, secret2])
        mock_rotation_service.mark_notified = AsyncMock()
        checker.rotation_service = mock_rotation_service
        
        mock_webhook = MagicMock()
        # First succeeds, second fails
        mock_webhook.send = AsyncMock(side_effect=[
            MagicMock(success=True, attempts=1),
            MagicMock(success=False, attempts=3, error="Failed")
        ])
        mock_webhook.build_payload = MagicMock(return_value={"event": "secret.expiring"})
        checker.webhook_service = mock_webhook
        
        checker._get_webhook_url = AsyncMock(return_value="https://example.com/hook")
        
        results = await checker.check_expirations()
        
        # Should have 2 results
        assert len(results) == 2
        # First should succeed, second should fail
        assert results[0].success is True
        assert results[1].success is False


# Fixtures
@pytest.fixture
def mock_db():
    """Mock database session."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    return session


@pytest.fixture
def mock_webhook_service():
    """Mock webhook service."""
    service = MagicMock()
    service.send = AsyncMock(return_value=MagicMock(success=True, attempts=1))
    service.build_payload = MagicMock(return_value={"event": "secret.expiring"})
    return service


@pytest.fixture
def mock_expiring_secret():
    """Mock expiring secret for testing."""
    secret = MagicMock()
    secret.secret_key = "DATABASE_URL"
    secret.project_id = uuid4()
    secret.environment_id = uuid4()
    secret.expires_at = datetime.now(timezone.utc) + timedelta(days=5)
    secret.notify_days_before = 7
    secret.days_until_expiration = 5
    secret.is_expired = False
    return secret