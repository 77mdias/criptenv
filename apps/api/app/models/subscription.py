"""Subscriptions (billing): one row per Mercado Pago preapproval, plus the payments applied to it."""
import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Numeric, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base

# pending: created, waiting for the first payment. scheduled: paid, starts when the current one ends.
# active / past_due: in force ("live"). ended: terminal.
LIVE_STATUSES = ("active", "past_due")
_LIVE = text("status IN ('active', 'past_due')")


class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        # At most one subscription in force per user, whatever the code above does.
        Index("uq_subscriptions_live_user", "user_id", unique=True, postgresql_where=_LIVE, sqlite_where=_LIVE),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plan = Column(String(32), nullable=False)
    interval = Column(String(8), nullable=False)
    status = Column(String(16), nullable=False, default="pending")
    # The preapproval is already cancelled at Mercado Pago: the plan holds until current_period_end, then ends.
    cancel_at_period_end = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    amount = Column(Numeric(12, 2), nullable=False)
    provider_subscription_id = Column(String(64), unique=True)
    init_point = Column(Text)
    current_period_start = Column(DateTime(timezone=True))
    current_period_end = Column(DateTime(timezone=True))
    grace_until = Column(DateTime(timezone=True))
    first_payment_at = Column(DateTime(timezone=True))
    ended_at = Column(DateTime(timezone=True))
    # Invoice (NFS-e) data, issued by hand from the e-mail sent at each payment.
    tax_id = Column(String(14), nullable=False)
    legal_name = Column(String(200), nullable=False)
    address = Column(String(500), nullable=False)
    payer_email = Column(String(320), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SubscriptionPayment(Base):
    """An approved payment, applied exactly once: provider_payment_id is unique."""

    __tablename__ = "subscription_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscription_id = Column(
        UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider_payment_id = Column(String(64), nullable=False, unique=True)
    amount = Column(Numeric(12, 2), nullable=False)
    paid_at = Column(DateTime(timezone=True), nullable=False)
    refunded_amount = Column(Numeric(12, 2))
    refund_error = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
