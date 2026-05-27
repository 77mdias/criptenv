"""add session last_accessed_at

Revision ID: 20260527_0006
Revises: 20260523_0005
Create Date: 2026-05-27 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260527_0006"
down_revision: Union[str, None] = "20260523_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE sessions
        ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW()
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_sessions_last_accessed_at
        ON sessions(last_accessed_at)
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS idx_sessions_last_accessed_at
        """
    )
    op.execute(
        """
        ALTER TABLE sessions
        DROP COLUMN IF EXISTS last_accessed_at
        """
    )
