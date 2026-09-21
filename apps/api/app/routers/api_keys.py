"""API Keys Router for M3.4 Public API

Endpoints for API key CRUD operations.
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.api_key_service import ApiKeyService
from app.services.project_service import ProjectService
from app.schemas.api_key import (
    ApiKeyCreate, ApiKeyUpdate, ApiKeyResponse, 
    ApiKeyListResponse, ApiKeyCreateResponse, ApiKeyRevokeResponse
)
from app.middleware.auth import get_current_user
from app.models.user import User


router = APIRouter(prefix="/projects/{project_id}/api-keys", tags=["API Keys"])


async def _require_project_admin(
    project_service: ProjectService,
    current_user: User,
    project_id: UUID,
) -> None:
    """Reject callers without admin access to the project.

    API keys are project-scoped credentials: managing them requires the same
    `admin` role as CI tokens. Returns 404 (not 403) so the endpoint does not
    disclose the existence of projects the caller cannot access.
    """
    member = await project_service.check_user_access(
        current_user.id, project_id, "admin"
    )
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or insufficient permissions",
        )


@router.post("", response_model=ApiKeyCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    project_id: UUID,
    request: Request,
    payload: ApiKeyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new API key for a project.
    
    Returns the plaintext key ONLY ONCE. The client must store it securely.
    """
    await _require_project_admin(ProjectService(db), current_user, project_id)

    service = ApiKeyService(db, user_id=current_user.id, project_id=project_id)
    
    try:
        api_key, plaintext_key = await service.create_api_key(payload)
        
        return ApiKeyCreateResponse(
            id=api_key.id,
            name=api_key.name,
            key=plaintext_key,  # Plaintext shown only here!
            prefix=api_key.prefix,
            scopes=api_key.scopes,
            environment_scope=api_key.environment_scope,
            expires_at=api_key.expires_at,
            created_at=api_key.created_at
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=ApiKeyListResponse)
async def list_api_keys(
    project_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all API keys for a project (without plaintext)."""
    await _require_project_admin(ProjectService(db), current_user, project_id)

    service = ApiKeyService(db, user_id=current_user.id, project_id=project_id)
    
    keys, total = await service.list_api_keys()
    
    items = [
        ApiKeyResponse(
            id=key.id,
            name=key.name,
            prefix=key.prefix,
            scopes=key.scopes,
            environment_scope=key.environment_scope,
            last_used_at=key.last_used_at,
            expires_at=key.expires_at,
            created_at=key.created_at
        )
        for key in keys
    ]
    
    return ApiKeyListResponse(items=items, total=total)


@router.get("/{key_id}", response_model=ApiKeyResponse)
async def get_api_key(
    project_id: UUID,
    key_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific API key by ID."""
    await _require_project_admin(ProjectService(db), current_user, project_id)

    service = ApiKeyService(db, user_id=current_user.id, project_id=project_id)
    
    key = await service.get_api_key(key_id)
    
    if not key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    
    return ApiKeyResponse(
        id=key.id,
        name=key.name,
        prefix=key.prefix,
        scopes=key.scopes,
        environment_scope=key.environment_scope,
        last_used_at=key.last_used_at,
        expires_at=key.expires_at,
        created_at=key.created_at
    )


@router.patch("/{key_id}", response_model=ApiKeyResponse)
async def update_api_key(
    project_id: UUID,
    key_id: UUID,
    request: Request,
    payload: ApiKeyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update an API key's name or scopes."""
    await _require_project_admin(ProjectService(db), current_user, project_id)

    service = ApiKeyService(db, user_id=current_user.id, project_id=project_id)
    
    try:
        key = await service.update_api_key(
            key_id,
            name=payload.name,
            scopes=payload.scopes
        )
        
        return ApiKeyResponse(
            id=key.id,
            name=key.name,
            prefix=key.prefix,
            scopes=key.scopes,
            environment_scope=key.environment_scope,
            last_used_at=key.last_used_at,
            expires_at=key.expires_at,
            created_at=key.created_at
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{key_id}", response_model=ApiKeyRevokeResponse)
async def revoke_api_key(
    project_id: UUID,
    key_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Revoke an API key. This action is irreversible."""
    await _require_project_admin(ProjectService(db), current_user, project_id)

    service = ApiKeyService(db, user_id=current_user.id, project_id=project_id)
    
    try:
        key = await service.revoke_api_key(key_id)
        
        return ApiKeyRevokeResponse(
            id=key.id,
            name=key.name,
            revoked_at=key.revoked_at
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
