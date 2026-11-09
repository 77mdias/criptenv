from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.user import User
from app.strategies.audit_filters import apply_audit_filters, build_audit_filter_strategies


class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(
        self,
        action: str,
        resource_type: str,
        resource_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None,
        metadata: Optional[dict] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuditLog:
        audit_log = AuditLog(
            id=uuid4(),
            user_id=user_id,
            project_id=project_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            meta=metadata or {},
            ip_address=ip_address,
            user_agent=user_agent
        )
        self.db.add(audit_log)
        await self.db.flush()

        return audit_log

    async def get_project_logs(
        self,
        project_id: UUID,
        page: int = 1,
        per_page: int = 50,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        since: Optional[datetime] = None,
    ) -> tuple[list[AuditLog], int]:
        """`since` is the plan's history window (PlanLimits.audit_since): older rows are hidden, not deleted."""
        filters = build_audit_filter_strategies(action, resource_type)
        in_window = [AuditLog.project_id == project_id]
        if since is not None:
            in_window.append(AuditLog.created_at >= since)
        query = select(AuditLog).where(*in_window)
        query = apply_audit_filters(query, filters)

        count_query = select(func.count(AuditLog.id)).where(*in_window)
        count_query = apply_audit_filters(count_query, filters)

        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        offset = (page - 1) * per_page
        query = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(per_page)

        result = await self.db.execute(query)
        logs = list(result.scalars().all())

        return logs, total

    async def get_actors(self, user_ids: set[UUID]) -> dict[UUID, User]:
        """Resolve the users behind a page of logs in a single query."""
        if not user_ids:
            return {}
        result = await self.db.execute(select(User).where(User.id.in_(user_ids)))
        return {user.id: user for user in result.scalars().all()}
