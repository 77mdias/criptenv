"""add terms acceptance evidence to users

Revision ID: 20260923_0011
Revises: 20260918_0010
Create Date: 2026-09-23 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260923_0011"
down_revision: Union[str, None] = "20260918_0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Audit trail of Terms of Use / Privacy Policy acceptance:
    # terms_accepted_at (when) + terms_version (which instrument version).
    op.execute(
        """
        ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ
        """
    )
    op.execute(
        """
        ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version VARCHAR(50)
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS terms_version")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS terms_accepted_at")
