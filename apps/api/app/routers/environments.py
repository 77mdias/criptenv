from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID, uuid4

from app.database import get_db
from app.services.project_service import ProjectService
from app.services.audit_service import AuditService
from app.schemas.environment import EnvironmentCreate, EnvironmentUpdate, EnvironmentResponse, EnvironmentListResponse
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.environment import Environment

from sqlalchemy import select


router = APIRouter(prefix="/api/v1/projects/{project_id}/environments", tags=["Environments"])


def _force_load_environment(env):
    """Force-load all column attributes to avoid async lazy-loading errors."""
    _ = env.id
    _ = env.project_id
    _ = env.name
    _ = env.display_name
    _ = env.is_default
    _ = env.secrets_version
    _ = env.created_at
    _ = env.updated_at
    return env


@router.post("", response_model=EnvironmentResponse, status_code=status.HTTP_201_CREATED)
async def create_environment(
    project_id: str,
    request: Request,
    payload: EnvironmentCreate,
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
        select(Environment).where(
            Environment.project_id == project_uuid,
            Environment.name == payload.name
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Environment '{payload.name}' already exists"
        )

    environment = Environment(
        id=uuid4(),
        project_id=project_uuid,
        name=payload.name,
        display_name=payload.display_name,
        is_default=payload.is_default,
        secrets_version=0
    )
    db.add(environment)
    await db.flush()
    await db.refresh(environment)

    await audit_service.log(
        action="environment.created",
        resource_type="environment",
        resource_id=environment.id,
        user_id=current_user.id,
        project_id=project_uuid,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    return EnvironmentResponse.model_validate(_force_load_environment(environment))


@router.get("", response_model=EnvironmentListResponse)
async def list_environments(
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
        select(Environment)
        .where(Environment.project_id == project_uuid)
        .order_by(Environment.is_default.desc(), Environment.name)
    )
    environments = list(result.scalars().all())

    return EnvironmentListResponse(
        environments=[EnvironmentResponse.model_validate(_force_load_environment(e)) for e in environments],
        total=len(environments)
    )


@router.get("/{environment_id}", response_model=EnvironmentResponse)
async def get_environment(
    project_id: str,
    environment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    project_service = ProjectService(db)

    try:
        project_uuid = UUID(project_id)
        env_uuid = UUID(environment_id)
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
        select(Environment).where(
            Environment.id == env_uuid,
            Environment.project_id == project_uuid
        )
    )
    environment = result.scalar_one_or_none()

    if not environment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Environment not found"
        )

    return EnvironmentResponse.model_validate(_force_load_environment(environment))


@router.patch("/{environment_id}", response_model=EnvironmentResponse)
async def update_environment(
    project_id: str,
    environment_id: str,
    request: Request,
    payload: EnvironmentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    project_service = ProjectService(db)
    audit_service = AuditService(db)

    try:
        project_uuid = UUID(project_id)
        env_uuid = UUID(environment_id)
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
        select(Environment).where(
            Environment.id == env_uuid,
            Environment.project_id == project_uuid
        )
    )
    environment = result.scalar_one_or_none()

    if not environment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Environment not found"
        )

    if payload.display_name is not None:
        environment.display_name = payload.display_name
    if payload.is_default is not None:
        environment.is_default = payload.is_default

    await db.flush()
    await db.refresh(environment)

    await audit_service.log(
        action="environment.updated",
        resource_type="environment",
        resource_id=environment.id,
        user_id=current_user.id,
        project_id=project_uuid,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    return EnvironmentResponse.model_validate(_force_load_environment(environment))


@router.delete("/{environment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_environment(
    project_id: str,
    environment_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    project_service = ProjectService(db)
    audit_service = AuditService(db)

    try:
        project_uuid = UUID(project_id)
        env_uuid = UUID(environment_id)
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
        select(Environment).where(
            Environment.id == env_uuid,
            Environment.project_id == project_uuid
        )
    )
    environment = result.scalar_one_or_none()

    if not environment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Environment not found"
        )

    if environment.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete default environment"
        )

    await audit_service.log(
        action="environment.deleted",
        resource_type="environment",
        resource_id=environment.id,
        user_id=current_user.id,
        project_id=project_uuid,
        metadata={"environment_name": environment.name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    await db.delete(environment)
