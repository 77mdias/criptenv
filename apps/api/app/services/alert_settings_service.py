from typing import Any
from urllib.parse import urlsplit

from pydantic import ValidationError

from app.config import settings
from app.crypto.integration_config import (
    IntegrationConfigEncryption,
    IntegrationConfigEncryptionError,
)
from app.services.outbound_target import PinnedTarget, resolve_public_target
from app.schemas.alert_settings import (
    AlertSettings,
    AlertSettingsPatch,
    AlertSettingsResponse,
)


class AlertSettingsConfigurationError(ValueError):
    """Raised when alert configuration cannot be safely read or written."""


# Kept under the webhook names so existing callers and tests stay unchanged.
ValidatedWebhookTarget = PinnedTarget

DEVELOPMENT_ENVIRONMENTS = {"development", "dev", "test", "testing"}


async def validate_webhook_url(url: str, environment: str) -> str:
    """Validate a webhook target against the SSRF-safe alert URL policy."""
    await resolve_webhook_target(url, environment)
    return url


async def resolve_webhook_target(url: str, environment: str) -> ValidatedWebhookTarget:
    """Validate and resolve a webhook URL for connection-pinned delivery."""
    return await resolve_public_target(
        url, allow_localhost_http=environment.lower() in DEVELOPMENT_ENVIRONMENTS
    )


class AlertSettingsService:
    """Read and update project alert settings without exposing webhook secrets."""

    def get(self, project: Any) -> AlertSettingsResponse:
        alerts = self._alerts(project)
        webhook_url = self._decrypt_webhook_url(alerts.get("webhook_url"))
        try:
            config = AlertSettings.model_validate({
                key: value for key, value in alerts.items() if key != "webhook_url"
            })
        except ValidationError as exc:
            raise AlertSettingsConfigurationError(
                "Unable to safely configure alert settings"
            ) from exc
        return self._response(config, webhook_url, alerts.get("webhook_url"))

    def get_webhook_url(self, project: Any) -> str | None:
        """Return the decrypted URL only to an internal delivery boundary."""
        alerts = self._alerts(project)
        return self._decrypt_webhook_url(alerts.get("webhook_url"))

    async def update(self, project: Any, patch: AlertSettingsPatch) -> AlertSettingsResponse:
        alerts = self._alerts(project)
        values = patch.model_dump(exclude_unset=True)

        if "webhook_url" in patch.model_fields_set:
            webhook_url = patch.webhook_url
            if webhook_url is None:
                alerts.pop("webhook_url", None)
            else:
                try:
                    webhook_url = await validate_webhook_url(str(webhook_url), settings.APP_ENV)
                except ValueError as exc:
                    raise AlertSettingsConfigurationError(
                        "Unable to safely configure alert settings"
                    ) from exc
                try:
                    alerts["webhook_url"] = IntegrationConfigEncryption.encrypt(
                        {"url": str(webhook_url)},
                        settings.INTEGRATION_CONFIG_SECRET,
                    )
                except IntegrationConfigEncryptionError as exc:
                    raise AlertSettingsConfigurationError(
                        "Unable to safely configure alert settings"
                    ) from exc
            values.pop("webhook_url", None)

        alerts.update(values)
        project.settings = {
            **(getattr(project, "settings", None) or {}),
            "alerts": alerts,
        }
        return self.get(project)

    @staticmethod
    def _alerts(project: Any) -> dict:
        settings_value = dict(getattr(project, "settings", None) or {})
        alerts = settings_value.get("alerts")
        return dict(alerts) if isinstance(alerts, dict) else {}

    def _decrypt_webhook_url(self, envelope: Any) -> str | None:
        if envelope is None:
            return None
        try:
            config = IntegrationConfigEncryption.decrypt(
                envelope,
                settings.INTEGRATION_CONFIG_SECRET,
            )
            url = config.get("url")
            if not isinstance(url, str):
                raise IntegrationConfigEncryptionError("Invalid webhook URL")
            return url
        except (IntegrationConfigEncryptionError, AttributeError, TypeError) as exc:
            raise AlertSettingsConfigurationError(
                "Unable to safely configure alert settings"
            ) from exc

    @staticmethod
    def _response(
        config: AlertSettings,
        webhook_url: str | None,
        webhook_envelope: Any,
    ) -> AlertSettingsResponse:
        return AlertSettingsResponse(
            enabled=config.enabled,
            default_notify_days_before=config.default_notify_days_before,
            channels=config.channels,
            webhook_url_preview=(
                AlertSettingsService._preview_url(webhook_url) if webhook_url else None
            ),
            webhook_configured=IntegrationConfigEncryption.is_encrypted(webhook_envelope),
        )

    @staticmethod
    def _preview_url(webhook_url: str) -> str:
        try:
            parsed = urlsplit(webhook_url)
            if not parsed.scheme or not parsed.hostname:
                raise ValueError("Invalid webhook URL")
            host = parsed.hostname
            if ":" in host:
                host = f"[{host}]"
            if parsed.port:
                host = f"{host}:{parsed.port}"
            authority = f"{parsed.scheme}://{host}"
            return f"{authority}/***" if parsed.path else authority
        except ValueError as exc:
            raise AlertSettingsConfigurationError(
                "Unable to safely configure alert settings"
            ) from exc
