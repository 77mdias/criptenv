"""create personal vault tables

Per-user zero-knowledge vault (cofre pessoal), web dashboard only.

Revision ID: 20261106_0014
Revises: 20261026_0013
Create Date: 2026-11-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20261106_0014"
down_revision: Union[str, None] = "20261026_0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "personal_vaults",
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("kdf", sa.String(32), nullable=False),
        sa.Column("iterations", sa.Integer(), nullable=False),
        sa.Column("master_salt", sa.String(64), nullable=False),
        sa.Column("extra_salt", sa.String(64), nullable=False),
        sa.Column("master_wrapped_vault_key", postgresql.JSONB(), nullable=False),
        sa.Column("recovery_wrapped_vault_key", postgresql.JSONB(), nullable=False),
        sa.Column("extra_wrapped_protected_key", postgresql.JSONB(), nullable=False),
        sa.Column("recovery_wrapped_protected_key", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "personal_vault_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("protected", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("summary", postgresql.JSONB(), nullable=False),
        sa.Column("body", postgresql.JSONB(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_personal_vault_items_user_id", "personal_vault_items", ["user_id"])
    op.create_index(
        "ix_personal_vault_items_user_id_updated_at",
        "personal_vault_items",
        ["user_id", "updated_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_personal_vault_items_user_id_updated_at", table_name="personal_vault_items")
    op.drop_index("ix_personal_vault_items_user_id", table_name="personal_vault_items")
    op.drop_table("personal_vault_items")
    op.drop_table("personal_vaults")
