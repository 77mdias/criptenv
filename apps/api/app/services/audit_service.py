from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import and_, select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditActor, AuditLogResponse
from app.strategies.audit_filters import apply_audit_filters, build_audit_filter_strategies


def visible_audit_condition(scopes: list[tuple[UUID, Optional[datetime], set[UUID]]]):
    """Audit rows a user may see across projects. Each scope is (project_id, since, hidden_resource_ids):
    the owner's plan window and the restricted environments the user's role does not reach,
    the same rules get_project_logs applies to one project. Never call it with no scope."""
    per_project = []
    for project_id, since, hidden in scopes:
        conditions = [AuditLog.project_id == project_id]
        if since is not None:
            conditions.append(AuditLog.created_at >= since)
        if hidden:
            conditions.append(or_(AuditLog.resource_id.is_(None), AuditLog.resource_id.notin_(hidden)))
        per_project.append(and_(*conditions))
    return or_(*per_project)


def to_audit_response(log: AuditLog, actors: dict) -> AuditLogResponse:
    """One audit row as the API returns it, with the actor resolved from `actors` (get_actors)."""
    response = AuditLogResponse(
        id=log.id, user_id=log.user_id, project_id=log.project_id, action=log.action,
        resource_type=log.resource_type, resource_id=log.resource_id, meta=log.meta,
        ip_address=log.ip_address, user_agent=log.user_agent, created_at=log.created_at,
    )
    actor = actors.get(log.user_id)
    if actor is not None:
        response.actor = AuditActor(
            id=actor.id, name=actor.name, email=str(actor.email), avatar_url=actor.avatar_url
        )
    auth_type = (log.meta or {}).get("auth_type")
    if auth_type in ("api_key", "ci_session"):
        response.auth_type = auth_type
    return response


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
        hidden_resource_ids: Optional[set[UUID]] = None,
    ) -> tuple[list[AuditLog], int]:
        """`since` is the plan's history window (PlanLimits.audit_since): older rows are hidden, not deleted.
        `hidden_resource_ids`: restricted environments the caller does not reach; their events are left out
        in the query itself, so the page count stays right."""
        filters = build_audit_filter_strategies(action, resource_type)
        in_window = [AuditLog.project_id == project_id]
        if since is not None:
            in_window.append(AuditLog.created_at >= since)
        if hidden_resource_ids:
            in_window.append(or_(AuditLog.resource_id.is_(None), AuditLog.resource_id.notin_(hidden_resource_ids)))
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

    async def get_user_logs(
        self,
        scopes: list[tuple[UUID, Optional[datetime], set[UUID]]],
        page: int = 1,
        per_page: int = 50,
        **filters,
    ) -> tuple[list[AuditLog], int]:
        """Events across several projects. Each scope is (project_id, since, hidden_resource_ids),
        the same rules get_project_logs applies to one project; `filters` go to
        build_audit_filter_strategies."""
        if not scopes:
            return [], 0
        strategies = build_audit_filter_strategies(filters.pop("action", None), None, **filters)

        visible = visible_audit_condition(scopes)
        total = (await self.db.execute(
            apply_audit_filters(select(func.count(AuditLog.id)).where(visible), strategies)
        )).scalar() or 0
        query = apply_audit_filters(select(AuditLog).where(visible), strategies)
        query = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
        return list((await self.db.execute(query)).scalars().all()), total

    async def get_actors(self, user_ids: set[UUID]) -> dict[UUID, User]:
        """Resolve the users behind a page of logs in a single query."""
        if not user_ids:
            return {}
        result = await self.db.execute(select(User).where(User.id.in_(user_ids)))
        return {user.id: user for user in result.scalars().all()}
