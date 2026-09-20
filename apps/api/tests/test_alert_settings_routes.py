from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.middleware.auth import get_current_user
from app.routers.alert_settings import router
from app.schemas.alert_settings import AlertChannels, AlertSettingsResponse
from app.services.alert_payload import build_alert_payload
from app.services.alert_settings_service import AlertSettingsConfigurationError
from app.services.webhook_service import WebhookChannel


def make_user():
    return SimpleNamespace(
        id=uuid4(),
        email="owner@example.com",
        name="Owner",
        email_verified=True,
        created_at=datetime.now(timezone.utc),
    )


def make_response(configured=False):
    return AlertSettingsResponse(
        enabled=True,
        default_notify_days_before=7,
        channels=AlertChannels(in_app=True, email=False, webhook=configured),
        webhook_url_preview="https://hooks.example.test/***" if configured else None,
        webhook_configured=configured,
    )


async def fake_db():
    yield object()


def make_app(user):
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_user] = lambda: user
    return app


@pytest.mark.asyncio
async def test_get_settings_returns_safe_response_and_checks_admin_access(monkeypatch):
    user = make_user()
    project_id = uuid4()
    app = make_app(user)
    project_service = MagicMock()
    project_service.check_user_access = AsyncMock(return_value=MagicMock(role="owner"))
    project_service.get_project = AsyncMock(return_value=SimpleNamespace(id=project_id, settings={}))
    settings_service = MagicMock()
    settings_service.get.return_value = make_response(configured=True)
    monkeypatch.setattr("app.routers.alert_settings.ProjectService", lambda db: project_service)
    monkeypatch.setattr("app.routers.alert_settings.AlertSettingsService", lambda: settings_service)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/projects/{project_id}/alert-settings")

    assert response.status_code == 200
    assert response.json() == {
        "enabled": True,
        "default_notify_days_before": 7,
        "channels": {"in_app": True, "email": False, "webhook": True},
        "webhook_url_preview": "https://hooks.example.test/***",
        "webhook_configured": True,
    }
    project_service.check_user_access.assert_awaited_once_with(user.id, project_id, "admin")


@pytest.mark.asyncio
async def test_patch_merges_through_service_and_audits_sanitized_metadata(monkeypatch):
    user = make_user()
    project_id = uuid4()
    app = make_app(user)
    project = SimpleNamespace(id=project_id, settings={"vault": {"version": 1}, "other": {"keep": True}})
    project_service = MagicMock()
    project_service.check_user_access = AsyncMock(return_value=MagicMock(role="admin"))
    project_service.get_project = AsyncMock(return_value=project)
    settings_service = MagicMock()
    settings_service.update = AsyncMock(return_value=make_response(configured=True))
    audit = MagicMock()
    audit.log = AsyncMock()
    monkeypatch.setattr("app.routers.alert_settings.ProjectService", lambda db: project_service)
    monkeypatch.setattr("app.routers.alert_settings.AlertSettingsService", lambda: settings_service)
    monkeypatch.setattr("app.routers.alert_settings.AuditService", lambda db: audit)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.patch(
            f"/api/v1/projects/{project_id}/alert-settings",
            json={"enabled": False, "webhook_url": "https://hooks.example.test/secret"},
        )

    assert response.status_code == 200
    settings_service.update.assert_awaited_once()
    audit.log.assert_awaited_once()
    audit_kwargs = audit.log.await_args.kwargs
    assert audit_kwargs["action"] == "project.alert_settings_updated"
    assert audit_kwargs["resource_type"] == "project"
    assert audit_kwargs["metadata"] == {"changed_fields": ["enabled", "webhook_url"]}
    assert "secret" not in str(audit_kwargs)


@pytest.mark.asyncio
async def test_developer_is_denied_and_does_not_mutate(monkeypatch):
    user = make_user()
    project_id = uuid4()
    app = make_app(user)
    project_service = MagicMock()
    project_service.check_user_access = AsyncMock(return_value=None)
    settings_service = MagicMock()
    settings_service.update = AsyncMock()
    monkeypatch.setattr("app.routers.alert_settings.ProjectService", lambda db: project_service)
    monkeypatch.setattr("app.routers.alert_settings.AlertSettingsService", lambda: settings_service)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.patch(
            f"/api/v1/projects/{project_id}/alert-settings",
            json={"enabled": False},
        )

    assert response.status_code == 404
    settings_service.update.assert_not_awaited()


@pytest.mark.asyncio
async def test_test_webhook_uses_stored_config_canonical_payload_and_audits(monkeypatch):
    user = make_user()
    project_id = uuid4()
    app = make_app(user)
    project = SimpleNamespace(
        id=project_id,
        name="Alerts Project",
        settings={"alerts": {"webhook_url": {"encrypted": True}}},
    )
    project_service = MagicMock()
    project_service.check_user_access = AsyncMock(return_value=MagicMock(role="admin"))
    project_service.get_project = AsyncMock(return_value=project)
    settings_service = MagicMock()
    settings_service.get_webhook_url.return_value = "https://hooks.example.test/secret"
    webhook_service = MagicMock()
    webhook_service.send = AsyncMock(return_value=SimpleNamespace(success=True, status_code=204))
    audit = MagicMock()
    audit.log = AsyncMock()
    monkeypatch.setattr("app.routers.alert_settings.ProjectService", lambda db: project_service)
    monkeypatch.setattr("app.routers.alert_settings.AlertSettingsService", lambda: settings_service)
    validator = AsyncMock(return_value="https://hooks.example.test/secret")
    monkeypatch.setattr("app.routers.alert_settings.validate_webhook_url", validator)
    monkeypatch.setattr("app.routers.alert_settings.WebhookService", lambda: webhook_service)
    monkeypatch.setattr("app.routers.alert_settings.AuditService", lambda db: audit)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/projects/{project_id}/alert-settings/test-webhook")

    assert response.status_code == 200
    assert webhook_service.send.await_args.args[0] == "https://hooks.example.test/secret"
    assert webhook_service.send.await_args.args[1] == "alert.test"
    actual_payload = webhook_service.send.await_args.args[2]
    expected_payload = build_alert_payload(
        project_id=project_id,
        project_name="Alerts Project",
        action_url=f"/projects/{project_id}/alerts",
        test=True,
    )
    assert actual_payload.keys() == expected_payload.keys()
    assert {key: value for key, value in actual_payload.items() if key != "timestamp"} == {
        key: value for key, value in expected_payload.items() if key != "timestamp"
    }
    validator.assert_awaited_once_with("https://hooks.example.test/secret", "development")
    audit_kwargs = audit.log.await_args.kwargs
    assert audit_kwargs["action"] == "alert_settings.test_webhook"
    assert audit_kwargs["resource_type"] == "project"
    assert audit_kwargs["metadata"] == {"action": "test_webhook", "success": True}
    assert "secret" not in str(audit_kwargs)


@pytest.mark.asyncio
async def test_test_webhook_revalidates_unsafe_stored_url_and_returns_422(monkeypatch):
    user = make_user()
    project_id = uuid4()
    app = make_app(user)
    project = SimpleNamespace(
        id=project_id,
        name="Alerts Project",
        settings={"alerts": {"webhook_url": {"encrypted": True}}},
    )
    project_service = MagicMock()
    project_service.check_user_access = AsyncMock(return_value=MagicMock(role="admin"))
    project_service.get_project = AsyncMock(return_value=project)
    settings_service = MagicMock()
    settings_service.get_webhook_url.return_value = "https://127.0.0.1/hook"
    webhook_service = MagicMock()
    webhook_service.send = AsyncMock()
    monkeypatch.setattr("app.routers.alert_settings.ProjectService", lambda db: project_service)
    monkeypatch.setattr("app.routers.alert_settings.AlertSettingsService", lambda: settings_service)
    monkeypatch.setattr("app.routers.alert_settings.WebhookService", lambda: webhook_service)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/projects/{project_id}/alert-settings/test-webhook")

    assert response.status_code == 422
    webhook_service.send.assert_not_awaited()


@pytest.mark.asyncio
async def test_test_webhook_does_not_return_delivery_error_details(monkeypatch):
    user = make_user()
    project_id = uuid4()
    app = make_app(user)
    project = SimpleNamespace(
        id=project_id,
        name="Alerts Project",
        settings={"alerts": {"webhook_url": {"encrypted": True}}},
    )
    project_service = MagicMock()
    project_service.check_user_access = AsyncMock(return_value=MagicMock(role="admin"))
    project_service.get_project = AsyncMock(return_value=project)
    settings_service = MagicMock()
    settings_service.get_webhook_url.return_value = "https://hooks.example.test/hook?token=topsecret"
    webhook_service = MagicMock()
    webhook_service.send = AsyncMock(return_value=SimpleNamespace(
        success=False,
        status_code=502,
        error="failed https://hooks.example.test/hook?token=topsecret response body=private",
    ))
    monkeypatch.setattr("app.routers.alert_settings.ProjectService", lambda db: project_service)
    monkeypatch.setattr("app.routers.alert_settings.AlertSettingsService", lambda: settings_service)
    monkeypatch.setattr("app.routers.alert_settings.validate_webhook_url", AsyncMock())
    monkeypatch.setattr("app.routers.alert_settings.WebhookService", lambda: webhook_service)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/projects/{project_id}/alert-settings/test-webhook")

    assert response.status_code == 502
    assert response.json() == {"detail": "Webhook delivery failed"}
    assert "topsecret" not in response.text
    assert "private" not in response.text


@pytest.mark.asyncio
async def test_patch_rejects_unsafe_webhook_url_with_422(monkeypatch):
    user = make_user()
    project_id = uuid4()
    app = make_app(user)
    project_service = MagicMock()
    project_service.check_user_access = AsyncMock(return_value=MagicMock(role="admin"))
    project_service.get_project = AsyncMock(return_value=SimpleNamespace(id=project_id, settings={}))
    settings_service = MagicMock()
    settings_service.update = AsyncMock(
        side_effect=AlertSettingsConfigurationError("Unable to safely configure alert settings")
    )
    monkeypatch.setattr("app.routers.alert_settings.ProjectService", lambda db: project_service)
    monkeypatch.setattr("app.routers.alert_settings.AlertSettingsService", lambda: settings_service)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.patch(
            f"/api/v1/projects/{project_id}/alert-settings",
            json={"webhook_url": "https://127.0.0.1/hook"},
        )

    assert response.status_code == 422
    assert response.json()["detail"] == "Unable to safely configure alert settings"


def test_alert_payload_builder_is_canonical_and_excludes_secret_material():
    payload = build_alert_payload(
        project_id=uuid4(),
        project_name="Alerts Project",
        environment_id=uuid4(),
        environment_name="Production",
        action_url="/projects/example/alerts",
        test=True,
    )

    assert payload["payload_version"] == 1
    assert payload["test"] is True
    assert payload["project_name"] == "Alerts Project"
    assert payload["environment_name"] == "Production"
    assert payload["action_url"] == "/projects/example/alerts"
    assert "webhook_url" not in payload
    assert "secret" not in str(payload)


def test_webhook_channel_does_not_follow_redirects():
    assert WebhookChannel().follow_redirects is False


def test_main_openapi_registers_alert_settings_paths():
    from main import app

    paths = app.openapi()["paths"]
    assert "/api/v1/projects/{project_id}/alert-settings" in paths
    assert "/api/v1/projects/{project_id}/alert-settings/test-webhook" in paths
