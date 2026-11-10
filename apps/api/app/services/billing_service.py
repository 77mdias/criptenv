"""Subscriptions (Pro/Max) billed through Mercado Pago.

The only writer of `users.plan`. A plan is released by an `approved` payment read
from Mercado Pago with our token, never by the browser's return or a webhook body.
"""
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.subscription import Subscription


def billing_enabled() -> bool:
    """Off unless the operator turned it on and Mercado Pago is configured (self-hosted installs never bill)."""
    return bool(
        settings.BILLING_ENABLED and settings.MERCADO_PAGO_ACCESS_TOKEN and settings.MERCADO_PAGO_WEBHOOK_SECRET
    )


async def grace_until_for(db: AsyncSession, user_id: UUID) -> datetime | None:
    """Until when the user's plan holds while a payment is overdue; None when nothing is overdue."""
    return await db.scalar(
        select(Subscription.grace_until).where(Subscription.user_id == user_id, Subscription.status == "past_due")
    )
