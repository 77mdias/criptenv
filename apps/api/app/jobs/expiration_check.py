"""Background expiration alert scheduler."""

import logging
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings as app_settings
from app.models.alert_delivery import AlertDelivery
from app.models.environment import Environment
from app.models.project import Project
from app.services.alert_delivery_service import AlertDeliveryService
from app.services.alert_payload import build_alert_payload
from app.services.alert_settings_service import AlertSettingsService
from app.services.rotation_service import RotationService
from app.services.webhook_service import DeliveryResult, WebhookService, sanitize_delivery_error


logger = logging.getLogger(__name__)


class ExpirationChecker:
    """Materialize, claim, and dispatch project-configured expiration alerts."""

    def __init__(
        self,
        db: AsyncSession,
        webhook_service: Optional[WebhookService] = None,
        delivery_service: Optional[AlertDeliveryService] = None,
    ):
        self.db = db
        self.rotation_service = RotationService(db)
        self.webhook_service = webhook_service
        self.delivery_service = delivery_service or AlertDeliveryService(
            db, webhook_service=webhook_service
        )

    async def check_expirations(self) -> List[DeliveryResult]:
        results: list[DeliveryResult] = []
        try:
            for expiration in await self.rotation_service.list_pending_rotations():
                try:
                    result = await self._process_expiration(expiration)
                except Exception as exc:
                    await self.db.rollback()
                    logger.error("Expiration unit failed: %s", sanitize_delivery_error(exc))
                    result = DeliveryResult(False, 0, sanitize_delivery_error(exc))
                else:
                    try:
                        await self.db.commit()
                    except Exception as exc:
                        await self.db.rollback()
                        logger.error("Expiration unit commit failed: %s", sanitize_delivery_error(exc))
                        result = DeliveryResult(False, 0, sanitize_delivery_error(exc))
                if result is not None:
                    results.append(result)
        except Exception as exc:
            await self.db.rollback()
            logger.error("Expiration check failed: %s", sanitize_delivery_error(exc))
        return results

    async def _get_project(self, project_id: UUID) -> Optional[Project]:
        result = await self.db.execute(select(Project).where(Project.id == project_id))
        return result.scalar_one_or_none()

    async def _get_environment_name(self, environment_id: UUID) -> Optional[str]:
        result = await self.db.execute(select(Environment).where(Environment.id == environment_id))
        environment = result.scalar_one_or_none()
        return environment.name if environment else None

    async def _process_expiration(self, expiration) -> Optional[DeliveryResult]:
        project = await self._get_project(expiration.project_id)
        if project is None:
            return None
        settings = AlertSettingsService().get(project)
        if not settings.enabled:
            return None

        webhook_url = None
        channels = {
            "in_app": settings.channels.in_app,
            "email": settings.channels.email,
            "webhook": False,
        }
        if settings.channels.webhook:
            webhook_url = AlertSettingsService().get_webhook_url(project)
            channels["webhook"] = bool(webhook_url)
        if not any(channels.values()):
            return None

        event = "secret.expired" if expiration.is_expired else "secret.expiring"
        payload = build_alert_payload(
            event=event,
            project_id=expiration.project_id,
            project_name=project.name,
            environment_id=expiration.environment_id,
            environment_name=await self._get_environment_name(expiration.environment_id),
            environment=str(expiration.environment_id),
            secret_key=expiration.secret_key,
            expires_at=expiration.expires_at,
            notify_days_before=expiration.notify_days_before,
            days_until_expiration=expiration.days_until_expiration,
            action_url=(
                f"{app_settings.FRONTEND_URL.rstrip('/')}/projects/"
                f"{expiration.project_id}/secrets/{expiration.secret_key}"
            ),
        )

        deliveries = []
        recipient_users = {}
        if channels["in_app"]:
            for user in await self.delivery_service.resolve_recipients(expiration.project_id):
                recipient_users[str(user.id)] = user
                deliveries.append(await self.delivery_service.create_delivery(
                    expiration.project_id, expiration.id, event, "in_app", str(user.id)
                ))
        if channels["email"]:
            for user in await self.delivery_service.resolve_recipients(
                expiration.project_id, email=True
            ):
                recipient_users[str(user.id)] = user
                deliveries.append(await self.delivery_service.create_delivery(
                    expiration.project_id, expiration.id, event, "email", str(user.id)
                ))
        if channels["webhook"]:
            deliveries.append(await self.delivery_service.create_delivery(
                expiration.project_id,
                expiration.id,
                event,
                "webhook",
                f"project:{expiration.project_id}:webhook",
            ))
        await self.db.flush()

        if not deliveries:
            return None
        if not all(getattr(delivery, "status", None) == "delivered" for delivery in deliveries):
            await self.delivery_service.deliver_channels(
                project_id=expiration.project_id,
                expiration_id=expiration.id,
                event=event,
                payload=payload,
                channels=channels,
                webhook_url=webhook_url,
                materialized_deliveries=deliveries,
                recipient_users=recipient_users,
            )

        if not await self._deliveries_complete([delivery.id for delivery in deliveries]):
            return DeliveryResult(False, 0, "delivery_error")

        await self.rotation_service.mark_notified(expiration.id, commit=False)
        return DeliveryResult(True, 1)

    async def _deliveries_complete(self, delivery_ids: list[UUID]) -> bool:
        result = await self.db.execute(
            select(AlertDelivery).where(AlertDelivery.id.in_(delivery_ids))
        )
        rows = list(result.scalars().all())
        if rows:
            return len(rows) == len(delivery_ids) and all(row.status == "delivered" for row in rows)
        return False

    async def _notify_expiration(self, expiration) -> DeliveryResult:
        """Compatibility entry point used by older callers and tests."""
        return await self._process_expiration(expiration) or DeliveryResult(False, 0, "disabled")

    async def _get_webhook_url(self, project_id: UUID) -> Optional[str]:
        project = await self._get_project(project_id)
        return AlertSettingsService().get_webhook_url(project) if project else None


def create_scheduler_job(checker: ExpirationChecker):
    async def run_check():
        try:
            results = await checker.check_expirations()
            logger.info(
                "Expiration check complete: %s/%s notifications sent",
                sum(result.success for result in results),
                len(results),
            )
        except Exception as exc:
            logger.error("Expiration check job failed: %s", sanitize_delivery_error(exc))

    return run_check


def create_session_scoped_scheduler_job(session_factory, checker_cls=ExpirationChecker):
    async def run_check():
        async with session_factory() as db:
            try:
                await checker_cls(db).check_expirations()
                await db.commit()
            except Exception as exc:
                await db.rollback()
                logger.error("Expiration check job failed: %s", sanitize_delivery_error(exc))

    return run_check


def create_hourly_scheduler(db: AsyncSession) -> tuple:
    checker = ExpirationChecker(db)
    return checker, create_scheduler_job(checker)
