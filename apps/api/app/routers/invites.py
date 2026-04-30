from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID, uuid4
from datetime import datetime, timedelta, timezone
import secrets

from app.database import get_db
from app.services.project_service import ProjectService
from app.services.audit_service import AuditService
from app.schemas.member import InviteCreate, InviteResponse, InviteListResponse
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.member import ProjectInvite

from sqlalchemy import select


router = APIRouter(prefix="/api/v1/projects/{project_id}/invites", tags=["Invites"])


def _force_load_invite(inv):
    """Force-load all column attributes to avoid async lazy-loading errors."""
    _ = inv.id
    _ = inv.project_id
    _ = inv.email
    _ = inv.role
    _ = inv.invited_by
    _ = inv.token
    _ = inv.expires_at
    _ = inv.accepted_at
    _ = inv.revoked_at
    _ = inv.created_at
    return inv


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

    member = await project_service.check_user_access(current_user.id, project_uuid, "admin")
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or insufficient permissions"
        )

    existing = await db.execute(
        select(ProjectInvite).where(
            ProjectInvite.project_id == project_uuid,
            ProjectInvite.email == payload.email,
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
        email=payload.email,
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
        metadata={"email": payload.email, "role": payload.role},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    return InviteResponse.model_validate(_force_load_invite(invite))


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

    return InviteListResponse(
        invites=[InviteResponse.model_validate(_force_load_invite(i)) for i in invites],
        total=len(invites)
    )


@router.post("/{invite_id}/accept", response_model=InviteResponse)
async def accept_invite(
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

    if invite.accepted_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite already accepted"
        )

    if invite.revoked_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite has been revoked"
        )

    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite has expired"
        )

    if invite.email.lower() != current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invite is for a different email"
        )

    existing_member = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_uuid,
            ProjectMember.user_id == current_user.id
        )
    )
    if existing_member.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already a member of this project"
        )

    from app.models.member import ProjectMember

    new_member = ProjectMember(
        id=uuid4(),
        project_id=project_uuid,
        user_id=current_user.id,
        role=invite.role,
        invited_by=invite.invited_by
    )
    db.add(new_member)

    invite.accepted_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(invite)

    await audit_service.log(
        action="invite.accepted",
        resource_type="invite",
        resource_id=invite.id,
        user_id=current_user.id,
        project_id=project_uuid,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    return InviteResponse.model_validate(_force_load_invite(invite))


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

    if invite.revoked_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite already revoked"
        )

    invite.revoked_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(invite)

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

    return InviteResponse.model_validate(_force_load_invite(invite))


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

    await db.delete(invite)
