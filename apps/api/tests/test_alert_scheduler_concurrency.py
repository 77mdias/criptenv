"""Scheduler concurrency simulations; live PostgreSQL integration is residual."""

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest


def expiration():
    item = MagicMock()
    item.id = uuid4()
    item.project_id = uuid4()
    item.environment_id = uuid4()
    item.secret_key = "DATABASE_URL"
    item.expires_at = datetime.now(timezone.utc) + timedelta(days=2)
    item.notify_days_before = 7
    item.days_until_expiration = 2
    item.is_expired = False
    item.rotation_policy = "notify"
    return item


@pytest.mark.asyncio
async def test_scheduler_rerun_reuses_delivery_identity_and_does_not_redeliver():
    from app.jobs.expiration_check import ExpirationChecker

    checker = ExpirationChecker(AsyncMock())
    item = expiration()
    project = MagicMock(
        id=item.project_id,
        settings={"alerts": {"enabled": True, "channels": {"in_app": True, "email": False, "webhook": False}}},
    )
    project.name = "Project"
    delivery = MagicMock(id=uuid4(), status="delivered")
    checker.rotation_service.list_pending_rotations = AsyncMock(return_value=[item])
    checker.rotation_service.mark_notified = AsyncMock()
    checker._get_project = AsyncMock(return_value=project)
    checker.delivery_service.resolve_recipients = AsyncMock(return_value=[MagicMock(id=uuid4())])
    checker.delivery_service.create_delivery = AsyncMock(return_value=delivery)
    checker.delivery_service.deliver_channels = AsyncMock(return_value=[])

    class Result:
        def scalar_one_or_none(self):
            return None

        def scalars(self):
            return self

        def all(self):
            return [delivery]

    checker.db.execute.return_value = Result()

    first = await checker.check_expirations()
    second = await checker.check_expirations()

    assert first[0].success is True
    assert second[0].success is True
    checker.delivery_service.create_delivery.assert_awaited()
    checker.delivery_service.deliver_channels.assert_not_awaited()
    assert checker.rotation_service.mark_notified.await_count == 2


@pytest.mark.asyncio
async def test_concurrent_claims_allow_only_one_external_send():
    from app.models.alert_delivery import AlertDelivery
    from app.services.alert_delivery_service import AlertDeliveryService
    from app.services.webhook_service import DeliveryResult

    db = AsyncMock()
    service = AlertDeliveryService(db)
    delivery = AlertDelivery(
        id=uuid4(),
        project_id=uuid4(),
        expiration_id=uuid4(),
        event="secret.expiring",
        channel="webhook",
        recipient_key=f"project:{uuid4()}:webhook",
        status="pending",
    )
    lock = asyncio.Lock()
    claimed = False
    sends = 0

    async def claim(_delivery_id):
        nonlocal claimed
        async with lock:
            if claimed:
                return None
            claimed = True
            return SimpleNamespace(id=delivery.id, claim_token="claim-token", idempotency_key="delivery-key")

    async def send(*_args, **_kwargs):
        nonlocal sends
        sends += 1
        await asyncio.sleep(0)
        return DeliveryResult(True, 1)

    from types import SimpleNamespace
    service.claim_delivery = claim
    service.create_delivery = AsyncMock(return_value=delivery)
    service.webhook_service.send = send
    service.finalize_delivery = AsyncMock(return_value=delivery)

    results = await asyncio.gather(
        service._deliver_webhook_channel(
            delivery.project_id, delivery.expiration_id, delivery.event,
            "https://hooks.example.test/alert", {}, delivery=delivery,
        ),
        service._deliver_webhook_channel(
            delivery.project_id, delivery.expiration_id, delivery.event,
            "https://hooks.example.test/alert", {}, delivery=delivery,
        ),
    )

    assert sends == 1
    assert sum(result.success for result in results) == 1
