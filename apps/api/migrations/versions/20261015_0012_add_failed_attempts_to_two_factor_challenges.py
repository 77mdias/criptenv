"""add failed_attempts to two_factor_challenges

Revision ID: 20261015_0012
Revises: 20260923_0011
Create Date: 2026-10-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20261015_0012"
down_revision: Union[str, None] = "20260923_0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "two_factor_challenges",
        sa.Column(
            "failed_attempts",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("two_factor_challenges", "failed_attempts")
