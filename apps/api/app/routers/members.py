from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID, uuid4

from app.database import get_db
from app.services.project_service import ProjectService
from app.services.audit_service import AuditService
from app.schemas.member import MemberAdd, MemberUpdate, MemberResponse, MemberListResponse
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.member import ProjectMember

from sqlalchemy import select


router = APIRouter(prefix="/api/v1/projects/{project_id}/members", tags=["Members"])


def _force_load_member(m):
    """Force-load all column attributes to avoid async lazy-loading errors."""
    _ = m.id
    _ = m.project_id
    _ = m.user_id
    _ = m.role
    _ = m.invited_by
    _ = m.created_at
    _ = m.accepted_at
    return m


@router.post("", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def add_member(
    project_id: str,
    request: Request,
    payload: MemberAdd,
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
        select(ProjectMember).where(
            ProjectMember.project_id == project_uuid,
            ProjectMember.user_id == payload.user_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member"
        )

    new_member = ProjectMember(
        id=uuid4(),
        project_id=project_uuid,
        user_id=payload.user_id,
        role=payload.role,
        invited_by=current_user.id
    )
    db.add(new_member)
    await db.flush()
    await db.refresh(new_member)

    await audit_service.log(
        action="member.added",
        resource_type="member",
        resource_id=new_member.id,
        user_id=current_user.id,
        project_id=project_uuid,
        metadata={"added_user_id": str(payload.user_id), "role": payload.role},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    return MemberResponse.model_validate(_force_load_member(new_member))


@router.get("", response_model=MemberListResponse)
async def list_members(
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
        select(ProjectMember)
        .where(ProjectMember.project_id == project_uuid)
        .order_by(ProjectMember.created_at)
    )
    members = list(result.scalars().all())

    return MemberListResponse(
        members=[MemberResponse.model_validate(_force_load_member(m)) for m in members],
        total=len(members)
    )


@router.get("/{member_id}", response_model=MemberResponse)
async def get_member(
    project_id: str,
    member_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    project_service = ProjectService(db)

    try:
        project_uuid = UUID(project_id)
        member_uuid = UUID(member_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID"
        )

    member = await project_service.check_user_access(current_user.id, project_uuid)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.id == member_uuid,
            ProjectMember.project_id == project_uuid
        )
    )
    target_member = result.scalar_one_or_none()

    if not target_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )

    return MemberResponse.model_validate(_force_load_member(target_member))


@router.patch("/{member_id}", response_model=MemberResponse)
async def update_member(
    project_id: str,
    member_id: str,
    request: Request,
    payload: MemberUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    project_service = ProjectService(db)
    audit_service = AuditService(db)

    try:
        project_uuid = UUID(project_id)
        member_uuid = UUID(member_id)
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
        select(ProjectMember).where(
            ProjectMember.id == member_uuid,
            ProjectMember.project_id == project_uuid
        )
    )
    target_member = result.scalar_one_or_none()

    if not target_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )

    if target_member.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change owner role"
        )

    target_member.role = payload.role
    await db.flush()
    await db.refresh(target_member)

    await audit_service.log(
        action="member.role_changed",
        resource_type="member",
        resource_id=target_member.id,
        user_id=current_user.id,
        project_id=project_uuid,
        metadata={"updated_user_id": str(target_member.user_id), "new_role": payload.role},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    return MemberResponse.model_validate(_force_load_member(target_member))


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    project_id: str,
    member_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    project_service = ProjectService(db)
    audit_service = AuditService(db)

    try:
        project_uuid = UUID(project_id)
        member_uuid = UUID(member_id)
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
        select(ProjectMember).where(
            ProjectMember.id == member_uuid,
            ProjectMember.project_id == project_uuid
        )
    )
    target_member = result.scalar_one_or_none()

    if not target_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )

    if target_member.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove project owner"
        )

    await audit_service.log(
        action="member.removed",
        resource_type="member",
        resource_id=target_member.id,
        user_id=current_user.id,
        project_id=project_uuid,
        metadata={"removed_user_id": str(target_member.user_id), "role": target_member.role},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    await db.delete(target_member)
