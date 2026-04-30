from datetime import datetime, timezone
from typing import Protocol
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.member import ProjectInvite, ProjectMember
from app.models.user import User
from app.strategies.exceptions import InvalidInviteTransition, InviteConflict, PermissionDenied


class InviteTransitionStrategy(Protocol):
    async def execute(
        self,
        db: AsyncSession,
        invite: ProjectInvite,
        project_id: UUID,
        current_user: User,
    ) -> ProjectInvite:
        ...


class AcceptInviteStrategy:
    async def execute(
        self,
        db: AsyncSession,
        invite: ProjectInvite,
        project_id: UUID,
        current_user: User,
    ) -> ProjectInvite:
        if invite.accepted_at:
            raise InvalidInviteTransition("Invite already accepted")
        if invite.revoked_at:
            raise InvalidInviteTransition("Invite has been revoked")
        if invite.expires_at < datetime.now(timezone.utc):
            raise InvalidInviteTransition("Invite has expired")
        if invite.email.lower() != current_user.email.lower():
            raise PermissionDenied("This invite is for a different email")

        existing_member = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == current_user.id,
            )
        )
        if existing_member.scalar_one_or_none():
            raise InviteConflict("Already a member of this project")

        db.add(
            ProjectMember(
                id=uuid4(),
                project_id=project_id,
                user_id=current_user.id,
                role=invite.role,
                invited_by=invite.invited_by,
            )
        )

        invite.accepted_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(invite)
        return invite


class RevokeInviteStrategy:
    async def execute(
        self,
        db: AsyncSession,
        invite: ProjectInvite,
        project_id: UUID,
        current_user: User,
    ) -> ProjectInvite:
        if invite.revoked_at:
            raise InvalidInviteTransition("Invite already revoked")

        invite.revoked_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(invite)
        return invite


class DeleteInviteStrategy:
    async def execute(
        self,
        db: AsyncSession,
        invite: ProjectInvite,
        project_id: UUID,
        current_user: User,
    ) -> ProjectInvite:
        await db.delete(invite)
        return invite
