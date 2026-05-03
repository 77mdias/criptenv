"""create ci sessions

Revision ID: 20260503_0001
Revises: None
Create Date: 2026-05-03 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260503_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ci_sessions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            token_hash VARCHAR(255) NOT NULL UNIQUE,
            ci_token_id UUID NOT NULL REFERENCES ci_tokens(id) ON DELETE CASCADE,
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            scopes JSON DEFAULT '["read:secrets"]',
            environment_scope VARCHAR(255),
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            last_used_at TIMESTAMPTZ
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_ci_sessions_token_hash "
        "ON ci_sessions(token_hash)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_ci_sessions_ci_token_id "
        "ON ci_sessions(ci_token_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_ci_sessions_project_id "
        "ON ci_sessions(project_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_ci_sessions_expires_at "
        "ON ci_sessions(expires_at)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ci_sessions")
