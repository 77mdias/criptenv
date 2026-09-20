"""Expiration alert email rendering and delivery."""

import asyncio
from dataclasses import dataclass
from html import escape
from typing import Any

from app.config import settings
from app.services.email_service import EmailService
from app.services.webhook_service import sanitize_delivery_error


@dataclass(frozen=True)
class EmailDeliveryResult:
    success: bool
    error: str | None = None


def build_expiration_email(payload: dict[str, Any]) -> tuple[str, str]:
    """Build an escaped HTML email and a plain-text fallback from alert metadata."""
    project = escape(str(payload.get("project_name") or payload.get("project_id") or "Project"))
    environment = escape(str(payload.get("environment_name") or payload.get("environment") or "Environment"))
    secret_key = escape(str(payload.get("secret_key") or "secret"))
    expires_at = escape(str(payload.get("expires_at") or "unknown"))
    days_value = payload.get("days_until_expiration")
    days = escape(str(days_value if days_value is not None else "unknown"))
    action_url_value = str(payload.get("action_url") or "")
    if action_url_value.startswith("/"):
        action_url_value = f"{settings.FRONTEND_URL.rstrip('/')}{action_url_value}"
    action_url = escape(action_url_value, quote=True)

    html = (
        "<html><body>"
        f"<h1>Secret expiration alert</h1><p>Project: <strong>{project}</strong></p>"
        f"<p>Environment: <strong>{environment}</strong></p>"
        f"<p>Secret key: <strong>{secret_key}</strong></p>"
        f"<p>Expires at: {expires_at}</p><p>Days remaining: {days}</p>"
        f"<p><a href=\"{action_url}\">Open project secrets</a></p>"
        "</body></html>"
    )
    text = (
        "Secret expiration alert\n\n"
        f"Project: {payload.get('project_name') or payload.get('project_id') or 'Project'}\n"
        f"Environment: {payload.get('environment_name') or payload.get('environment') or 'Environment'}\n"
        f"Secret key: {payload.get('secret_key') or 'secret'}\n"
        f"Expires at: {payload.get('expires_at') or 'unknown'}\n"
        f"Days remaining: {days_value if days_value is not None else 'unknown'}\n"
        f"Open project secrets: {action_url_value}\n"
    )
    return html, text


class EmailAlertService:
    """Offload the synchronous Resend SDK once for each claimed delivery."""

    def __init__(self, email_service: EmailService | None = None):
        self.email_service = email_service or EmailService()

    async def send(self, recipient: str, payload: dict[str, Any]) -> EmailDeliveryResult:
        if not getattr(self.email_service, "enabled", False):
            return EmailDeliveryResult(False, "email_disabled")

        html, text = build_expiration_email(payload)
        try:
            response = await asyncio.to_thread(
                self.email_service.send_alert,
                recipient,
                html,
                text,
            )
        except Exception as exc:
            return EmailDeliveryResult(False, sanitize_delivery_error(exc))

        if not response or (isinstance(response, dict) and response.get("error")):
            return EmailDeliveryResult(False, "email_provider_error")
        return EmailDeliveryResult(True)
