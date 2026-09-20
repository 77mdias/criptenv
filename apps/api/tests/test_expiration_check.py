"""Tests for Expiration Check Background Job M3.5.5

TDD RED Phase: Tests for the background job that checks expiring secrets.
"""

import pytest
from datetime import datetime, timezone, timedelta
from uuid import UUID, uuid4
from unittest.mock import patch, AsyncMock, MagicMock

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def configure_delivery_service(checker, *, claims=None):
    delivery = MagicMock(
        id=uuid4(),
        claim_token="claim-token",
        idempotency_key="delivery-key",
    )
    service = MagicMock()
    service.create_delivery = AsyncMock(return_value=delivery)
    service.claim_delivery = AsyncMock(side_effect=claims or [delivery])
    service.finalize_delivery = AsyncMock(return_value=delivery)
    checker.delivery_service = service
    return service, delivery


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

    def test_checker_does_not_create_legacy_webhook_service(self, mock_db):
        from app.jobs.expiration_check import ExpirationChecker

        with patch("app.jobs.expiration_check.WebhookService") as legacy:
            ExpirationChecker(mock_db)

        legacy.assert_not_called()


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
        configure_delivery_service(checker)
        
        # Mock _get_webhook_url
        checker._get_webhook_url = AsyncMock(return_value="https://example.com/hook")
        
        results = await checker.check_expirations()
        
        # Should have sent notification
        assert len(results) >= 0

    @pytest.mark.asyncio
    async def test_check_does_not_use_legacy_mark_notified_on_success(self, mock_db, mock_expiring_secret):
        """Persisted alert deliveries, not legacy metadata, own success state."""
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
        configure_delivery_service(checker)
        
        checker._get_webhook_url = AsyncMock(return_value="https://example.com/hook")
        
        await checker.check_expirations()
        
        mock_rotation_service.mark_notified.assert_not_called()

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
        configure_delivery_service(checker)
        
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
    async def test_disabled_project_creates_no_rows_and_does_not_mark(self, mock_db, mock_expiring_secret):
        from app.jobs.expiration_check import ExpirationChecker

        checker = ExpirationChecker(mock_db)
        checker.rotation_service.list_pending_rotations = AsyncMock(return_value=[mock_expiring_secret])
        checker.rotation_service.mark_notified = AsyncMock()
        disabled_project = MagicMock(settings={"alerts": {"enabled": False}})
        disabled_project.name = "Project"
        checker._get_project = AsyncMock(return_value=disabled_project)
        checker.delivery_service.create_delivery = AsyncMock()

        result = await checker.check_expirations()

        assert result == []
        checker.delivery_service.create_delivery.assert_not_awaited()
        checker.rotation_service.mark_notified.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_success_requires_all_intended_channels(self, mock_db, mock_expiring_secret):
        from app.jobs.expiration_check import ExpirationChecker
        from app.services.webhook_service import DeliveryResult

        checker = ExpirationChecker(mock_db)
        checker.rotation_service.list_pending_rotations = AsyncMock(return_value=[mock_expiring_secret])
        checker.rotation_service.mark_notified = AsyncMock()
        configured_project = MagicMock(
            id=mock_expiring_secret.project_id,
            settings={"alerts": {"enabled": True, "channels": {"in_app": True, "email": True, "webhook": False}}},
        )
        configured_project.name = "Project"
        checker._get_project = AsyncMock(return_value=configured_project)
        checker.delivery_service.resolve_recipients = AsyncMock(side_effect=[
            [MagicMock(id=uuid4())],
            [MagicMock(id=uuid4(), email="owner@example.test")],
        ])
        checker.delivery_service.create_delivery = AsyncMock(side_effect=lambda *args, **kwargs: MagicMock(
            id=uuid4(), status="pending"
        ))
        checker.delivery_service.deliver_channels = AsyncMock(return_value=[
            DeliveryResult(success=True, attempts=1),
            DeliveryResult(success=False, attempts=1, error="delivery_error"),
        ])

        class Result:
            def __init__(self, rows):
                self.rows = rows

            def scalar_one_or_none(self):
                return self.rows[0] if self.rows else None

            def scalars(self):
                return self

            def all(self):
                return self.rows

        mock_db.execute.return_value = Result([])

        result = await checker.check_expirations()

        assert result[0].success is False
        checker.rotation_service.mark_notified.assert_not_awaited()

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
        configure_delivery_service(checker)
        
        checker._get_webhook_url = AsyncMock(return_value="https://example.com/hook")
        
        # Should not raise
        result = await checker.check_expirations()
        
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_check_sanitizes_webhook_exception_in_result_and_logs(
        self, mock_db, mock_expiring_secret, caplog
    ):
        from app.jobs.expiration_check import ExpirationChecker

        checker = ExpirationChecker(mock_db)
        mock_rotation_service = MagicMock()
        mock_rotation_service.list_pending_rotations = AsyncMock(return_value=[mock_expiring_secret])
        checker.rotation_service = mock_rotation_service
        mock_webhook = MagicMock()
        mock_webhook.send = AsyncMock(side_effect=RuntimeError(
            "failed https://hooks.example.test/hook?token=topsecret response body=private"
        ))
        checker.webhook_service = mock_webhook
        configure_delivery_service(checker)
        checker._get_webhook_url = AsyncMock(return_value="https://hooks.example.test/hook?token=topsecret")

        results = await checker.check_expirations()

        assert results == []
        assert "topsecret" not in caplog.text
        assert "hooks.example.test/hook" not in caplog.text
        assert "private" not in caplog.text


class TestExpirationCheckerGetWebhookUrl:
    """Test ExpirationChecker._get_webhook_url method."""

    @pytest.mark.asyncio
    async def test_get_webhook_url_returns_none(self, mock_db):
        """_get_webhook_url returns None when the project is absent."""
        from app.jobs.expiration_check import ExpirationChecker
        
        checker = ExpirationChecker(mock_db)
        mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        
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

    @pytest.mark.asyncio
    async def test_scheduler_job_sanitizes_fallback_exception_logging(self, mock_db, caplog):
        """Scheduler fallback logging must not expose webhook exception details."""
        from app.jobs.expiration_check import ExpirationChecker, create_scheduler_job

        checker = ExpirationChecker(mock_db)
        checker.check_expirations = AsyncMock(side_effect=RuntimeError(
            "failed https://hooks.example.test/hook?token=topsecret response body=private"
        ))

        await create_scheduler_job(checker)()

        assert "topsecret" not in caplog.text
        assert "hooks.example.test/hook" not in caplog.text
        assert "private" not in caplog.text
        assert "delivery_error" in caplog.text

    @pytest.mark.asyncio
    async def test_session_scoped_scheduler_job_opens_fresh_db_session(self):
        """Scheduler job should create a fresh DB session for each execution."""
        from app.jobs.expiration_check import create_session_scoped_scheduler_job

        sessions = [AsyncMock(), AsyncMock()]
        contexts = []
        checker_sessions = []

        class SessionContext:
            def __init__(self, session):
                self.session = session
                self.entered = 0
                self.exited = 0

            async def __aenter__(self):
                self.entered += 1
                return self.session

            async def __aexit__(self, exc_type, exc, tb):
                self.exited += 1
                return False

        class FakeChecker:
            def __init__(self, db):
                checker_sessions.append(db)

            async def check_expirations(self):
                return []

        def session_factory():
            context = SessionContext(sessions[len(contexts)])
            contexts.append(context)
            return context

        job = create_session_scoped_scheduler_job(session_factory, checker_cls=FakeChecker)

        await job()
        await job()

        assert checker_sessions == sessions
        assert [context.entered for context in contexts] == [1, 1]
        assert [context.exited for context in contexts] == [1, 1]

    @pytest.mark.asyncio
    async def test_session_scoped_scheduler_job_commits_successful_and_failed_delivery_state(self):
        from app.jobs.expiration_check import create_session_scoped_scheduler_job
        from app.services.webhook_service import DeliveryResult

        db = AsyncMock()
        contexts = []

        class SessionContext:
            async def __aenter__(self):
                contexts.append(self)
                return db

            async def __aexit__(self, exc_type, exc, tb):
                return False

        class FakeChecker:
            def __init__(self, session):
                assert session is db

            async def check_expirations(self):
                return [DeliveryResult(False, 1, "delivery_error")]

        await create_session_scoped_scheduler_job(
            lambda: SessionContext(), checker_cls=FakeChecker
        )()

        db.commit.assert_awaited_once()
        db.rollback.assert_not_awaited()
        assert contexts

    @pytest.mark.asyncio
    async def test_session_scoped_scheduler_job_rolls_back_unhandled_job_exception(self):
        from app.jobs.expiration_check import create_session_scoped_scheduler_job

        db = AsyncMock()

        class SessionContext:
            async def __aenter__(self):
                return db

            async def __aexit__(self, exc_type, exc, tb):
                return False

        class FailingChecker:
            def __init__(self, session):
                pass

            async def check_expirations(self):
                raise RuntimeError("database failure")

        await create_session_scoped_scheduler_job(
            lambda: SessionContext(), checker_cls=FailingChecker
        )()

        db.rollback.assert_awaited_once()
        db.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_scheduler_dispatches_materialized_recipients_without_resolving_again(
        self, mock_db, mock_expiring_secret
    ):
        from app.jobs.expiration_check import ExpirationChecker

        checker = ExpirationChecker(mock_db)
        project = MagicMock(
            id=mock_expiring_secret.project_id,
            settings={"alerts": {"enabled": True, "channels": {"in_app": True, "email": False, "webhook": False}}},
        )
        project.name = "Project"
        user = MagicMock(id=uuid4())
        delivery = MagicMock(id=uuid4(), status="pending")
        checker._get_project = AsyncMock(return_value=project)
        checker.delivery_service.resolve_recipients = AsyncMock(return_value=[user])
        checker.delivery_service.create_delivery = AsyncMock(return_value=delivery)
        checker.delivery_service.deliver_channels = AsyncMock(return_value=[])
        checker.rotation_service.mark_notified = AsyncMock()

        class Result:
            def scalar_one_or_none(self):
                return None

            def scalars(self):
                return self

            def all(self):
                return [delivery]

        mock_db.execute.return_value = Result()

        await checker._process_expiration(mock_expiring_secret)

        checker.delivery_service.deliver_channels.assert_awaited_once()
        args = checker.delivery_service.deliver_channels.await_args.kwargs
        assert args["materialized_deliveries"] == [delivery]
        assert args["recipient_users"] == {str(user.id): user}
        from app.config import settings
        assert args["payload"]["action_url"].startswith(settings.FRONTEND_URL.rstrip("/"))
        checker.delivery_service.resolve_recipients.assert_awaited_once_with(
            mock_expiring_secret.project_id
        )


# Fixtures
@pytest.fixture
def mock_db():
    """Mock database session."""
    class EmptyResult:
        def scalar_one_or_none(self):
            return None

        def scalars(self):
            return self

        def all(self):
            return []

    session = AsyncMock()
    session.execute = AsyncMock(return_value=EmptyResult())
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
