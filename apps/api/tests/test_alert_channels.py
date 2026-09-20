import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from app.models.user import User
from app.services.alert_delivery_service import AlertDeliveryService
from app.services.webhook_service import DeliveryResult
from app.services.email_alert_service import build_expiration_email


class Result:
    def __init__(self, values):
        self.values = values

    def scalars(self):
        return self

    def all(self):
        return self.values


@pytest.mark.asyncio
async def test_recipient_resolution_includes_unaccepted_owner_and_accepted_admin_only():
    owner_id = uuid4()
    admin_id = uuid4()
    developer_id = uuid4()
    db = AsyncMock()
    db.execute.return_value = Result([
        User(id=owner_id, email="owner@example.test", name="Owner"),
        User(id=admin_id, email="admin@example.test", name="Admin"),
    ])

    recipients = await AlertDeliveryService(db).resolve_recipients(uuid4())

    assert {user.id for user in recipients} == {owner_id, admin_id}
    statement = str(db.execute.await_args.args[0])
    assert "accepted_at" in statement
    assert "developer" not in statement
    assert str(developer_id) not in {str(user.id) for user in recipients}


@pytest.mark.asyncio
async def test_email_recipient_resolution_requires_verified_email():
    db = AsyncMock()
    db.execute.return_value = Result([])

    await AlertDeliveryService(db).resolve_recipients(uuid4(), email=True)

    statement = str(db.execute.await_args.args[0])
    assert "email_verified" in statement


def test_expiration_email_escapes_html_and_has_plain_text_fallback():
    payload = {
        "project_name": "Payments <prod>",
        "environment_name": "Production & Blue",
        "secret_key": "API_<KEY>",
        "expires_at": "2026-09-20T00:00:00Z",
        "days_until_expiration": 1,
        "action_url": "/projects/project-1/secrets/API_<KEY>",
    }

    html, text = build_expiration_email(payload)

    assert "Payments &lt;prod&gt;" in html
    assert "API_&lt;KEY&gt;" in html
    assert "Payments <prod>" not in html
    assert "Payments <prod>" in text
    assert "ciphertext" not in html.lower()
    assert "ciphertext" not in text.lower()


@pytest.mark.asyncio
async def test_missing_resend_is_not_reported_as_success():
    from app.services.email_alert_service import EmailAlertService

    service = EmailAlertService(email_service=SimpleNamespace(enabled=False))

    result = await service.send("owner@example.test", {"project_name": "Payments"})

    assert result.success is False
    assert result.error in {"email_disabled", "resend_not_configured"}


@pytest.mark.asyncio
async def test_email_provider_call_is_offloaded_to_thread():
    sender = Mock(enabled=True)
    sender.send_alert = Mock(return_value={"id": "email-id"})
    service = __import__(
        "app.services.email_alert_service", fromlist=["EmailAlertService"]
    ).EmailAlertService(email_service=sender)

    with patch.object(asyncio, "to_thread", new=AsyncMock(return_value={"id": "email-id"})) as offload:
        result = await service.send("owner@example.test", {"project_name": "Payments"})

    assert result.success is True
    offload.assert_awaited_once()


@pytest.mark.asyncio
async def test_channel_failures_do_not_prevent_other_channel_attempts():
    service = AlertDeliveryService(AsyncMock())
    user = User(id=uuid4(), email="owner@example.test", name="Owner")
    service.resolve_recipients = AsyncMock(side_effect=[[user], [user]])
    service._deliver_in_app_channel = AsyncMock(return_value=DeliveryResult(False, 1, "delivery_error"))
    service._deliver_email_channel = AsyncMock(return_value=DeliveryResult(True, 1))
    service._deliver_webhook_channel = AsyncMock(return_value=DeliveryResult(True, 1))

    results = await service.deliver_channels(
        project_id=uuid4(),
        expiration_id=uuid4(),
        event="secret.expiring",
        payload={"project_id": str(uuid4())},
        channels={"in_app": True, "email": True, "webhook": True},
        webhook_url="https://hooks.example.test/alert",
    )

    assert [result.success for result in results] == [False, True, True]
    service._deliver_email_channel.assert_awaited_once()
    service._deliver_webhook_channel.assert_awaited_once()


@pytest.mark.asyncio
async def test_transport_exception_becomes_sanitized_failure_and_other_channels_continue():
    service = AlertDeliveryService(AsyncMock())
    user = User(id=uuid4(), email="owner@example.test", name="Owner")
    service.resolve_recipients = AsyncMock(side_effect=[[user], [user]])
    service._deliver_in_app_channel = AsyncMock(return_value=DeliveryResult(True, 1))
    service._deliver_email_channel = AsyncMock(return_value=DeliveryResult(True, 1))
    service._deliver_webhook_channel = AsyncMock(
        side_effect=RuntimeError("connection failed for https://user:secret@example.test/hook")
    )

    results = await service.deliver_channels(
        project_id=uuid4(),
        expiration_id=uuid4(),
        event="secret.expiring",
        payload={"project_id": str(uuid4())},
        channels={"in_app": True, "email": True, "webhook": True},
        webhook_url="https://hooks.example.test/alert",
    )

    assert [result.success for result in results] == [True, True, False]
    assert results[-1].error == "request_error"


def test_legacy_expiration_alert_is_the_canonical_payload_contract():
    from app.schemas.secret_expiration import ExpirationAlert
    from app.services.alert_payload import AlertPayload

    assert ExpirationAlert is AlertPayload


def test_expiration_email_contains_absolute_action_url(monkeypatch):
    from app.config import settings
    from app.services.email_alert_service import build_expiration_email

    monkeypatch.setattr(settings, "FRONTEND_URL", "https://frontend.example.test/")
    html, text = build_expiration_email({
        "project_name": "Payments",
        "environment_name": "Production",
        "secret_key": "API_KEY",
        "action_url": "/projects/project-1/secrets/API_KEY",
    })

    assert 'href="https://frontend.example.test/projects/project-1/secrets/API_KEY"' in html
    assert "https://frontend.example.test/projects/project-1/secrets/API_KEY" in text
