"""add restricted to environments

A restricted environment is reached only by the project's owner and admins.
Existing environments stay open.

Revision ID: 20261110_0021
Revises: 20261110_0020
Create Date: 2026-11-10

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20261110_0021"
down_revision: Union[str, None] = "20261110_0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "environments", sa.Column("restricted", sa.Boolean(), nullable=False, server_default=sa.text("false"))
    )


def downgrade() -> None:
    op.drop_column("environments", "restricted")
