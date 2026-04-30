from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID, uuid4
import secrets
import hashlib

from app.database import get_db
from app.services.project_service import ProjectService
from app.services.audit_service import AuditService
from app.schemas.member import CITokenCreate, CITokenResponse, CITokenWithPlaintext, CITokenListResponse
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.member import CIToken

from sqlalchemy import select


router = APIRouter(prefix="/api/v1/projects/{project_id}/tokens", tags=["CI Tokens"])


def _force_load_ci_token(t):
    """Force-load all column attributes to avoid async lazy-loading errors."""
    _ = t.id
    _ = t.project_id
    _ = t.name
    _ = t.token_hash
    _ = t.last_used_at
    _ = t.expires_at
    _ = t.created_at
    return t


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@router.post("", response_model=CITokenWithPlaintext, status_code=status.HTTP_201_CREATED)
async def create_token(
    project_id: str,
    request: Request,
    payload: CITokenCreate,
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

    plain_token = f"ci_{secrets.token_urlsafe(48)}"
    token_hash = hash_token(plain_token)

    ci_token = CIToken(
        id=uuid4(),
        project_id=project_uuid,
        name=payload.name,
        token_hash=token_hash,
        expires_at=payload.expires_at
    )
    db.add(ci_token)
    await db.flush()
    await db.refresh(ci_token)

    await audit_service.log(
        action="token.created",
        resource_type="ci_token",
        resource_id=ci_token.id,
        user_id=current_user.id,
        project_id=project_uuid,
        metadata={"name": payload.name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    return CITokenWithPlaintext(
        token=plain_token,
        token_info=CITokenResponse.model_validate(_force_load_ci_token(ci_token))
    )


@router.get("", response_model=CITokenListResponse)
async def list_tokens(
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
        select(CIToken)
        .where(CIToken.project_id == project_uuid)
        .order_by(CIToken.created_at.desc())
    )
    tokens = list(result.scalars().all())

    return CITokenListResponse(
        tokens=[CITokenResponse.model_validate(_force_load_ci_token(t)) for t in tokens],
        total=len(tokens)
    )


@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_token(
    project_id: str,
    token_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    project_service = ProjectService(db)
    audit_service = AuditService(db)

    try:
        project_uuid = UUID(project_id)
        token_uuid = UUID(token_id)
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
        select(CIToken).where(
            CIToken.id == token_uuid,
            CIToken.project_id == project_uuid
        )
    )
    ci_token = result.scalar_one_or_none()

    if not ci_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found"
        )

    await audit_service.log(
        action="token.deleted",
        resource_type="ci_token",
        resource_id=ci_token.id,
        user_id=current_user.id,
        project_id=project_uuid,
        metadata={"name": ci_token.name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    await db.delete(ci_token)
