"""Plan limits: count what a user or a project already has and compare it with the plan.

Everything that is per project (environments, members, integrations, audit
history) follows the plan of the project's OWNER, not of whoever is acting.
Only creating is ever blocked: reading, editing and deleting never check a plan.
"""
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.environment import Environment
from app.models.integration import Integration
from app.models.member import ProjectInvite, ProjectMember
from app.models.project import Project
from app.models.user import User
from app.plans import (
    AUDIT_RETENTION_DAYS,
    ENVIRONMENTS_PER_PROJECT,
    INTEGRATIONS_PER_PROJECT,
    MEMBERS_PER_PROJECT,
    PROJECTS,
    Plan,
    plan_for,
)
from app.strategies.exceptions import PlanLimitReached


class PlanLimits:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def owner_plan(self, project_id: UUID) -> Plan:
        """The plan of the project's owner."""
        owner_plan = await self.db.scalar(
            select(User.plan).join(Project, Project.owner_id == User.id).where(Project.id == project_id)
        )
        return plan_for(owner_plan)

    async def _count(self, model, *where) -> int:
        return await self.db.scalar(select(func.count()).select_from(model).where(*where)) or 0

    async def user_usage(self, user_id: UUID) -> dict[str, int]:
        # Archived projects count: deleting, not archiving, frees the slot.
        return {PROJECTS: await self._count(Project, Project.owner_id == user_id)}

    async def project_usage(self, project_id: UUID) -> dict[str, int]:
        members = await self._count(ProjectMember, ProjectMember.project_id == project_id)
        # A pending invite holds a seat, or a project could invite past its limit.
        pending_invites = await self._count(
            ProjectInvite,
            ProjectInvite.project_id == project_id,
            ProjectInvite.accepted_at.is_(None),
            ProjectInvite.revoked_at.is_(None),
            ProjectInvite.expires_at > datetime.now(timezone.utc),
        )
        return {
            ENVIRONMENTS_PER_PROJECT: await self._count(
                Environment, Environment.project_id == project_id, Environment.archived.is_(False)
            ),
            MEMBERS_PER_PROJECT: members + pending_invites,
            INTEGRATIONS_PER_PROJECT: await self._count(Integration, Integration.project_id == project_id),
        }

    # shortcut: count+insert can exceed the limit by one under concurrent creates; add a DB constraint if it matters
    @staticmethod
    def _check(plan: Plan, key: str, used: int, adding: int) -> None:
        limit = plan.limits[key]
        if limit is not None and used + adding > limit:
            raise PlanLimitReached(key, limit)

    async def check_projects(self, owner: User) -> None:
        self._check(plan_for(owner.plan), PROJECTS, (await self.user_usage(owner.id))[PROJECTS], 1)

    async def _check_project(self, project_id: UUID, key: str, adding: int) -> None:
        self._check(await self.owner_plan(project_id), key, (await self.project_usage(project_id))[key], adding)

    async def check_environments(self, project_id: UUID) -> None:
        await self._check_project(project_id, ENVIRONMENTS_PER_PROJECT, 1)

    async def check_members(self, project_id: UUID, adding: int = 1) -> None:
        """`adding=0` when accepting an invite: the pending invite is already counted."""
        await self._check_project(project_id, MEMBERS_PER_PROJECT, adding)

    async def check_integrations(self, project_id: UUID) -> None:
        await self._check_project(project_id, INTEGRATIONS_PER_PROJECT, 1)

    async def audit_since(self, project_id: UUID) -> datetime | None:
        """Oldest audit entry the owner's plan shows; None = everything. Older rows stay in the database."""
        days = (await self.owner_plan(project_id)).limits[AUDIT_RETENTION_DAYS]
        return None if days is None else datetime.now(timezone.utc) - timedelta(days=days)
