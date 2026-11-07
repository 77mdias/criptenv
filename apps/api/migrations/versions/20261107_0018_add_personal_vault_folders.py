"""add personal_vault_folders

One row per folder a user creates in the personal vault. Only the name
envelope is stored; which items are in a folder lives inside each item's
encrypted summary, so the server never learns it.

Revision ID: 20261107_0018
Revises: 20261107_0017
Create Date: 2026-11-07

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20261107_0018"
down_revision: Union[str, None] = "20261107_0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "personal_vault_folders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", postgresql.JSONB(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_personal_vault_folders_user_id", "personal_vault_folders", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_personal_vault_folders_user_id", table_name="personal_vault_folders")
    op.drop_table("personal_vault_folders")
