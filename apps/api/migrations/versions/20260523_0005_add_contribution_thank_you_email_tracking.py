"""add contribution thank-you email tracking

Revision ID: 20260523_0005
Revises: 20260508_0004
Create Date: 2026-05-23 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260523_0005"
down_revision: Union[str, None] = "20260508_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE contributions
        ADD COLUMN IF NOT EXISTS thank_you_email_sent_at TIMESTAMPTZ
        """
    )
    op.execute(
        """
        ALTER TABLE contributions
        ADD COLUMN IF NOT EXISTS thank_you_email_error TEXT
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE contributions
        DROP COLUMN IF EXISTS thank_you_email_error
        """
    )
    op.execute(
        """
        ALTER TABLE contributions
        DROP COLUMN IF EXISTS thank_you_email_sent_at
        """
    )
