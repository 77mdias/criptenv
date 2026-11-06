"""add client (web | cli) to sessions

CLI logins create Session rows too, so a CLI token sent as a cookie used to
look like a dashboard session. Web-only features (personal vault) now require
client = 'web'. Existing rows stay NULL: their owners sign in again once to
use those features.

Revision ID: 20261106_0015
Revises: 20261106_0014
Create Date: 2026-11-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20261106_0015"
down_revision: Union[str, None] = "20261106_0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sessions", sa.Column("client", sa.String(16), nullable=True))


def downgrade() -> None:
    op.drop_column("sessions", "client")
