"""Scheduler Manager for APScheduler integration M3.6.

Manages background job scheduling for secret expiration checks.
Integrates with FastAPI lifespan for graceful startup/shutdown.

GRASP Patterns:
- Pure Fabrication: Encapsulates scheduler lifecycle
- Protected Variations: Abstracts scheduler backend
- Low Coupling: Decoupled from specific job implementations
- Indirection: Mediates between lifespan and job execution
"""

import logging
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)


class SchedulerManager:
    """Manages APScheduler lifecycle for background jobs.
    
    Usage:
        manager = SchedulerManager()
        manager.add_expiration_job(checker, interval_hours=1)
        manager.start()
        # ... later ...
        manager.stop()
    
    Attributes:
        scheduler: The AsyncIOScheduler instance
        is_running: Whether the scheduler has been started
    """
    
    def __init__(self):
        """Initialize scheduler manager."""
        self.scheduler = AsyncIOScheduler()
        self._started = False
    
    def add_expiration_job(self, checker, interval_hours: int = 1):
        """Add expiration check job to scheduler.
        
        Args:
            checker: ExpirationChecker instance
            interval_hours: How often to run the check (default: 1 hour)
        """
        from app.jobs.expiration_check import create_scheduler_job
        
        job_func = create_scheduler_job(checker)
        self.add_expiration_job_func(job_func, interval_hours=interval_hours)

    def add_expiration_job_func(self, job_func, interval_hours: int = 1):
        """Add an already constructed expiration check job to scheduler."""
        self.scheduler.add_job(
            job_func,
            trigger=IntervalTrigger(hours=interval_hours),
            id="expiration_check",
            name="Secret Expiration Check",
            replace_existing=True,
            misfire_grace_time=300,  # 5 minutes grace for missed runs
        )
        logger.info(f"Added expiration check job (interval: {interval_hours}h)")
    
    def start(self):
        """Start the scheduler.
        
        Should be called during FastAPI startup (lifespan startup).
        """
        if not self._started:
            self.scheduler.start()
            self._started = True
            logger.info("Scheduler started")
    
    def stop(self):
        """Stop the scheduler gracefully.
        
        Should be called during FastAPI shutdown (lifespan shutdown).
        Waits for running jobs to complete before stopping.
        """
        if self._started:
            self.scheduler.shutdown(wait=True)
            self._started = False
            logger.info("Scheduler stopped")
    
    @property
    def is_running(self) -> bool:
        """Check if scheduler is currently running."""
        return self._started
    
    def get_jobs(self):
        """Get list of scheduled jobs."""
        return self.scheduler.get_jobs()
    
    def remove_job(self, job_id: str):
        """Remove a specific job from the scheduler.
        
        Args:
            job_id: The job identifier
        """
        self.scheduler.remove_job(job_id)
        logger.info(f"Removed job: {job_id}")


# Singleton instance for FastAPI lifespan
_scheduler_instance: Optional[SchedulerManager] = None


def get_scheduler() -> SchedulerManager:
    """Get or create the global scheduler instance.
    
    Returns:
        The global SchedulerManager instance
    """
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = SchedulerManager()
    return _scheduler_instance


def init_scheduler(checker, interval_hours: int = 1) -> SchedulerManager:
    """Initialize the global scheduler with an expiration checker.
    
    Args:
        checker: ExpirationChecker instance
        interval_hours: Interval between job runs
    
    Returns:
        The initialized SchedulerManager
    """
    manager = get_scheduler()
    manager.add_expiration_job(checker, interval_hours=interval_hours)
    return manager


def init_scheduler_job(job_func, interval_hours: int = 1) -> SchedulerManager:
    """Initialize the global scheduler with a prebuilt expiration job."""
    manager = get_scheduler()
    manager.add_expiration_job_func(job_func, interval_hours=interval_hours)
    return manager


def shutdown_scheduler():
    """Shutdown the global scheduler.
    
    Call this during FastAPI shutdown.
    """
    global _scheduler_instance
    if _scheduler_instance is not None:
        _scheduler_instance.stop()
        _scheduler_instance = None
