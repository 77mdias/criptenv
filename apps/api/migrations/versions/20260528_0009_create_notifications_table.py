"""create notifications table

Revision ID: 20260528_0009
Revises: 20260528_0008
Create Date: 2026-05-28 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260528_0009"
down_revision: Union[str, None] = "20260528_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL DEFAULT 'system',
            title VARCHAR(255) NOT NULL,
            message VARCHAR(1000) NOT NULL,
            read_at TIMESTAMPTZ,
            action_url VARCHAR(512),
            meta JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id
        ON notifications(user_id)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read_at
        ON notifications(user_id, read_at)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at
        ON notifications(user_id, created_at)
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS notifications")
