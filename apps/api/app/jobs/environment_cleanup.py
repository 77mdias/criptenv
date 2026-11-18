"""Ephemeral environment cleanup.

Deletes child environments past their `expires_at` (with their overrides, and any child below them).
Routes already treat an expired environment as not found; this job frees the rows and the names.
Every deletion is audited as `environment.expired`, with names only.
"""
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.audit_service import AuditService
from app.services.environment_inheritance import purge_expired

logger = logging.getLogger(__name__)


async def run_environment_cleanup(db: AsyncSession) -> int:
    deleted = await purge_expired(db)
    audit = AuditService(db)
    for env in deleted:
        await audit.log(
            action="environment.expired",
            resource_type="environment",
            resource_id=env.id,
            project_id=env.project_id,
            metadata={
                "environment_name": env.name,
                "parent_id": str(env.parent_id) if env.parent_id else None,
                "reason": "ttl",
            },
        )
    await db.commit()
    return len(deleted)


def create_session_scoped_scheduler_job(session_factory):
    """APScheduler job that opens a fresh DB session per run."""
    async def run_cleanup():
        try:
            async with session_factory() as db:
                deleted = await run_environment_cleanup(db)
            if deleted:
                logger.info("Environment cleanup: %d expired environment(s) deleted", deleted)
        except Exception:
            logger.exception("Environment cleanup job failed")
    return run_cleanup
