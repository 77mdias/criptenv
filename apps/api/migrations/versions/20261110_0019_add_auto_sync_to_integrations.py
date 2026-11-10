"""add auto sync to integrations

auto_sync_targets binds CriptEnv environments to provider targets ({} = auto-sync
off), redeploy asks for a deploy after a push, deploy_due_at is when the scheduler
fires it. Existing integrations start with everything off.

Revision ID: 20261110_0019
Revises: 20261107_0018
Create Date: 2026-11-10

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20261110_0019"
down_revision: Union[str, None] = "20261107_0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "integrations",
        sa.Column("auto_sync_targets", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'")),
    )
    op.add_column("integrations", sa.Column("redeploy", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("integrations", sa.Column("deploy_due_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("integrations", "deploy_due_at")
    op.drop_column("integrations", "redeploy")
    op.drop_column("integrations", "auto_sync_targets")
