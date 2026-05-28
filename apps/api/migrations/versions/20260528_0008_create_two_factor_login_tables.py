"""create two_factor login tables

Revision ID: 20260528_0008
Revises: 20260527_0007
Create Date: 2026-05-28 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260528_0008"
down_revision: Union[str, None] = "20260527_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS two_factor_challenges (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash VARCHAR(64) NOT NULL UNIQUE,
            expires_at TIMESTAMPTZ NOT NULL,
            consumed_at TIMESTAMPTZ,
            ip_address VARCHAR(45),
            user_agent VARCHAR(512),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_two_factor_challenges_user_id
        ON two_factor_challenges(user_id)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_two_factor_challenges_user_id_created_at
        ON two_factor_challenges(user_id, created_at)
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS two_factor_trusted_devices (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash VARCHAR(64) NOT NULL UNIQUE,
            expires_at TIMESTAMPTZ NOT NULL,
            revoked_at TIMESTAMPTZ,
            last_used_at TIMESTAMPTZ,
            ip_address VARCHAR(45),
            user_agent VARCHAR(512),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_two_factor_trusted_devices_user_id
        ON two_factor_trusted_devices(user_id)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_two_factor_trusted_devices_user_id_created_at
        ON two_factor_trusted_devices(user_id, created_at)
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS two_factor_trusted_devices")
    op.execute("DROP TABLE IF EXISTS two_factor_challenges")
