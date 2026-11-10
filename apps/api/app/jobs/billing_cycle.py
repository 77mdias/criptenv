"""Billing Cycle Background Job

What billing owes to the clock: paid periods that ended, the 7 days of grace after
a refused charge, abandoned checkouts, and payments whose webhook never arrived.
"""

import logging

from app.services.billing_service import BillingService

logger = logging.getLogger(__name__)


def create_session_scoped_scheduler_job(session_factory):
    """Create a scheduler job that opens a fresh DB session per execution."""
    async def run_billing_cycle():
        async with session_factory() as db:
            try:
                # run_cycle commits each subscription on its own.
                changed = await BillingService(db).run_cycle()
            except Exception as e:
                await db.rollback()
                logger.error(f"Billing cycle job failed: {e}")
                return
            if changed:
                logger.info(f"Billing cycle finished: {changed} subscription(s) changed")
    return run_billing_cycle
