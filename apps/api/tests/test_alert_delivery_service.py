from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest

from app.models.alert_delivery import AlertDelivery
from app.models.notification import Notification
from app.services.alert_delivery_service import AlertDeliveryService
from sqlalchemy import Update


class Result:
    def __init__(self, value=None):
        self.value = value

    def scalar_one_or_none(self):
        return self.value

    def scalars(self):
        return self

    def all(self):
        return self.value if isinstance(self.value, list) else []


@pytest.mark.asyncio
async def test_claim_pending_delivery_assigns_fresh_token_and_lease():
    now = datetime.now(timezone.utc)
    delivery = AlertDelivery(
        project_id=uuid4(),
        expiration_id=uuid4(),
        event="secret.expiring",
        channel="in_app",
        recipient_key=str(uuid4()),
        status="pending",
        attempts=0,
    )
    db = AsyncMock()
    db.execute.side_effect = [Result(None), Result(delivery)]

    claimed = await AlertDeliveryService(db).claim_delivery(delivery.id, now=now)

    assert claimed is delivery
    db.flush.assert_not_awaited()
    statement = db.execute.await_args.args[0]
    assert isinstance(statement, Update)
    assert "attempts" in str(statement)
    assert "status" in str(statement)
    assert statement.compile().params["updated_at"] == now


@pytest.mark.asyncio
async def test_expired_processing_at_attempt_three_is_terminal_failed():
    now = datetime.now(timezone.utc)
    delivery = AlertDelivery(
        project_id=uuid4(),
        expiration_id=uuid4(),
        event="secret.expired",
        channel="email",
        recipient_key=str(uuid4()),
        status="processing",
        attempts=3,
        locked_until=now - timedelta(seconds=1),
    )
    db = AsyncMock()
    db.execute.return_value = Result(delivery)

    claimed = await AlertDeliveryService(db).claim_delivery(delivery.id, now=now)

    assert claimed is None
    statement = db.execute.await_args.args[0]
    assert "attempts" in str(statement)
    assert "retry_after" in str(statement)


@pytest.mark.asyncio
async def test_finalize_failure_is_fenced_and_sanitized():
    delivery = AlertDelivery(
        project_id=uuid4(),
        expiration_id=uuid4(),
        event="secret.expiring",
        channel="webhook",
        recipient_key=f"project:{uuid4()}:webhook",
        status="processing",
        attempts=1,
        claim_token="claim-token",
    )
    db = AsyncMock()
    db.execute.side_effect = [Result(None), Result(delivery)]

    result = await AlertDeliveryService(db).finalize_delivery(
        delivery.id,
        "claim-token",
        success=False,
        error="connection failed for https://user:password@example.test/webhook",
    )

    assert result is delivery
    statement = db.execute.await_args.args[0]
    assert "claim_token" in str(statement)
    assert "request_error" in str(statement.compile().params.values())
    assert statement.compile().params["updated_at"] is not None


@pytest.mark.asyncio
async def test_finalize_third_attempt_failure_is_terminal_without_retry_after():
    delivery = AlertDelivery(
        id=uuid4(),
        project_id=uuid4(),
        expiration_id=uuid4(),
        event="secret.expiring",
        channel="email",
        recipient_key=str(uuid4()),
        status="processing",
        attempts=3,
        claim_token="claim-token",
    )
    db = AsyncMock()
    db.execute.return_value = Result(delivery)

    result = await AlertDeliveryService(db).finalize_delivery(
        delivery.id,
        "claim-token",
        success=False,
        error="timeout",
    )

    assert result is delivery
    statement = db.execute.await_args.args[0]
    assert statement.compile().params["retry_after"] is None
    assert "attempts" in str(statement.whereclause)


@pytest.mark.asyncio
async def test_terminal_failure_never_schedules_recipient_retry():
    delivery = AlertDelivery(
        id=uuid4(),
        project_id=uuid4(),
        expiration_id=uuid4(),
        event="secret.expiring",
        channel="in_app",
        recipient_key=str(uuid4()),
        status="processing",
        attempts=1,
        claim_token="claim-token",
    )
    db = AsyncMock()
    db.execute.return_value = Result(delivery)

    result = await AlertDeliveryService(db).finalize_delivery(
        delivery.id,
        "claim-token",
        success=False,
        error="recipient_mismatch",
        terminal=True,
    )

    assert result is delivery
    statement = db.execute.await_args.args[0]
    assert statement.compile().params["retry_after"] is None
    assert statement.compile().params["status"] == "failed"
    assert "claim_token" in str(statement.whereclause)
    assert "attempts" not in str(statement.whereclause)


@pytest.mark.asyncio
async def test_finalize_success_is_fenced_without_attempt_limit():
    delivery = AlertDelivery(
        id=uuid4(),
        project_id=uuid4(),
        expiration_id=uuid4(),
        event="secret.expiring",
        channel="webhook",
        recipient_key=f"project:{uuid4()}:webhook",
        status="processing",
        attempts=2,
        claim_token="claim-token",
    )
    db = AsyncMock()
    db.execute.return_value = Result(delivery)

    result = await AlertDeliveryService(db).finalize_delivery(
        delivery.id,
        "claim-token",
        success=True,
    )

    assert result is delivery
    statement = db.execute.await_args.args[0]
    where = str(statement.whereclause)
    assert "claim_token" in where
    assert "attempts" not in where


@pytest.mark.asyncio
async def test_finalize_success_is_allowed_on_the_third_attempt():
    delivery = AlertDelivery(
        id=uuid4(),
        project_id=uuid4(),
        expiration_id=uuid4(),
        event="secret.expiring",
        channel="webhook",
        recipient_key=f"project:{uuid4()}:webhook",
        status="processing",
        attempts=3,
        claim_token="claim-token",
    )
    db = AsyncMock()
    db.execute.return_value = Result(delivery)

    result = await AlertDeliveryService(db).finalize_delivery(
        delivery.id,
        "claim-token",
        success=True,
    )

    assert result is delivery
    statement = db.execute.await_args.args[0]
    assert "claim_token" in str(statement.whereclause)
    assert "attempts" not in str(statement.whereclause)


@pytest.mark.asyncio
async def test_in_app_delivery_reuses_existing_notification_without_duplicate():
    delivery_id = uuid4()
    delivery = AlertDelivery(
        id=delivery_id,
        project_id=uuid4(),
        expiration_id=uuid4(),
        event="secret.expiring",
        channel="in_app",
        recipient_key=str(uuid4()),
        status="processing",
        claim_token="claim-token",
    )
    existing = Notification(
        user_id=UUID(delivery.recipient_key),
        type="alert",
        title="Secret expires soon",
        message="Rotate it",
        delivery_id=delivery_id,
    )
    db = AsyncMock()
    db.execute.side_effect = [Result(delivery), Result(existing), Result(delivery)]

    result = await AlertDeliveryService(db).deliver_in_app(
        delivery_id=delivery_id,
        claim_token="claim-token",
        user_id=existing.user_id,
        title=existing.title,
        message=existing.message,
    )

    assert result is existing
    db.add.assert_not_called()
    db.flush.assert_awaited_once()


@pytest.mark.asyncio
async def test_in_app_delivery_rejects_recipient_mismatch_before_materializing():
    delivery = AlertDelivery(
        id=uuid4(),
        project_id=uuid4(),
        expiration_id=uuid4(),
        event="secret.expiring",
        channel="in_app",
        recipient_key=str(uuid4()),
        status="processing",
        claim_token="claim-token",
    )
    db = AsyncMock()
    db.execute.return_value = Result(delivery)

    result = await AlertDeliveryService(db).deliver_in_app(
        delivery_id=delivery.id,
        claim_token="claim-token",
        user_id=uuid4(),
        title="Secret expires soon",
        message="Rotate it",
    )

    assert result is None
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_in_app_recipient_mismatch_is_fenced_immediately():
    delivery = AlertDelivery(
        id=uuid4(),
        project_id=uuid4(),
        expiration_id=uuid4(),
        event="secret.expiring",
        channel="in_app",
        recipient_key=str(uuid4()),
        status="processing",
        claim_token="claim-token",
    )
    db = AsyncMock()
    db.execute.side_effect = [Result(delivery), Result(delivery)]

    result = await AlertDeliveryService(db).deliver_in_app(
        delivery.id,
        "claim-token",
        uuid4(),
        "Secret expires soon",
        "Rotate it",
    )

    assert result is None
    assert db.execute.await_count == 2
    finalize_statement = db.execute.await_args_list[-1].args[0]
    assert "claim_token" in str(finalize_statement.whereclause)
    assert finalize_statement.compile().params["retry_after"] is None


@pytest.mark.asyncio
async def test_transport_is_started_only_after_claim_is_committed():
    from types import SimpleNamespace

    service = AlertDeliveryService(AsyncMock(), email_service=SimpleNamespace(
        send=AsyncMock(return_value=SimpleNamespace(success=True, error=None))
    ))
    delivery = AlertDelivery(
        id=uuid4(),
        project_id=uuid4(),
        expiration_id=uuid4(),
        event="secret.expiring",
        channel="email",
        recipient_key=str(uuid4()),
        status="pending",
    )
    service.create_delivery = AsyncMock(return_value=delivery)
    service.claim_delivery = AsyncMock(return_value=SimpleNamespace(
        id=delivery.id,
        claim_token="claim-token",
        idempotency_key="delivery-key",
    ))
    service.finalize_delivery = AsyncMock(return_value=delivery)
    service.db.commit = AsyncMock()
    service.db.rollback = AsyncMock()
    user = SimpleNamespace(id=UUID(delivery.recipient_key), email="owner@example.test")

    await service._deliver_email_channel(
        delivery.project_id,
        delivery.expiration_id,
        delivery.event,
        user,
        {"action_url": "https://frontend.example.test/projects/p"},
        delivery=delivery,
    )

    service.db.commit.assert_awaited()
    assert service.db.commit.await_args_list[0] is not None
    service.email_service.send.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_delivery_returns_existing_row_after_unique_conflict():
    project_id = uuid4()
    expiration_id = uuid4()
    recipient_key = str(uuid4())
    existing = AlertDelivery(
        id=uuid4(),
        project_id=project_id,
        expiration_id=expiration_id,
        event="secret.expiring",
        channel="in_app",
        recipient_key=recipient_key,
    )
    db = AsyncMock()
    db.execute.side_effect = [Result(None), Result(existing)]

    result = await AlertDeliveryService(db).create_delivery(
        project_id,
        expiration_id,
        "secret.expiring",
        "in_app",
        recipient_key,
    )

    assert result is existing
    assert db.execute.await_count == 2
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_pending_expiration_selection_does_not_use_legacy_notification_timestamp():
    from app.services.rotation_service import RotationService

    db = AsyncMock()
    db.execute.return_value = Result()

    await RotationService(db).list_pending_rotations()

    statement = str(db.execute.await_args.args[0].whereclause)
    assert "last_notified_at" not in statement
