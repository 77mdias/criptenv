"""Session Cleanup Background Job

Periodic job that deletes expired or inactive user sessions.
A session is considered inactive if it hasn't been accessed for
more than SESSION_INACTIVITY_DAYS (default: 7 days).
"""

import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)


class SessionCleanupJob:
    """Background job that cleans up stale user sessions.

    Usage:
        job = SessionCleanupJob(db_session)
        deleted_count = await job.run()
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.auth_service = AuthService(db)

    async def run(self) -> int:
        """Execute cleanup and return number of deleted sessions."""
        try:
            deleted = await self.auth_service.cleanup_inactive_sessions()
            if deleted > 0:
                logger.info(f"Session cleanup complete: {deleted} stale session(s) removed")
            else:
                logger.debug("Session cleanup: no stale sessions found")
            return deleted
        except Exception as e:
            logger.error(f"Session cleanup job failed: {e}")
            return 0


def create_scheduler_job(db: AsyncSession):
    """Create APScheduler job function for session cleanup."""
    async def run_cleanup():
        job = SessionCleanupJob(db)
        await job.run()
    return run_cleanup


def create_session_scoped_scheduler_job(session_factory):
    """Create a scheduler job that opens a fresh DB session per execution."""
    async def run_cleanup():
        async with session_factory() as db:
            job = SessionCleanupJob(db)
            deleted = await job.run()
            logger.info(f"Session cleanup job finished: {deleted} session(s) deleted")
    return run_cleanup
