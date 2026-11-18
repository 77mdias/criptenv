from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID, uuid4

from app.database import get_db
from app.services.plan_limits import PlanLimits
from app.services.project_service import ProjectService
from app.services.audit_service import AuditService
from app.services.environment_access import credential_reaches, restriction_error, sees_restricted
from app.services import environment_inheritance as inheritance
from app.schemas.environment import (
    EnvironmentCreate, EnvironmentDiffResponse, EnvironmentListResponse, EnvironmentResponse, EnvironmentUpdate,
)
from app.middleware.auth import get_current_user, get_current_auth_context, AuthContext
from app.middleware.api_key_auth import require_api_key_environment, require_api_key_project
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
    _ = env.archived
    _ = env.archived_at
    _ = env.created_at
    _ = env.updated_at
    _ = env.restricted
    _ = env.parent_id
    _ = env.expires_at
    _ = env.unset_keys
    return env


def _unprocessable(error: Exception) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error))


def _refuse_bad_restriction(name: str, *, is_default: bool, restricted: bool) -> None:
    """422 when the environment may not be restricted (a seeded one, or the project's default)."""
    error = restriction_error(name, is_default=is_default, restricted=restricted)
    if error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=error)


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

    existing = (await db.execute(
        select(Environment).where(
            Environment.project_id == project_uuid,
            Environment.name == payload.name
        )
    )).scalar_one_or_none()
    if existing is not None and existing.parent_id is not None and inheritance.is_expired(existing):
        # An expired child the cleanup job has not reached yet: its name is free.
        await inheritance.purge(db, existing)
        existing = None
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Environment '{payload.name}' already exists"
        )

    _refuse_bad_restriction(payload.name, is_default=payload.is_default, restricted=payload.restricted)

    parent = await db.get(Environment, payload.parent_id) if payload.parent_id else None
    if payload.parent_id and parent is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Parent environment not found")
    if parent is not None and parent.restricted and not sees_restricted(member.role):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Parent environment not found")
    try:
        restricted, expires_at = await inheritance.plan_child(
            db, parent, project_uuid, payload.ttl_seconds, payload.restricted, payload.is_default
        )
    except inheritance.InheritanceError as error:
        raise _unprocessable(error)

    # Ephemeral environments (with an expiry) do not count against the plan's environment limit.
    if expires_at is None:
        await PlanLimits(db).check_environments(project_uuid)

    environment = Environment(
        id=uuid4(),
        project_id=project_uuid,
        name=payload.name,
        display_name=payload.display_name,
        is_default=payload.is_default,
        restricted=restricted,
        secrets_version=0,
        archived=False,
        archived_at=None,
        parent_id=parent.id if parent else None,
        expires_at=expires_at,
        unset_keys=[],
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
        metadata={
            "environment_name": environment.name,
            **({"parent_id": str(parent.id), "parent_name": parent.name} if parent else {}),
            **({"expires_at": expires_at.isoformat()} if expires_at else {}),
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    return EnvironmentResponse.model_validate(_force_load_environment(environment))


@router.get("", response_model=EnvironmentListResponse)
async def list_environments(
    project_id: str,
    auth_context: AuthContext = Depends(get_current_auth_context),
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

    if auth_context.auth_type == "api_key" and auth_context.api_key is not None:
        require_api_key_project(auth_context.api_key, project_uuid)

    member = await project_service.check_user_access(auth_context.user.id, project_uuid)
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
    environments = [env for env in result.scalars().all() if not inheritance.is_gone(env)]
    if not sees_restricted(member.role):
        # For anyone but the owner and admins a restricted environment does not exist.
        environments = [env for env in environments if not env.restricted]
    environment_scope = None
    if auth_context.auth_type == "api_key" and auth_context.api_key is not None:
        environment_scope = getattr(auth_context.api_key, "environment_scope", None)
        # No scope = every open environment; a restricted one only for a key scoped to it.
        environments = [env for env in environments if credential_reaches(env, environment_scope)]

    return EnvironmentListResponse(
        environments=[EnvironmentResponse.model_validate(_force_load_environment(e)) for e in environments],
        total=len(environments),
        api_key_environment_scope=environment_scope,
    )


async def _readable_environment(
    project_id: str, environment_id: str, auth_context: AuthContext, db: AsyncSession
) -> Environment:
    """The environment as the caller may read it: 404 when gone, restricted for the role or out of the key's scope."""
    project_service = ProjectService(db)

    try:
        project_uuid = UUID(project_id)
        env_uuid = UUID(environment_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID"
        )

    if auth_context.auth_type == "api_key" and auth_context.api_key is not None:
        require_api_key_project(auth_context.api_key, project_uuid)

    member = await project_service.check_user_access(auth_context.user.id, project_uuid)
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
    if inheritance.is_gone(environment) or (environment.restricted and not sees_restricted(member.role)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Environment not found"
        )
    if auth_context.auth_type == "api_key" and auth_context.api_key is not None:
        require_api_key_environment(auth_context.api_key, environment.name, restricted=environment.restricted)
    return environment


@router.get("/{environment_id}", response_model=EnvironmentResponse)
async def get_environment(
    project_id: str,
    environment_id: str,
    auth_context: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db)
):
    environment = await _readable_environment(project_id, environment_id, auth_context, db)
    return EnvironmentResponse.model_validate(_force_load_environment(environment))


@router.get("/{environment_id}/diff", response_model=EnvironmentDiffResponse)
async def diff_environment(
    project_id: str,
    environment_id: str,
    auth_context: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db)
):
    """Key names of a child against its parent, with where each value comes from. Never a value."""
    environment = await _readable_environment(project_id, environment_id, auth_context, db)
    try:
        chain = await inheritance.load_chain(db, environment)
        keys = await inheritance.diff_with_parent(db, chain)
    except inheritance.InheritanceError as error:
        raise _unprocessable(error)
    return EnvironmentDiffResponse(environment=environment.name, parent=chain[1].name, keys=keys)


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
    if inheritance.is_gone(environment):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Environment not found"
        )

    if environment.parent_id is not None and payload.is_default:
        raise HTTPException(status_code=422, detail="A child environment cannot be the project's default")
    if environment.parent_id is not None and payload.restricted is False:
        ancestors = (await inheritance.load_chain(db, environment))[1:]
        if any(a.restricted for a in ancestors):
            raise HTTPException(status_code=422, detail="A child of a restricted environment stays restricted")
    if payload.restricted and not environment.restricted:
        if any(not d.restricted and not inheritance.is_gone(d) for d in await inheritance.descendants(db, environment)):
            raise HTTPException(
                status_code=422,
                detail="Restrict its child environments first: an open child would hand out the inherited secrets",
            )

    # Checked on what the environment will be after this change, so neither order of the two
    # fields can leave a restricted default behind.
    is_default = environment.is_default if payload.is_default is None else payload.is_default
    restricted = environment.restricted if payload.restricted is None else payload.restricted
    _refuse_bad_restriction(environment.name, is_default=bool(is_default), restricted=bool(restricted))

    if payload.display_name is not None:
        environment.display_name = payload.display_name
    environment.is_default = is_default
    environment.restricted = restricted

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
    if inheritance.is_gone(environment):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Environment not found"
        )

    if environment.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete default environment"
        )

    children = await inheritance.live_children(db, environment)
    if children:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Environment has {len(children)} child environment(s); delete them first",
        )

    if environment.parent_id is not None:
        # A child is deleted for real (its overrides only; the parent is untouched), so the
        # next worktree can take its name again.
        name, parent_id = environment.name, environment.parent_id
        await inheritance.purge(db, environment)  # with any expired child still waiting for cleanup
        await audit_service.log(
            action="environment.deleted",
            resource_type="environment",
            resource_id=env_uuid,
            user_id=current_user.id,
            project_id=project_uuid,
            metadata={"environment_name": name, "parent_id": str(parent_id), "reason": "manual"},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent")
        )
        return

    environment.archived = True
    environment.archived_at = datetime.now(timezone.utc)
    await db.flush()

    await audit_service.log(
        action="environment.archived",
        resource_type="environment",
        resource_id=environment.id,
        user_id=current_user.id,
        project_id=project_uuid,
        metadata={"environment_name": environment.name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )
