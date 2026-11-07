"""add kind (config | secret) to vault_blobs

Providers such as Vercel store a variable either as readable config or as a
write-only secret. The kind is not secret itself, so it is stored in clear
text like key_id. Existing rows stay NULL ("never chosen"): they sync exactly
as before, so a variable already marked Secret in Vercel is never turned
back into a readable Config just because this column appeared.

Revision ID: 20261106_0016
Revises: 20261106_0015
Create Date: 2026-11-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20261106_0016"
down_revision: Union[str, None] = "20261106_0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "vault_blobs",
        sa.Column("kind", sa.String(16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("vault_blobs", "kind")
