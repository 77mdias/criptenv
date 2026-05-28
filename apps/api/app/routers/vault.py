from inspect import isawaitable, signature

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_db
from app.services.project_service import ProjectService
from app.services.vault_service import VaultService, ConflictError
from app.services.audit_service import AuditService
from app.schemas.vault import VaultPushRequest, VaultPullResponse, VaultBlobPull
from app.middleware.auth import get_current_user, get_current_auth_context, AuthContext
from app.middleware.ci_auth import (
    CI_SESSION_PREFIX,
    validate_ci_session,
    require_ci_session_scope,
    require_ci_session_environment,
)
from app.middleware.api_key_auth import require_api_key_scope, require_api_key_environment
from app.models.user import User
from app.models.environment import Environment
from sqlalchemy import select

router = APIRouter(prefix="/api/v1/projects/{project_id}/environments/{environment_id}/vault", tags=["Vault"])


def _force_load_vault_blob(blob):
    """Force-load all column attributes to avoid async lazy-loading errors."""
    _ = blob.id
    _ = blob.project_id
    _ = blob.environment_id
    _ = blob.key_id
    _ = blob.iv
    _ = blob.ciphertext
    _ = blob.auth_tag
    _ = blob.version
    _ = blob.checksum
    _ = blob.created_at
    _ = blob.updated_at
    return blob


def _extract_bearer_token(request: Request) -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


async def _resolve_current_user(request: Request, db: AsyncSession) -> User:
    override = getattr(request.app, "dependency_overrides", {}).get(get_current_user)
    if override is None:
        return await get_current_user(request, db)

    kwargs = {}
    parameters = signature(override).parameters
    if "request" in parameters:
        kwargs["request"] = request
    if "db" in parameters:
        kwargs["db"] = db

    result = override(**kwargs)
    if isawaitable(result):
        return await result
    return result


async def _get_environment_or_404(
    db: AsyncSession,
    project_uuid: UUID,
    env_uuid: UUID,
) -> Environment:
    result = await db.execute(
        select(Environment).where(
            Environment.id == env_uuid,
            Environment.project_id == project_uuid,
        )
    )
    environment = result.scalar_one_or_none()
    if not environment or getattr(environment, "archived", False):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Environment not found",
        )
    return environment


async def _authenticate_vault_write(
    project_service: ProjectService,
    db: AsyncSession,
    request: Request,
    project_uuid: UUID,
    env_uuid: UUID,
) -> tuple[User | None, dict | None, Environment | None]:
    token = _extract_bearer_token(request)

    if token and token.startswith(CI_SESSION_PREFIX):
        environment = await _get_environment_or_404(db, project_uuid, env_uuid)
        ci_session = await validate_ci_session(token, project_uuid)
        require_ci_session_scope(ci_session, "write:secrets")
        require_ci_session_environment(ci_session, environment.name)
        return None, ci_session, environment

    current_user = await _resolve_current_user(request, db)
    member = await project_service.check_user_access(current_user.id, project_uuid, "developer")
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or insufficient permissions",
        )
    return current_user, None, None


async def _authenticate_vault_read(
    auth_context: AuthContext,
    db: AsyncSession,
    project_uuid: UUID,
    env_uuid: UUID,
) -> tuple[User, Environment]:
    environment = await _get_environment_or_404(db, project_uuid, env_uuid)
    if auth_context.auth_type == "api_key" and auth_context.api_key is not None:
        require_api_key_scope(auth_context.api_key, "read:secrets")
        require_api_key_environment(auth_context.api_key, environment.name)
    return auth_context.user, environment


@router.post("/push", response_model=VaultPullResponse, status_code=status.HTTP_201_CREATED)
async def push_vault(
    project_id: str,
    environment_id: str,
    request: Request,
    payload: VaultPushRequest,
    db: AsyncSession = Depends(get_db)
):
    project_service = ProjectService(db)
    vault_service = VaultService(db)
    audit_service = AuditService(db)

    try:
        project_uuid = UUID(project_id)
        env_uuid = UUID(environment_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID"
        )

    current_user, ci_session, _environment = await _authenticate_vault_write(
        project_service,
        db,
        request,
        project_uuid,
        env_uuid,
    )

    project = await project_service.get_project(project_uuid)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    if project_service.has_vault_config(project) and not project_service.verify_vault_proof(project, payload.vault_proof):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid vault password"
        )

    try:
        blobs_data = [blob.model_dump() for blob in payload.blobs]
        created_blobs, conflict = await vault_service.push_blobs(
            project_id=project_uuid,
            environment_id=env_uuid,
            blobs=blobs_data,
            expected_version=payload.expected_version,
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Version conflict detected",
                "current_version": e.current_version,
                "expected_version": e.expected_version
            }
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

    await audit_service.log(
        action="vault.pushed",
        resource_type="vault",
        resource_id=env_uuid,
        user_id=current_user.id if current_user else None,
        project_id=project_uuid,
        metadata={
            "blob_count": len(created_blobs),
            "auth_type": "ci_session" if ci_session else "session",
            "ci_session_id": ci_session.get("session_id") if ci_session else None,
            "ci_token_id": ci_session.get("ci_token_id") if ci_session else None,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    current_version = await vault_service.get_environment_version(project_uuid, env_uuid)

    return VaultPullResponse(
        blobs=[VaultBlobPull.model_validate(_force_load_vault_blob(b)) for b in created_blobs],
        version=current_version
    )


@router.get("/pull", response_model=VaultPullResponse)
async def pull_vault(
    project_id: str,
    environment_id: str,
    auth_context: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db)
):
    project_service = ProjectService(db)
    vault_service = VaultService(db)

    try:
        project_uuid = UUID(project_id)
        env_uuid = UUID(environment_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID"
        )

    current_user, _environment = await _authenticate_vault_read(
        auth_context,
        db,
        project_uuid,
        env_uuid,
    )

    member = await project_service.check_user_access(current_user.id, project_uuid)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    try:
        blobs, version = await vault_service.pull_blobs(
            project_id=project_uuid,
            environment_id=env_uuid
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

    return VaultPullResponse(
        blobs=[VaultBlobPull.model_validate(_force_load_vault_blob(b)) for b in blobs],
        version=version
    )


@router.get("/version", response_model=dict)
async def get_vault_version(
    project_id: str,
    environment_id: str,
    auth_context: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db)
):
    project_service = ProjectService(db)
    vault_service = VaultService(db)

    try:
        project_uuid = UUID(project_id)
        env_uuid = UUID(environment_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID"
        )

    current_user, _environment = await _authenticate_vault_read(
        auth_context,
        db,
        project_uuid,
        env_uuid,
    )

    member = await project_service.check_user_access(current_user.id, project_uuid)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    try:
        version = await vault_service.get_environment_version(project_uuid, env_uuid)
        blob_count = await vault_service.get_blob_count(project_uuid, env_uuid)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

    return {
        "version": version,
        "blob_count": blob_count
    }
