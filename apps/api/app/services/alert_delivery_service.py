from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID
import secrets

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert_delivery import AlertDelivery
from app.models.notification import Notification
from app.models.member import ProjectMember
from app.models.project import Project
from app.models.user import User
from app.services.email_alert_service import EmailAlertService
from app.services.notification_service import NotificationService
from app.services.webhook_service import DeliveryResult, WebhookService
from app.services.webhook_service import sanitize_delivery_error


class AlertDeliveryService:
    MAX_ATTEMPTS = 3
    LEASE = timedelta(minutes=15)

    def __init__(
        self,
        db: AsyncSession,
        *,
        email_service: EmailAlertService | None = None,
        webhook_service: WebhookService | None = None,
    ):
        self.db = db
        self.email_service = email_service or EmailAlertService()
        self.webhook_service = webhook_service or WebhookService(max_retries=1)

    async def resolve_recipients(self, project_id: UUID, *, email: bool = False) -> list[User]:
        """Resolve the owner plus accepted owner/admin members, once per user."""
        owner_query = (
            select(User)
            .join(Project, Project.owner_id == User.id)
            .where(Project.id == project_id)
        )
        member_query = (
            select(User)
            .join(ProjectMember, ProjectMember.user_id == User.id)
            .where(
                ProjectMember.project_id == project_id,
                ProjectMember.accepted_at.is_not(None),
                ProjectMember.role.in_(["owner", "admin"]),
            )
        )
        if email:
            owner_query = owner_query.where(User.email_verified.is_(True))
            member_query = member_query.where(User.email_verified.is_(True))
        query = owner_query.union(member_query)
        result = await self.db.execute(query)
        users = list(result.scalars().all())
        deduped: dict[UUID, User] = {}
        for user in users:
            deduped.setdefault(user.id, user)
        return list(deduped.values())

    async def deliver_channels(
        self,
        *,
        project_id: UUID,
        expiration_id: UUID,
        event: str,
        payload: dict,
        channels: dict[str, bool],
        webhook_url: str | None = None,
        materialized_deliveries: list[AlertDelivery] | None = None,
        recipient_users: dict[str, User] | None = None,
    ) -> list[DeliveryResult]:
        """Fan out claimed deliveries without re-resolving a materialized set."""
        results: list[DeliveryResult] = []

        async def attempt(channel_call):
            try:
                return await channel_call()
            except Exception as exc:
                return DeliveryResult(False, 1, sanitize_delivery_error(exc))

        if materialized_deliveries is not None:
            recipient_users = recipient_users or {}
            for delivery in materialized_deliveries:
                user = recipient_users.get(delivery.recipient_key)
                if delivery.channel == "in_app" and user is not None:
                    results.append(await attempt(lambda: self._deliver_in_app_channel(
                        project_id, expiration_id, event, user, payload, delivery=delivery
                    )))
                elif delivery.channel == "email" and user is not None:
                    results.append(await attempt(lambda: self._deliver_email_channel(
                        project_id, expiration_id, event, user, payload, delivery=delivery
                    )))
                elif delivery.channel == "webhook":
                    results.append(await attempt(lambda: self._deliver_webhook_channel(
                        project_id, expiration_id, event, webhook_url, payload, delivery=delivery
                    )))
                else:
                    claimed = await self.claim_delivery(delivery.id)
                    if claimed is None:
                        results.append(DeliveryResult(False, 0, "delivery_not_claimed"))
                    else:
                        finalized = await self.finalize_delivery(
                            claimed.id,
                            claimed.claim_token,
                            success=False,
                            error="recipient_not_found",
                            terminal=True,
                        )
                        await self.db.commit()
                        results.append(DeliveryResult(
                            False,
                            1,
                            "recipient_not_found" if finalized else "delivery_not_finalized",
                        ))
            return results

        if channels.get("in_app"):
            for user in await self.resolve_recipients(project_id):
                results.append(await attempt(lambda: self._deliver_in_app_channel(
                    project_id, expiration_id, event, user, payload
                )))
        if channels.get("email"):
            for user in await self.resolve_recipients(project_id, email=True):
                results.append(await attempt(lambda: self._deliver_email_channel(
                    project_id, expiration_id, event, user, payload
                )))
        if channels.get("webhook") and webhook_url:
            results.append(await attempt(lambda: self._deliver_webhook_channel(
                project_id, expiration_id, event, webhook_url, payload
            )))
        return results

    async def _deliver_in_app_channel(self, project_id, expiration_id, event, user, payload, *, delivery=None):
        delivery = delivery or await self.create_delivery(project_id, expiration_id, event, "in_app", str(user.id))
        claimed = await self.claim_delivery(delivery.id)
        if claimed is None:
            return DeliveryResult(False, 0, "delivery_not_claimed")
        claim_id = claimed.id
        claim_token = claimed.claim_token
        recipient_id = user.id
        await self.db.commit()
        try:
            notification = await self.deliver_in_app(
                claim_id,
                claim_token,
                recipient_id,
                "Secret expiration alert",
                f"{payload.get('secret_key', 'A secret')} is approaching expiration.",
                action_url=payload.get("action_url"),
                meta={key: payload[key] for key in ("project_id", "environment_id", "secret_key", "expires_at") if key in payload},
            )
            await self.db.commit()
            return DeliveryResult(notification is not None, 1, None if notification else "delivery_not_finalized")
        except Exception as exc:
            await self.finalize_delivery(claim_id, claim_token, success=False, error=exc)
            await self.db.commit()
            return DeliveryResult(False, 1, sanitize_delivery_error(exc))

    async def _deliver_email_channel(self, project_id, expiration_id, event, user, payload, *, delivery=None):
        delivery = delivery or await self.create_delivery(project_id, expiration_id, event, "email", str(user.id))
        claimed = await self.claim_delivery(delivery.id)
        if claimed is None:
            return DeliveryResult(False, 0, "delivery_not_claimed")
        claim_id = claimed.id
        claim_token = claimed.claim_token
        recipient_email = user.email
        await self.db.commit()
        try:
            result = await self.email_service.send(recipient_email, payload)
        except Exception as exc:
            result = type("EmailResult", (), {"success": False, "error": sanitize_delivery_error(exc)})()
        finalized = await self.finalize_delivery(claim_id, claim_token, success=result.success, error=result.error)
        await self.db.commit()
        return DeliveryResult(result.success and finalized is not None, 1, result.error)

    async def _deliver_webhook_channel(self, project_id, expiration_id, event, webhook_url, payload, *, delivery=None):
        delivery = delivery or await self.create_delivery(project_id, expiration_id, event, "webhook", f"project:{project_id}:webhook")
        claimed = await self.claim_delivery(delivery.id)
        if claimed is None:
            return DeliveryResult(False, 0, "delivery_not_claimed")
        claim_id = claimed.id
        claim_token = claimed.claim_token
        idempotency_key = claimed.idempotency_key
        await self.db.commit()
        try:
            result = await self.webhook_service.send(webhook_url, event, payload, idempotency_key=idempotency_key)
        except Exception as exc:
            safe_error = sanitize_delivery_error(exc)
            finalized = await self.finalize_delivery(
                claim_id, claim_token, success=False, error=safe_error
            )
            await self.db.commit()
            return DeliveryResult(
                False,
                1,
                safe_error if finalized is not None else "delivery_not_finalized",
            )
        finalized = await self.finalize_delivery(claim_id, claim_token, success=result.success, error=result.error)
        await self.db.commit()
        if finalized is None:
            return DeliveryResult(False, result.attempts, "delivery_not_finalized", result.status_code)
        return result

    async def create_delivery(
        self,
        project_id: UUID,
        expiration_id: UUID,
        event: str,
        channel: str,
        recipient_key: str,
    ) -> AlertDelivery:
        self._validate_recipient_key(channel, project_id, recipient_key)
        delivery_values = dict(
            project_id=project_id,
            expiration_id=expiration_id,
            event=event,
            channel=channel,
            recipient_key=recipient_key,
        )
        result = await self.db.execute(
            insert(AlertDelivery)
            .values(**delivery_values)
            .on_conflict_do_nothing(
                index_elements=[
                    AlertDelivery.expiration_id,
                    AlertDelivery.event,
                    AlertDelivery.channel,
                    AlertDelivery.recipient_key,
                ]
            )
            .returning(AlertDelivery)
        )
        delivery = result.scalar_one_or_none()
        if delivery is not None:
            return delivery

        result = await self.db.execute(
            select(AlertDelivery).where(
                AlertDelivery.expiration_id == expiration_id,
                AlertDelivery.event == event,
                AlertDelivery.channel == channel,
                AlertDelivery.recipient_key == recipient_key,
            )
        )
        return result.scalar_one_or_none()

    async def claim_delivery(
        self,
        delivery_id: UUID,
        now: Optional[datetime] = None,
    ) -> Optional[AlertDelivery]:
        now = now or datetime.now(timezone.utc)
        exhausted = await self.db.execute(
            update(AlertDelivery)
            .where(
                AlertDelivery.id == delivery_id,
                AlertDelivery.status == "processing",
                AlertDelivery.locked_until <= now,
                AlertDelivery.attempts >= self.MAX_ATTEMPTS,
            )
            .values(status="failed", retry_after=None, locked_until=None, updated_at=now)
            .returning(AlertDelivery)
        )
        if exhausted.scalar_one_or_none() is not None:
            return None

        claim_token = secrets.token_urlsafe(32)
        result = await self.db.execute(
            update(AlertDelivery)
            .where(
                AlertDelivery.id == delivery_id,
                AlertDelivery.attempts < self.MAX_ATTEMPTS,
                (
                    (AlertDelivery.status == "pending")
                    | (
                        (AlertDelivery.status == "failed")
                        & AlertDelivery.retry_after.is_not(None)
                        & (AlertDelivery.retry_after <= now)
                    )
                    | (
                        (AlertDelivery.status == "processing")
                        & AlertDelivery.locked_until.is_not(None)
                        & (AlertDelivery.locked_until <= now)
                    )
                ),
            )
            .values(
                status="processing",
                attempts=AlertDelivery.attempts + 1,
                claim_token=claim_token,
                locked_until=now + self.LEASE,
                retry_after=None,
                updated_at=now,
            )
            .returning(AlertDelivery)
        )
        return result.scalar_one_or_none()

    async def finalize_delivery(
        self,
        delivery_id: UUID,
        claim_token: str,
        *,
        success: bool,
        error: object = None,
        retry_after: Optional[datetime] = None,
        now: Optional[datetime] = None,
        terminal: bool = False,
    ) -> Optional[AlertDelivery]:
        now = now or datetime.now(timezone.utc)
        if success:
            return (
                await self.db.execute(
                    update(AlertDelivery)
                    .where(
                        AlertDelivery.id == delivery_id,
                        AlertDelivery.claim_token == claim_token,
                        AlertDelivery.status == "processing",
                    )
                    .values(
                        status="delivered",
                        delivered_at=now,
                        retry_after=None,
                        locked_until=None,
                        last_error=None,
                        updated_at=now,
                    )
                    .returning(AlertDelivery)
                )
            ).scalar_one_or_none()

        safe_error = sanitize_delivery_error(error)
        if terminal:
            terminal_result = await self.db.execute(
                update(AlertDelivery)
                .where(
                    AlertDelivery.id == delivery_id,
                    AlertDelivery.claim_token == claim_token,
                    AlertDelivery.status == "processing",
                )
                .values(
                    status="failed",
                    last_error=safe_error,
                    retry_after=None,
                    locked_until=None,
                    updated_at=now,
                )
                .returning(AlertDelivery)
            )
            return terminal_result.scalar_one_or_none()

        attempt_limit_result = await self.db.execute(
            update(AlertDelivery)
            .where(
                AlertDelivery.id == delivery_id,
                AlertDelivery.claim_token == claim_token,
                AlertDelivery.status == "processing",
                AlertDelivery.attempts >= self.MAX_ATTEMPTS,
            )
            .values(
                status="failed",
                last_error=safe_error,
                retry_after=None,
                locked_until=None,
                updated_at=now,
            )
            .returning(AlertDelivery)
        )
        attempt_limit_delivery = attempt_limit_result.scalar_one_or_none()
        if attempt_limit_delivery is not None:
            return attempt_limit_delivery

        result = await self.db.execute(
            update(AlertDelivery)
            .where(
                AlertDelivery.id == delivery_id,
                AlertDelivery.claim_token == claim_token,
                AlertDelivery.status == "processing",
                AlertDelivery.attempts < self.MAX_ATTEMPTS,
            )
            .values(
                status="failed",
                last_error=safe_error,
                retry_after=retry_after or now + timedelta(minutes=5),
                locked_until=None,
                updated_at=now,
            )
            .returning(AlertDelivery)
        )
        delivery = result.scalar_one_or_none()
        if delivery is not None:
            return delivery

        return (
            await self.db.execute(
                update(AlertDelivery)
                .where(
                    AlertDelivery.id == delivery_id,
                    AlertDelivery.claim_token == claim_token,
                    AlertDelivery.status == "processing",
                    AlertDelivery.attempts >= self.MAX_ATTEMPTS,
                )
                .values(
                    status="failed",
                    last_error=safe_error,
                    retry_after=None,
                    locked_until=None,
                    updated_at=now,
                )
                .returning(AlertDelivery)
            )
        ).scalar_one_or_none()

    async def deliver_in_app(
        self,
        delivery_id: UUID,
        claim_token: str,
        user_id: UUID,
        title: str,
        message: str,
        *,
        action_url: Optional[str] = None,
        meta: Optional[dict] = None,
    ) -> Optional[Notification]:
        result = await self.db.execute(
            select(AlertDelivery)
            .where(
                AlertDelivery.id == delivery_id,
                AlertDelivery.claim_token == claim_token,
                AlertDelivery.status == "processing",
            )
            .with_for_update()
        )
        delivery = result.scalar_one_or_none()
        if delivery is None:
            return None
        try:
            recipient_id = UUID(str(delivery.recipient_key))
        except ValueError:
            await self.finalize_delivery(
                delivery_id,
                claim_token,
                success=False,
                error="invalid_recipient",
                terminal=True,
            )
            return None
        if recipient_id != user_id:
            await self.finalize_delivery(
                delivery_id,
                claim_token,
                success=False,
                error="recipient_mismatch",
                terminal=True,
            )
            return None

        existing_result = await self.db.execute(
            select(Notification).where(Notification.delivery_id == delivery_id)
        )
        existing = existing_result.scalar_one_or_none()
        if existing is not None:
            result = await self.db.execute(
                update(AlertDelivery)
                .where(
                    AlertDelivery.id == delivery_id,
                    AlertDelivery.claim_token == claim_token,
                    AlertDelivery.status == "processing",
                )
                .values(
                    status="delivered",
                    delivered_at=datetime.now(timezone.utc),
                    retry_after=None,
                    locked_until=None,
                    last_error=None,
                    updated_at=datetime.now(timezone.utc),
                )
                .returning(AlertDelivery)
            )
            if result.scalar_one_or_none() is None:
                return None
            await self.db.flush()
            return existing

        notification = await NotificationService(self.db).create_notification(
            user_id=user_id,
            type="secret_expiration",
            title=title,
            message=message,
            action_url=action_url,
            meta=meta,
            delivery_id=delivery_id,
        )
        result = await self.db.execute(
            update(AlertDelivery)
            .where(
                AlertDelivery.id == delivery_id,
                AlertDelivery.claim_token == claim_token,
                AlertDelivery.status == "processing",
            )
            .values(
                status="delivered",
                delivered_at=datetime.now(timezone.utc),
                retry_after=None,
                locked_until=None,
                last_error=None,
                updated_at=datetime.now(timezone.utc),
            )
            .returning(AlertDelivery)
        )
        if result.scalar_one_or_none() is None:
            return None
        return notification

    @staticmethod
    def _validate_recipient_key(channel: str, project_id: UUID, recipient_key: str) -> None:
        if not recipient_key or any(character in recipient_key for character in "/\\@?&"):
            raise ValueError("recipient_key must be a stable identifier")
        if channel in {"in_app", "email"}:
            try:
                UUID(str(recipient_key))
            except ValueError as exc:
                raise ValueError("recipient_key must be a user UUID") from exc
        elif channel == "webhook" and recipient_key != f"project:{project_id}:webhook":
            raise ValueError("recipient_key must be the stable project webhook key")
