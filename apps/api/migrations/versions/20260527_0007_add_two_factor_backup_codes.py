"""add two_factor_backup_codes

Revision ID: 20260527_0007
Revises: 20260527_0006
Create Date: 2026-05-27 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260527_0007"
down_revision: Union[str, None] = "20260527_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS two_factor_backup_codes JSONB DEFAULT '[]'::jsonb
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
        DROP COLUMN IF EXISTS two_factor_backup_codes
        """
    )
