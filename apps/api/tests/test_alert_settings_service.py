import asyncio
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.config import settings
from app.crypto.integration_config import IntegrationConfigEncryption
from app.schemas.alert_settings import (
    AlertChannels,
    AlertSettings,
    AlertSettingsPatch,
)
from app.services.alert_settings_service import (
    AlertSettingsConfigurationError,
    AlertSettingsService,
    validate_webhook_url,
)


def project_with_settings(settings_value=None):
    return SimpleNamespace(settings=settings_value or {"vault": {"version": 1}})


def mock_public_dns(monkeypatch):
    async def getaddrinfo(*args, **kwargs):
        return [(2, 1, 6, "", ("93.184.216.34", 443))]

    monkeypatch.setattr(
        asyncio,
        "get_running_loop",
        lambda: SimpleNamespace(getaddrinfo=getaddrinfo),
    )


def test_alert_settings_have_safe_defaults_and_typed_channels():
    alert_settings = AlertSettings()

    assert alert_settings.model_dump() == {
        "enabled": True,
        "default_notify_days_before": 7,
        "channels": {"in_app": True, "email": False, "webhook": False},
        "webhook_url": None,
    }


@pytest.mark.parametrize(
    "value",
    [0, 366],
)
def test_alert_settings_reject_invalid_lead_time(value):
    with pytest.raises(ValidationError):
        AlertSettings(default_notify_days_before=value)


def test_alert_channels_require_boolean_fields():
    with pytest.raises(ValidationError):
        AlertChannels(in_app=True, email=False)


@pytest.mark.parametrize("field", ["enabled", "default_notify_days_before", "channels"])
def test_alert_patch_rejects_explicit_null_for_non_nullable_fields(field):
    with pytest.raises(ValidationError):
        AlertSettingsPatch(**{field: None})


def test_alert_patch_distinguishes_omitted_webhook_url_from_explicit_null():
    omitted = AlertSettingsPatch()
    cleared = AlertSettingsPatch(webhook_url=None)

    assert "webhook_url" not in omitted.model_fields_set
    assert "webhook_url" in cleared.model_fields_set


@pytest.mark.asyncio
async def test_update_merges_only_alerts_and_encrypts_webhook_url(monkeypatch):
    mock_public_dns(monkeypatch)
    monkeypatch.setattr(settings, "INTEGRATION_CONFIG_SECRET", "a" * 32)
    project = project_with_settings({"vault": {"version": 1}, "other": {"keep": True}})

    response = await AlertSettingsService().update(
        project,
        AlertSettingsPatch(
            channels={"in_app": False, "email": True, "webhook": True},
            webhook_url="https://hooks.example.test/team/secret-token",
        ),
    )

    assert project.settings["vault"] == {"version": 1}
    assert project.settings["other"] == {"keep": True}
    assert project.settings["alerts"]["webhook_url"]["_criptenv_encrypted"] is True
    assert "https://hooks.example.test/team/secret-token" not in str(project.settings)
    assert response.webhook_url_preview == "https://hooks.example.test/***"
    assert response.webhook_configured is True


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "url",
    [
        "http://example.test/hook",
        "https://user:password@example.test/hook",
        "https://example.test:8443/hook",
        "https://127.0.0.1/hook",
        "https://192.168.1.20/hook",
        "https://169.254.1.20/hook",
        "https://224.0.0.1/hook",
    ],
)
async def test_webhook_url_validation_rejects_unsafe_urls(url):
    with pytest.raises(ValueError):
        await validate_webhook_url(url, environment="production")


@pytest.mark.asyncio
async def test_webhook_url_validation_allows_public_https(monkeypatch):
    async def getaddrinfo(*args, **kwargs):
        return [(2, 1, 6, "", ("93.184.216.34", 443))]

    monkeypatch.setattr(asyncio, "get_running_loop", lambda: SimpleNamespace(getaddrinfo=getaddrinfo))
    assert await validate_webhook_url("https://hooks.example.test:443/hook", "production") == (
        "https://hooks.example.test:443/hook"
    )


@pytest.mark.asyncio
async def test_webhook_url_validation_allows_localhost_http_only_in_development(monkeypatch):
    async def getaddrinfo(*args, **kwargs):
        return [(2, 1, 6, "", ("127.0.0.1", 8000))]

    monkeypatch.setattr(asyncio, "get_running_loop", lambda: SimpleNamespace(getaddrinfo=getaddrinfo))
    assert await validate_webhook_url("http://localhost:8000/hook", "development") == (
        "http://localhost:8000/hook"
    )

    with pytest.raises(ValueError):
        await validate_webhook_url("http://localhost:8000/hook", "production")


@pytest.mark.asyncio
async def test_webhook_url_validation_rejects_explicit_port_zero(monkeypatch):
    mock_public_dns(monkeypatch)

    with pytest.raises(ValueError):
        await validate_webhook_url("http://localhost:0/hook", "development")


@pytest.mark.asyncio
async def test_webhook_url_validation_rejects_hostname_resolving_to_private_address(monkeypatch):
    async def getaddrinfo(*args, **kwargs):
        return [(2, 1, 6, "", ("10.0.0.8", 443))]

    monkeypatch.setattr(asyncio, "get_running_loop", lambda: SimpleNamespace(getaddrinfo=getaddrinfo))

    with pytest.raises(ValueError):
        await validate_webhook_url("https://internal.example.test/hook", "production")


@pytest.mark.asyncio
async def test_webhook_url_validation_rejects_any_unsafe_address_in_results(monkeypatch):
    async def getaddrinfo(*args, **kwargs):
        return [
            (2, 1, 6, "", ("10.0.0.8", 443)),
            (2, 1, 6, "", ("93.184.216.34", 443)),
        ]

    monkeypatch.setattr(asyncio, "get_running_loop", lambda: SimpleNamespace(getaddrinfo=getaddrinfo))

    with pytest.raises(ValueError):
        await validate_webhook_url("https://mixed.example.test/hook", "production")


@pytest.mark.asyncio
async def test_webhook_url_validation_rejects_localhost_dot_form(monkeypatch):
    async def getaddrinfo(*args, **kwargs):
        return [(2, 1, 6, "", ("127.0.0.1", 443))]

    monkeypatch.setattr(asyncio, "get_running_loop", lambda: SimpleNamespace(getaddrinfo=getaddrinfo))

    with pytest.raises(ValueError):
        await validate_webhook_url("https://localhost./hook", "production")


@pytest.mark.asyncio
async def test_webhook_url_validation_rejects_ipv4_mapped_ipv6(monkeypatch):
    async def getaddrinfo(*args, **kwargs):
        return [(10, 1, 6, "", ("::ffff:127.0.0.1", 443, 0, 0))]

    monkeypatch.setattr(asyncio, "get_running_loop", lambda: SimpleNamespace(getaddrinfo=getaddrinfo))

    with pytest.raises(ValueError):
        await validate_webhook_url("https://mapped.example.test/hook", "production")


@pytest.mark.asyncio
async def test_webhook_url_validation_rejects_ipv4_cgnat_address(monkeypatch):
    async def getaddrinfo(*args, **kwargs):
        return [(2, 1, 6, "", ("100.64.0.1", 443))]

    monkeypatch.setattr(asyncio, "get_running_loop", lambda: SimpleNamespace(getaddrinfo=getaddrinfo))

    with pytest.raises(ValueError):
        await validate_webhook_url("https://shared.example.test/hook", "production")


@pytest.mark.asyncio
async def test_webhook_url_validation_rejects_ipv6_non_global_address(monkeypatch):
    async def getaddrinfo(*args, **kwargs):
        return [(10, 1, 6, "", ("2001:db8::1", 443, 0, 0))]

    monkeypatch.setattr(asyncio, "get_running_loop", lambda: SimpleNamespace(getaddrinfo=getaddrinfo))

    with pytest.raises(ValueError):
        await validate_webhook_url("https://non-global.example.test/hook", "production")


@pytest.mark.asyncio
async def test_read_returns_preview_and_never_encrypted_envelope(monkeypatch):
    mock_public_dns(monkeypatch)
    monkeypatch.setattr(settings, "INTEGRATION_CONFIG_SECRET", "b" * 32)
    project = project_with_settings()
    await AlertSettingsService().update(project, AlertSettingsPatch(webhook_url="https://example.test/hook"))

    response = AlertSettingsService().get(project)

    assert response.webhook_url_preview == "https://example.test/***"
    assert response.webhook_configured is True
    assert "ciphertext" not in response.model_dump()
    assert "webhook_url" not in response.model_dump()


@pytest.mark.asyncio
async def test_omitted_webhook_url_preserves_it_and_explicit_null_clears_it(monkeypatch):
    mock_public_dns(monkeypatch)
    monkeypatch.setattr(settings, "INTEGRATION_CONFIG_SECRET", "d" * 32)
    project = project_with_settings()
    service = AlertSettingsService()
    await service.update(project, AlertSettingsPatch(webhook_url="https://example.test/hook"))

    await service.update(project, AlertSettingsPatch(enabled=False))
    assert service.get(project).webhook_url_preview == "https://example.test/***"

    cleared = await service.update(project, AlertSettingsPatch(webhook_url=None))
    assert cleared.webhook_url_preview is None
    assert cleared.webhook_configured is False
    assert "webhook_url" not in project.settings["alerts"]


def test_read_fails_closed_when_encrypted_url_cannot_be_decrypted(monkeypatch):
    monkeypatch.setattr(settings, "INTEGRATION_CONFIG_SECRET", "c" * 32)
    project = project_with_settings({"alerts": {"webhook_url": {"_criptenv_encrypted": True}}})

    with pytest.raises(AlertSettingsConfigurationError, match="safely configure"):
        AlertSettingsService().get(project)


def test_read_fails_closed_for_invalid_persisted_alert_settings():
    project = project_with_settings({"alerts": {"default_notify_days_before": 0}})

    with pytest.raises(AlertSettingsConfigurationError, match="safely configure"):
        AlertSettingsService().get(project)


@pytest.mark.asyncio
async def test_read_fails_closed_for_malformed_persisted_url(monkeypatch):
    mock_public_dns(monkeypatch)
    monkeypatch.setattr(settings, "INTEGRATION_CONFIG_SECRET", "e" * 32)
    project = project_with_settings()
    service = AlertSettingsService()
    await service.update(project, AlertSettingsPatch(webhook_url="https://example.test/hook"))
    project.settings["alerts"]["webhook_url"] = IntegrationConfigEncryption.encrypt(
        {"url": "https://example.test:bad"},
        settings.INTEGRATION_CONFIG_SECRET,
    )

    with pytest.raises(AlertSettingsConfigurationError, match="safely configure"):
        service.get(project)


@pytest.mark.asyncio
async def test_update_fails_closed_without_encryption_secret(monkeypatch):
    mock_public_dns(monkeypatch)
    monkeypatch.setattr(settings, "INTEGRATION_CONFIG_SECRET", "")

    with pytest.raises(AlertSettingsConfigurationError, match="safely configure"):
        await AlertSettingsService().update(
            project_with_settings(),
            AlertSettingsPatch(webhook_url="https://example.test/hook"),
        )
