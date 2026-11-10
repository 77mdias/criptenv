"""create subscriptions

Billing (Mercado Pago): one row per subscription, the payments applied to it, and
when a user's one automatic 7-day refund was used. Nobody has a subscription yet:
users.plan keeps whatever it holds.

Revision ID: 20261110_0020
Revises: 20261110_0019
Create Date: 2026-11-10

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20261110_0020"
down_revision: Union[str, None] = "20261110_0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("refund_used_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan", sa.String(32), nullable=False),
        sa.Column("interval", sa.String(8), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("provider_subscription_id", sa.String(64), nullable=True, unique=True),
        sa.Column("init_point", sa.Text(), nullable=True),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("grace_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("first_payment_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tax_id", sa.String(14), nullable=False),
        sa.Column("legal_name", sa.String(200), nullable=False),
        sa.Column("address", sa.String(500), nullable=False),
        sa.Column("payer_email", sa.String(320), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])
    op.create_index(
        "uq_subscriptions_live_user", "subscriptions", ["user_id"], unique=True,
        postgresql_where=sa.text("status IN ('active', 'past_due')"),
    )

    op.create_table(
        "subscription_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "subscription_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("provider_payment_id", sa.String(64), nullable=False, unique=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("refunded_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("refund_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_subscription_payments_subscription_id", "subscription_payments", ["subscription_id"])


def downgrade() -> None:
    op.drop_table("subscription_payments")
    op.drop_table("subscriptions")
    op.drop_column("users", "refund_used_at")
