"""encrypt integration configs

Revision ID: 20260506_0003
Revises: 20260503_0002
Create Date: 2026-05-06 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

from app.config import settings
from app.crypto.integration_config import IntegrationConfigEncryption

revision: str = "20260506_0003"
down_revision: Union[str, None] = "20260503_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    table_exists = connection.scalar(
        sa.text("SELECT to_regclass('public.integrations') IS NOT NULL")
    )
    if not table_exists:
        return

    rows = connection.execute(
        sa.text("SELECT id, config FROM integrations")
    ).mappings()

    legacy_rows = [
        row for row in rows
        if not IntegrationConfigEncryption.is_encrypted(row["config"])
    ]
    if not legacy_rows:
        return

    update = sa.text(
        "UPDATE integrations SET config = :config, updated_at = now() WHERE id = :id"
    ).bindparams(sa.bindparam("config", type_=JSONB))

    for row in legacy_rows:
        encrypted_config = IntegrationConfigEncryption.encrypt(
            dict(row["config"]),
            settings.INTEGRATION_CONFIG_SECRET,
        )
        connection.execute(update, {"id": row["id"], "config": encrypted_config})


def downgrade() -> None:
    # Intentionally keep encrypted configs encrypted. Downgrading to plaintext would
    # reintroduce the at-rest exposure this migration fixes.
    return
