"""Expiration Check Background Job for M3.5 Secret Alerts

Periodic job that checks for secrets approaching expiration
and triggers notifications via configured channels.

GRASP Patterns:
- Information Expert: Knows when to check and what to notify
- Pure Fabrication: Orchestrates check → notify workflow
- Protected Variations: Notification channel is injected
- Indirection: Mediates between RotationService and WebhookService
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.rotation_service import RotationService
from app.services.webhook_service import WebhookService, DeliveryResult


logger = logging.getLogger(__name__)


class ExpirationChecker:
    """Background job that checks for expiring secrets and sends alerts.
    
    GRASP Information Expert: Contains expiration check logic
    GRASP Pure Fabrication: Orchestrates the check → notify workflow
    GRASP Indirection: Mediates between RotationService and WebhookService
    GRASP Low Coupling: Decoupled from HTTP implementations
    
    Usage:
        checker = ExpirationChecker(db_session)
        results = await checker.check_expirations()
    """
    
    def __init__(
        self,
        db: AsyncSession,
        webhook_service: Optional[WebhookService] = None
    ):
        """Initialize expiration checker.
        
        Args:
            db: Async database session
            webhook_service: Optional webhook service (creates default if None)
        """
        self.db = db
        self.rotation_service = RotationService(db)
        self.webhook_service = webhook_service or WebhookService()
    
    async def check_expirations(self) -> List[DeliveryResult]:
        """Check for secrets approaching expiration and send notifications.
        
        Returns:
            List of DeliveryResult for each notification attempt
        """
        results = []
        
        try:
            # Get secrets pending rotation notification
            pending = await self.rotation_service.list_pending_rotations()
            
            logger.info(f"Found {len(pending)} secrets pending notification")
            
            for expiration in pending:
                try:
                    result = await self._notify_expiration(expiration)
                    results.append(result)
                    
                    # Mark as notified (idempotent — 24h window handled by query)
                    if result.success:
                        await self.rotation_service.mark_notified(expiration.id)
                        logger.debug(
                            f"Marked {expiration.secret_key} as notified"
                        )
                        
                except Exception as e:
                    logger.error(
                        f"Failed to notify for secret {expiration.secret_key}: {e}"
                    )
                    results.append(DeliveryResult(
                        success=False,
                        attempts=0,
                        error=str(e)
                    ))
            
        except Exception as e:
            logger.error(f"Expiration check failed: {e}")
        
        return results
    
    async def _notify_expiration(self, expiration) -> DeliveryResult:
        """Send notification for a single expiring secret.
        
        GRASP Protected Variations: Never includes secret values in payload.
        
        Args:
            expiration: The SecretExpiration record
            
        Returns:
            DeliveryResult from webhook delivery
        """
        # Build payload — NEVER includes secret value
        payload = self.webhook_service.build_payload(
            event="secret.expiring" if not expiration.is_expired else "secret.expired",
            project_id=str(expiration.project_id),
            environment=str(expiration.environment_id),
            secret_key=expiration.secret_key,
            expires_at=expiration.expires_at,
            notify_days_before=expiration.notify_days_before,
            days_until_expiration=expiration.days_until_expiration
        )
        
        # Get webhook URL from project configuration
        # TODO: Query Project.webhook_url or ProjectSettings
        webhook_url = await self._get_webhook_url(expiration.project_id)
        
        if not webhook_url:
            logger.warning(
                f"No webhook URL configured for project {expiration.project_id}"
            )
            return DeliveryResult(
                success=False,
                attempts=0,
                error="No webhook URL configured"
            )
        
        return await self.webhook_service.send(
            webhook_url=webhook_url,
            event=payload["event"],
            payload=payload
        )
    
    async def _get_webhook_url(self, project_id: UUID) -> Optional[str]:
        """Get webhook URL from project configuration.
        
        GRASP Protected Variations: This is a placeholder that will be
        implemented when project settings support webhook URLs.
        
        TODO: Implement when project settings support webhook URLs.
        
        Args:
            project_id: Project UUID
            
        Returns:
            Webhook URL string or None if not configured
        """
        # Future: query Project.webhook_url or ProjectSettings
        # Example implementation:
        # from app.models.project import Project
        # result = await self.db.execute(
        #     select(Project.webhook_url).where(Project.id == project_id)
        # )
        # return result.scalar_one_or_none()
        return None


def create_scheduler_job(checker: ExpirationChecker):
    """Create APScheduler job function.
    
    GRASP Pure Fabrication: Factory function for scheduler integration.
    
    Usage in FastAPI lifespan:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        
        scheduler = AsyncIOScheduler()
        job = create_scheduler_job(ExpirationChecker(db_session))
        scheduler.add_job(job, 'interval', hours=1)
        scheduler.start()
        
        # In shutdown:
        scheduler.shutdown()
    
    Args:
        checker: ExpirationChecker instance
        
    Returns:
        Async callable for APScheduler
    """
    async def run_check():
        """Run expiration check and log results."""
        logger.info("Running expiration check...")
        
        try:
            results = await checker.check_expirations()
            success_count = sum(1 for r in results if r.success)
            total_count = len(results)
            
            logger.info(
                f"Expiration check complete: {success_count}/{total_count} notifications sent"
            )
            
            # Log failures
            for i, result in enumerate(results):
                if not result.success:
                    logger.warning(
                        f"Notification {i+1} failed: {result.error}"
                    )
                    
        except Exception as e:
            logger.error(f"Expiration check job failed: {e}")
    
    return run_check


def create_hourly_scheduler(db: AsyncSession) -> tuple:
    """Create expiration checker and scheduler job for hourly execution.
    
    Convenience function for common setup pattern.
    
    Returns:
        Tuple of (ExpirationChecker, scheduler_job)
    """
    checker = ExpirationChecker(db)
    job = create_scheduler_job(checker)
    return checker, job