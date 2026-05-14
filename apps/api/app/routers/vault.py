from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_db
from app.services.project_service import ProjectService
from app.services.vault_service import VaultService, ConflictError
from app.services.audit_service import AuditService
from app.schemas.vault import VaultPushRequest, VaultPullResponse, VaultBlobPull
from app.middleware.auth import get_current_user, get_current_user_or_api_key
from app.models.user import User

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


@router.post("/push", response_model=VaultPullResponse, status_code=status.HTTP_201_CREATED)
async def push_vault(
    project_id: str,
    environment_id: str,
    request: Request,
    payload: VaultPushRequest,
    current_user: User = Depends(get_current_user),
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

    member = await project_service.check_user_access(current_user.id, project_uuid, "developer")
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or insufficient permissions"
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
        user_id=current_user.id,
        project_id=project_uuid,
        metadata={"blob_count": len(created_blobs)},
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
    current_user: User = Depends(get_current_user_or_api_key),
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
    current_user: User = Depends(get_current_user_or_api_key),
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
