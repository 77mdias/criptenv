"""create contributions table

Revision ID: 20260508_0004
Revises: 20260506_0003
Create Date: 2026-05-08 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260508_0004"
down_revision: Union[str, None] = "20260506_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS contributions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            provider VARCHAR(50) NOT NULL DEFAULT 'mercadopago',
            provider_payment_id VARCHAR(100),
            amount NUMERIC(12, 2) NOT NULL,
            currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            pix_copy_paste VARCHAR(500),
            pix_qr_code_base64 TEXT,
            ticket_url VARCHAR(500),
            expires_at TIMESTAMPTZ,
            paid_at TIMESTAMPTZ,
            refunded_at TIMESTAMPTZ,
            cancelled_at TIMESTAMPTZ,
            payer_email VARCHAR(255),
            payer_name VARCHAR(255),
            raw_provider_response JSONB,
            extra_metadata JSONB,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(status)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_contributions_provider_payment_id ON contributions(provider_payment_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_contributions_created_at ON contributions(created_at)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS contributions")
