from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID, uuid4
from datetime import datetime, timedelta, timezone
import secrets

from app.database import get_db
from app.services.project_service import ProjectService
from app.services.audit_service import AuditService
from app.services.email_service import EmailService
from app.services.notification_service import NotificationService
from app.config import settings
from app.schemas.member import InviteCreate, InviteResponse, InviteListResponse
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.member import ProjectInvite
from app.strategies.exceptions import DomainError
from app.strategies.invite_transitions import (
    AcceptInviteStrategy,
    DeleteInviteStrategy,
)

from sqlalchemy import func, select


router = APIRouter(prefix="/api/v1/projects/{project_id}/invites", tags=["Invites"])


ADMIN_ROLES = {"admin", "owner"}


def _invite_to_response(inv, invited_by_user=None, invitee_user=None):
    """Convert ProjectInvite to response dict with user info."""
    return {
        "id": inv.id,
        "project_id": inv.project_id,
        "email": inv.email,
        "role": inv.role,
        "invited_by": inv.invited_by,
        "token": inv.token,
        "expires_at": inv.expires_at,
        "accepted_at": inv.accepted_at,
        "revoked_at": inv.revoked_at,
        "created_at": inv.created_at,
        "invited_by_name": getattr(invited_by_user, "name", None) if invited_by_user else None,
        "invited_by_avatar_url": getattr(invited_by_user, "avatar_url", None) if invited_by_user else None,
        "invitee_name": getattr(invitee_user, "name", None) if invitee_user else None,
        "invitee_avatar_url": getattr(invitee_user, "avatar_url", None) if invitee_user else None,
    }


@router.post("", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
async def create_invite(
    project_id: str,
    request: Request,
    payload: InviteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    project_service = ProjectService(db)
    audit_service = AuditService(db)

    try:
        project_uuid = UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid project ID"
        )

    member = await project_service.check_user_access(current_user.id, project_uuid, "developer")
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or insufficient permissions"
        )

    if member.role not in ADMIN_ROLES and payload.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Developers can only invite developer or viewer roles"
        )

    invite_email = str(payload.email).strip().lower()
    project = await project_service.get_project(project_uuid)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    existing = await db.execute(
        select(ProjectInvite).where(
            ProjectInvite.project_id == project_uuid,
            func.lower(ProjectInvite.email) == invite_email,
            ProjectInvite.accepted_at.is_(None),
            ProjectInvite.revoked_at.is_(None)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Pending invite already exists for this email"
        )

    invite = ProjectInvite(
        id=uuid4(),
        project_id=project_uuid,
        email=invite_email,
        role=payload.role,
        invited_by=current_user.id,
        token=secrets.token_urlsafe(32),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db.add(invite)
    await db.flush()
    await db.refresh(invite)

    await audit_service.log(
        action="invite.created",
        resource_type="invite",
        resource_id=invite.id,
        user_id=current_user.id,
        project_id=project_uuid,
        metadata={"email": invite_email, "role": payload.role},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    frontend_url = settings.FRONTEND_URL.rstrip("/")
    invite_url = f"{frontend_url}/invites/accept?token={invite.token}"

    # Send invitation email
    email_service = EmailService()
    email_service.send_project_invite(
        to=invite_email,
        invite_url=invite_url,
        project_name=project.name,
        role=payload.role,
        invited_by_name=current_user.name or "",
        expires_days=7
    )

    # Create in-app notification for the invited user if they have an account
    notification_service = NotificationService(db)
    invited_user_result = await db.execute(
        select(User).where(func.lower(User.email) == invite_email)
    )
    invited_user = invited_user_result.scalar_one_or_none()
    if invited_user:
        await notification_service.create_notification(
            user_id=invited_user.id,
            type="invite",
            title=f"Convite para {project.name}",
            message=f"{current_user.name or 'Alguém'} convidou você para participar do projeto '{project.name}' como {payload.role}.",
            action_url=f"/invites/accept?token={invite.token}",
            meta={
                "project_id": str(project_uuid),
                "project_name": project.name,
                "invited_by": str(current_user.id),
                "invited_by_name": current_user.name or "",
                "role": payload.role,
                "invite_id": str(invite.id),
            }
        )

    return InviteResponse.model_validate(_invite_to_response(invite))


@router.get("", response_model=InviteListResponse)
async def list_invites(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    project_service = ProjectService(db)

    try:
        project_uuid = UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid project ID"
        )

    member = await project_service.check_user_access(current_user.id, project_uuid)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    result = await db.execute(
        select(ProjectInvite)
        .where(ProjectInvite.project_id == project_uuid)
        .order_by(ProjectInvite.created_at.desc())
    )
    invites = list(result.scalars().all())

    # Pre-load invited_by users and invitee users by email
    invited_by_ids = {i.invited_by for i in invites if i.invited_by}
    invitee_emails = {i.email.lower() for i in invites}

    invited_by_users: dict = {}
    if invited_by_ids:
        user_result = await db.execute(select(User).where(User.id.in_(invited_by_ids)))
        invited_by_users = {u.id: u for u in user_result.scalars().all()}

    invitee_users: dict = {}
    if invitee_emails:
        invitee_result = await db.execute(select(User).where(func.lower(User.email).in_(invitee_emails)))
        invitee_users = {u.email.lower(): u for u in invitee_result.scalars().all()}

    return InviteListResponse(
        invites=[
            InviteResponse.model_validate(
                _invite_to_response(
                    i,
                    invited_by_user=invited_by_users.get(i.invited_by),
                    invitee_user=invitee_users.get(i.email.lower()),
                )
            )
            for i in invites
        ],
        total=len(invites),
    )


@router.post("/{invite_id}/accept", response_model=InviteResponse)
async def accept_invite(
    project_id: str,
    invite_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    audit_service = AuditService(db)

    try:
        project_uuid = UUID(project_id)
        invite_uuid = UUID(invite_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID"
        )

    result = await db.execute(
        select(ProjectInvite).where(
            ProjectInvite.id == invite_uuid,
            ProjectInvite.project_id == project_uuid
        )
    )
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found"
        )

    try:
        invite = await AcceptInviteStrategy().execute(
            db=db,
            invite=invite,
            project_id=project_uuid,
            current_user=current_user
        )
    except DomainError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    await audit_service.log(
        action="invite.accepted",
        resource_type="invite",
        resource_id=invite.id,
        user_id=current_user.id,
        project_id=project_uuid,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    return InviteResponse.model_validate(_invite_to_response(invite))


@router.post("/{invite_id}/revoke", response_model=InviteResponse)
async def revoke_invite(
    project_id: str,
    invite_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    project_service = ProjectService(db)
    audit_service = AuditService(db)

    try:
        project_uuid = UUID(project_id)
        invite_uuid = UUID(invite_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID"
        )

    member = await project_service.check_user_access(current_user.id, project_uuid, "developer")
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or insufficient permissions"
        )

    result = await db.execute(
        select(ProjectInvite).where(
            ProjectInvite.id == invite_uuid,
            ProjectInvite.project_id == project_uuid
        )
    )
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found"
        )

    if invite.accepted_at or invite.revoked_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending invites can be revoked"
        )

    if member.role not in ADMIN_ROLES and invite.invited_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found or insufficient permissions"
        )

    response = InviteResponse.model_validate(_invite_to_response(invite))

    await audit_service.log(
        action="invite.revoked",
        resource_type="invite",
        resource_id=invite.id,
        user_id=current_user.id,
        project_id=project_uuid,
        metadata={"email": invite.email},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    notification_service = NotificationService(db)
    await notification_service.delete_invite_notifications(invite.id)
    await DeleteInviteStrategy().execute(
        db=db,
        invite=invite,
        project_id=project_uuid,
        current_user=current_user
    )

    return response


@router.delete("/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invite(
    project_id: str,
    invite_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    project_service = ProjectService(db)
    audit_service = AuditService(db)

    try:
        project_uuid = UUID(project_id)
        invite_uuid = UUID(invite_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID"
        )

    member = await project_service.check_user_access(current_user.id, project_uuid, "admin")
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or insufficient permissions"
        )

    result = await db.execute(
        select(ProjectInvite).where(
            ProjectInvite.id == invite_uuid,
            ProjectInvite.project_id == project_uuid
        )
    )
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found"
        )

    await audit_service.log(
        action="invite.deleted",
        resource_type="invite",
        resource_id=invite.id,
        user_id=current_user.id,
        project_id=project_uuid,
        metadata={"email": invite.email},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    notification_service = NotificationService(db)
    await notification_service.delete_invite_notifications(invite.id)
    await DeleteInviteStrategy().execute(
        db=db,
        invite=invite,
        project_id=project_uuid,
        current_user=current_user
    )
