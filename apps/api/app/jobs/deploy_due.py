"""Due Deploys Background Job

Fires the provider deploys that pushes asked for (integrations.deploy_due_at).
Each push moves the due time, so a burst of saves ends in one deploy.
"""

import logging

from app.services.integration_service import IntegrationService

logger = logging.getLogger(__name__)


def create_session_scoped_scheduler_job(session_factory):
    """Create a scheduler job that opens a fresh DB session per execution."""
    async def run_due_deploys():
        async with session_factory() as db:
            try:
                # run_due_deploys commits the claim and then each deploy on its own.
                fired = await IntegrationService(db).run_due_deploys()
            except Exception as e:
                await db.rollback()
                logger.error(f"Due deploys job failed: {e}")
                return
            if fired:
                logger.info(f"Due deploys job finished: {fired} deploy(s) triggered")
    return run_due_deploys
