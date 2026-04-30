from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
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
        resource_type: Optional[str] = None
    ) -> tuple[list[AuditLog], int]:
        filters = build_audit_filter_strategies(action, resource_type)
        query = select(AuditLog).where(AuditLog.project_id == project_id)
        query = apply_audit_filters(query, filters)

        count_query = select(func.count(AuditLog.id)).where(AuditLog.project_id == project_id)
        count_query = apply_audit_filters(count_query, filters)

        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        offset = (page - 1) * per_page
        query = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(per_page)

        result = await self.db.execute(query)
        logs = list(result.scalars().all())

        return logs, total
