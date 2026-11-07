"""add plan to users

NULL means "the server's DEFAULT_PLAN" (app/plans.py), so existing users
follow whatever the install sets; paid plans will store their id here.

Revision ID: 20261107_0017
Revises: 20261106_0016
Create Date: 2026-11-07

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20261107_0017"
down_revision: Union[str, None] = "20261106_0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("plan", sa.String(32), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "plan")
