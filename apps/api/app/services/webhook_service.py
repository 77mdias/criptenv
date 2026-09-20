"""Webhook Service for M3.5 Secret Alerts

Sends HTTP notifications when secrets are approaching expiration.
Implements retry logic with exponential backoff.

GRASP Patterns:
- Information Expert: Knows webhook delivery state
- Pure Fabrication: Abstracts HTTP notification logic
- Protected Variations: NotificationChannel interface for future email/slack
"""

import httpx
import asyncio
import re
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, Protocol, runtime_checkable
from uuid import UUID

from app.config import settings
from app.services.alert_payload import build_alert_payload
from app.services.alert_settings_service import (
    resolve_webhook_target,
    ValidatedWebhookTarget,
)
from app.models.alert_delivery import AlertDelivery


@dataclass
class DeliveryResult:
    """Result of a webhook delivery attempt.
    
    GRASP Pure Fabrication: Encapsulates delivery outcome.
    """
    success: bool
    attempts: int
    error: Optional[str] = None
    status_code: Optional[int] = None


def sanitize_delivery_error(error: object) -> str:
    """Return a safe, category-level delivery error without request details."""
    text = str(error or "").strip()
    if re.fullmatch(r"HTTP \d{3}", text):
        return text

    normalized = text.lower()
    if "timeout" in normalized:
        return "timeout"
    invalid_target_error = (
        "invalid" in normalized
        or "dns" in normalized
        or "resolve" in normalized
        or "host could not" in normalized
    )
    if invalid_target_error:
        return "invalid_target"
    if "request error" in normalized or "connection" in normalized or "network" in normalized:
        return "request_error"
    if normalized in {"timeout", "invalid_target", "request_error", "delivery_error"}:
        return normalized
    return "delivery_error"


@runtime_checkable
class NotificationChannel(Protocol):
    """Abstract notification channel — GRASP Protected Variations.
    
    Future implementations: EmailChannel, SlackChannel
    Allows swapping notification mechanisms without changing WebhookService.
    """
    
    async def send(
        self,
        url: str,
        payload: dict,
        idempotency_key: Optional[str] = None,
    ) -> DeliveryResult:
        """Send notification to target URL.
        
        Args:
            url: Target notification URL
            payload: Notification payload
            
        Returns:
            DeliveryResult with success status and attempt count
        """
        ...


class WebhookChannel(NotificationChannel):
    """HTTP webhook notification channel.
    
    GRASP Information Expert: Knows how to send HTTP notifications.
    GRASP Protected Variations: Extensible via channel interface.
    """
    
    def __init__(self, timeout: float = 10.0, follow_redirects: bool = False):
        """Initialize webhook channel.
        
        Args:
            timeout: HTTP request timeout in seconds
        """
        self.timeout = timeout
        self.follow_redirects = follow_redirects
    
    async def send(
        self,
        url: str,
        payload: dict,
        idempotency_key: Optional[str] = None,
    ) -> DeliveryResult:
        """Send webhook POST request.
        
        Args:
            url: Webhook URL
            payload: JSON payload
            
        Returns:
            DeliveryResult with HTTP status
        """
        try:
            target = await resolve_webhook_target(url, settings.APP_ENV)
            async with httpx.AsyncClient(
                timeout=self.timeout,
                follow_redirects=self.follow_redirects,
                trust_env=False,
            ) as client:
                headers = {"Host": target.host_header}
                if idempotency_key is not None:
                    headers["Idempotency-Key"] = idempotency_key
                response = await client.post(
                    target.request_url,
                    headers=headers,
                    json=payload,
                    extensions={"sni_hostname": target.sni_hostname},
                )
                return DeliveryResult(
                    success=200 <= response.status_code < 300,
                    attempts=1,
                    status_code=response.status_code
                )
        except httpx.TimeoutException as e:
            return DeliveryResult(
                success=False,
                attempts=1,
                error=sanitize_delivery_error(e)
            )
        except httpx.RequestError as e:
            return DeliveryResult(
                success=False,
                attempts=1,
                error=sanitize_delivery_error(e)
            )
        except ValueError as e:
            return DeliveryResult(
                success=False,
                attempts=1,
                error=sanitize_delivery_error(e),
            )
        except Exception as e:
            return DeliveryResult(
                success=False,
                attempts=1,
                error=sanitize_delivery_error(e),
            )


class WebhookService:
    """Service for sending webhook notifications.
    
    GRASP Information Expert: Manages webhook delivery lifecycle
    GRASP Pure Fabrication: Encapsulates HTTP notification logic
    GRASP Protected Variations: Channel abstraction for future extensibility
    GRASP Low Coupling: Decoupled from specific HTTP implementations
    """
    
    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        channel: Optional[NotificationChannel] = None
    ):
        """Initialize webhook service.
        
        Args:
            max_retries: Maximum retry attempts (default: 3)
            base_delay: Base delay for exponential backoff in seconds (default: 1.0)
            channel: Notification channel to use (default: WebhookChannel)
        """
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.channel = channel or WebhookChannel()
    
    def build_payload(
        self,
        event: str,
        project_id: str,
        environment: str,
        secret_key: str,
        expires_at: datetime,
        notify_days_before: int = 7,
        days_until_expiration: Optional[int] = None
    ) -> Dict[str, Any]:
        """Build webhook payload following documented format.
        
        GRASP Protected Variations: NEVER includes secret values.
        The payload format is documented and stable.
        
        Args:
            event: Event type (e.g., 'secret.expiring', 'secret.expired')
            project_id: Project UUID
            environment: Environment name
            secret_key: Secret key identifier (NOT the value)
            expires_at: Expiration datetime
            notify_days_before: Days before expiration for notification
            days_until_expiration: Optional computed days until expiration
            
        Returns:
            Dict payload suitable for JSON serialization
        """
        return build_alert_payload(
            event=event,
            project_id=UUID(project_id),
            environment=environment,
            secret_key=secret_key,
            expires_at=expires_at,
            notify_days_before=notify_days_before,
            days_until_expiration=days_until_expiration,
        )
    
    async def send(
        self,
        webhook_url: str,
        event: str,
        payload: Dict[str, Any],
        idempotency_key: Optional[str] = None,
        delivery: Optional[AlertDelivery] = None,
    ) -> DeliveryResult:
        """Send webhook notification with retry logic.
        
        Implements exponential backoff: 1s, 2s, 4s, ...
        
        Args:
            webhook_url: Target URL for POST
            event: Event type (e.g., 'secret.expiring')
            payload: Event payload (must NOT contain secret values)
            
        Returns:
            DeliveryResult with success status and attempt count
        """
        idempotency_key = idempotency_key or (delivery.idempotency_key if delivery else None)
        last_error = None
        
        for attempt in range(1, self.max_retries + 1):
            try:
                if idempotency_key is None:
                    result = await self.channel.send(webhook_url, payload)
                else:
                    result = await self.channel.send(
                        webhook_url,
                        payload,
                        idempotency_key=idempotency_key,
                    )
                
                if result.success:
                    return DeliveryResult(
                        success=True,
                        attempts=attempt,
                        status_code=result.status_code
                    )
                
                last_error = (
                    f"HTTP {result.status_code}"
                    if result.status_code
                    else sanitize_delivery_error(result.error)
                )
                
            except Exception as e:
                last_error = sanitize_delivery_error(e)
            
            # Exponential backoff: 1s, 2s, 4s, ...
            if attempt < self.max_retries:
                delay = self.base_delay * (2 ** (attempt - 1))
                await asyncio.sleep(delay)
        
        return DeliveryResult(
            success=False,
            attempts=self.max_retries,
            error=last_error
        )
    
    async def notify_expiration(
        self,
        webhook_url: str,
        project_id: UUID,
        environment: str,
        secret_key: str,
        expires_at: datetime,
        notify_days_before: int = 7,
        days_until_expiration: Optional[int] = None,
        event: str = "secret.expiring"
    ) -> DeliveryResult:
        """Convenience method to send expiration notification.
        
        Args:
            webhook_url: Target webhook URL
            project_id: Project UUID
            environment: Environment name
            secret_key: Secret key identifier
            expires_at: Expiration datetime
            notify_days_before: Days before expiration for notification
            days_until_expiration: Optional computed days until expiration
            event: Event type (default: 'secret.expiring')
            
        Returns:
            DeliveryResult from webhook delivery
        """
        payload = self.build_payload(
            event=event,
            project_id=str(project_id),
            environment=environment,
            secret_key=secret_key,
            expires_at=expires_at,
            notify_days_before=notify_days_before,
            days_until_expiration=days_until_expiration
        )
        
        return await self.send(webhook_url=webhook_url, event=event, payload=payload)
