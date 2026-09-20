"""create alert delivery persistence

Revision ID: 20260918_0010
Revises: 20260528_0009
Create Date: 2026-09-18 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op


revision: str = "20260918_0010"
down_revision: Union[str, None] = "20260528_0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS alert_deliveries (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            expiration_id UUID NOT NULL REFERENCES secret_expirations(id) ON DELETE CASCADE,
            event VARCHAR(50) NOT NULL,
            channel VARCHAR(20) NOT NULL,
            recipient_key VARCHAR(255) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            attempts INTEGER NOT NULL DEFAULT 0,
            retry_after TIMESTAMPTZ,
            locked_until TIMESTAMPTZ,
            claim_token VARCHAR(128),
            delivered_at TIMESTAMPTZ,
            last_error VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_alert_deliveries_identity UNIQUE (expiration_id, event, channel, recipient_key),
            CONSTRAINT ck_alert_deliveries_status CHECK (status IN ('pending', 'processing', 'delivered', 'failed')),
            CONSTRAINT ck_alert_deliveries_attempts_nonnegative CHECK (attempts >= 0)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_alert_deliveries_project_id ON alert_deliveries(project_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_alert_deliveries_claimable ON alert_deliveries(status, retry_after, locked_until)")
    op.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS delivery_id UUID REFERENCES alert_deliveries(id) ON DELETE SET NULL")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_delivery_id ON notifications(delivery_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_notifications_delivery_id")
    op.execute("ALTER TABLE notifications DROP COLUMN IF EXISTS delivery_id")
    op.execute("DROP TABLE IF EXISTS alert_deliveries")
