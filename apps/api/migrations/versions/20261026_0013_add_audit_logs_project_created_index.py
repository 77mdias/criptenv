"""add (project_id, created_at) index to audit_logs

Serves the dashboard aggregates (GET /api/v1/me/overview, /me/activity-stats)
and the per-project audit feed, which filter by project and order/range by date.

Revision ID: 20261026_0013
Revises: 20261015_0012
Create Date: 2026-10-26

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20261026_0013"
down_revision: Union[str, None] = "20261015_0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_audit_logs_project_id_created_at",
        "audit_logs",
        ["project_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_audit_logs_project_id_created_at", table_name="audit_logs")
