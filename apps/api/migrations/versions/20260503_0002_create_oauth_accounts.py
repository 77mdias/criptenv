"""create oauth accounts

Revision ID: 20260503_0002
Revises: 20260503_0001
Create Date: 2026-05-03 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260503_0002"
down_revision: Union[str, None] = "20260503_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS oauth_accounts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            provider VARCHAR(50) NOT NULL,
            provider_user_id VARCHAR(255) NOT NULL,
            provider_email VARCHAR(255),
            access_token BYTEA,
            refresh_token BYTEA,
            expires_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            UNIQUE(provider, provider_user_id),
            UNIQUE(provider, provider_email)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id "
        "ON oauth_accounts(user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider "
        "ON oauth_accounts(provider)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS oauth_accounts")
