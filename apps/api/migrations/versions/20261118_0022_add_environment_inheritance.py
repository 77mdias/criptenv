"""add environment inheritance

A child environment points at a parent and stores only its overrides; reads resolve the chain
(child > parent > grandparent). `unset_keys` hides inherited keys in the child without touching the
parent. `expires_at` makes a child ephemeral: the cleanup job deletes it once it passes.

Downgrade drops the three columns: every child becomes a standalone environment holding only its
overrides. No secret is deleted.

Revision ID: 20261118_0022
Revises: 20261110_0021
Create Date: 2026-11-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20261118_0022"
down_revision: Union[str, None] = "20261110_0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "environments",
        sa.Column(
            "parent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("environments.id", name="fk_environments_parent_id", ondelete="RESTRICT"),
            nullable=True,
        ),
    )
    op.add_column("environments", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "environments",
        sa.Column("unset_keys", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.create_index("ix_environments_parent_id", "environments", ["parent_id"])
    op.create_index(
        "ix_environments_expires_at",
        "environments",
        ["expires_at"],
        postgresql_where=sa.text("expires_at IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_environments_expires_at", table_name="environments")
    op.drop_index("ix_environments_parent_id", table_name="environments")
    op.drop_column("environments", "unset_keys")
    op.drop_column("environments", "expires_at")
    op.drop_constraint("fk_environments_parent_id", "environments", type_="foreignkey")
    op.drop_column("environments", "parent_id")
