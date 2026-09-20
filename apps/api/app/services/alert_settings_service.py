import asyncio
import ipaddress
import socket
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

from pydantic import ValidationError

from app.config import settings
from app.crypto.integration_config import (
    IntegrationConfigEncryption,
    IntegrationConfigEncryptionError,
)
from app.schemas.alert_settings import (
    AlertSettings,
    AlertSettingsPatch,
    AlertSettingsResponse,
)


class AlertSettingsConfigurationError(ValueError):
    """Raised when alert configuration cannot be safely read or written."""


@dataclass(frozen=True)
class ValidatedWebhookTarget:
    original_url: str
    request_url: str
    host_header: str
    sni_hostname: str
    resolved_ip: str


async def validate_webhook_url(url: str, environment: str) -> str:
    """Validate a webhook target against the SSRF-safe alert URL policy."""
    await resolve_webhook_target(url, environment)
    return url


async def resolve_webhook_target(url: str, environment: str) -> ValidatedWebhookTarget:
    """Validate and resolve a webhook URL for connection-pinned delivery."""
    try:
        parsed = urlsplit(url)
        hostname = parsed.hostname
        port = parsed.port
    except ValueError as exc:
        raise ValueError("Invalid webhook URL") from exc

    if not hostname or parsed.username or parsed.password:
        raise ValueError("Webhook URL must not contain credentials")

    if port == 0:
        raise ValueError("Webhook URL port is not supported")

    hostname = hostname.rstrip(".").lower()
    is_localhost = hostname == "localhost"
    is_development = environment.lower() in {"development", "dev", "test", "testing"}

    if parsed.scheme == "http":
        if not (is_localhost and is_development):
            raise ValueError("Webhook URL must use HTTPS")
    elif parsed.scheme != "https":
        raise ValueError("Webhook URL must use HTTP or HTTPS")

    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        address = None

    if address and (
        address.is_private
        or address.is_reserved
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_unspecified
    ):
        raise ValueError("Webhook URL target is not public")

    if port is not None and not (
        (parsed.scheme == "https" and port == 443)
        or (parsed.scheme == "http" and is_localhost and is_development)
    ):
        raise ValueError("Webhook URL port is not supported")

    try:
        resolved = await asyncio.get_running_loop().getaddrinfo(
            hostname,
            port or (80 if parsed.scheme == "http" else 443),
            type=socket.SOCK_STREAM,
        )
    except (OSError, ValueError) as exc:
        raise ValueError("Webhook URL host could not be resolved") from exc

    if not resolved:
        raise ValueError("Webhook URL host could not be resolved")

    local_development_exception = (
        parsed.scheme == "http" and is_localhost and is_development
    )
    for result in resolved:
        resolved_host = result[4][0]
        try:
            resolved_address = ipaddress.ip_address(resolved_host)
        except ValueError as exc:
            raise ValueError("Webhook URL resolved to an invalid address") from exc
        mapped_address = getattr(resolved_address, "ipv4_mapped", None)
        address_to_check = mapped_address or resolved_address
        if not local_development_exception and (
            not address_to_check.is_global
            or address_to_check.is_private
            or address_to_check.is_reserved
            or address_to_check.is_loopback
            or address_to_check.is_link_local
            or address_to_check.is_multicast
            or address_to_check.is_unspecified
        ):
            raise ValueError("Webhook URL target is not public")

    resolved_ip = resolved[0][4][0]
    ip_netloc = f"[{resolved_ip}]" if ":" in resolved_ip else resolved_ip
    if port is not None:
        ip_netloc = f"{ip_netloc}:{port}"
    request_url = f"{parsed.scheme}://{ip_netloc}{parsed.path or '/'}"
    if parsed.query:
        request_url = f"{request_url}?{parsed.query}"

    return ValidatedWebhookTarget(
        original_url=url,
        request_url=request_url,
        host_header=parsed.netloc,
        sni_hostname=hostname,
        resolved_ip=resolved_ip,
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
