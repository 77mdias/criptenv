"""Router for external integrations management"""

from typing import Annotated, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.middleware.ci_auth import (
    CI_SESSION_PREFIX,
    validate_ci_session,
    require_ci_session_scope,
)
from app.models.user import User
from app.plans import AUTO_SYNC, SYNC_REDEPLOY
from app.schemas.vault import SecretKind
from app.crypto.integration_config import IntegrationConfigEncryptionError
from app.services.integration_service import IntegrationConfigError, IntegrationService
from app.services.plan_limits import PlanLimits
from app.services.project_service import ProjectService
from app.services.audit_service import AuditService


router = APIRouter(prefix="/api/v1/projects/{project_id}/integrations", tags=["Integrations"])


# Schemas
class IntegrationCreate(BaseModel):
    # Checked against the provider registry (and its required config keys) by the service.
    provider: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=255)
    config: dict = Field(
        ...,
        description=(
            "Provider-specific configuration. vercel: api_token, project_id, optional team_id. "
            "render: api_token, service_id. cloudflare: api_token, account_id, script_name."
        ),
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "provider": "vercel",
                "name": "Production",
                "config": {
                    "api_token": "tok_xxx",
                    "project_id": "prj_123"
                }
            }
        }


class IntegrationResponse(BaseModel):
    id: UUID
    project_id: UUID
    provider: str
    name: str
    status: str
    last_sync_at: Optional[datetime] = None
    last_error: Optional[str] = None
    created_at: datetime
    # Auto-sync binding: {CriptEnv environment id: provider target}. Stored on any plan; it only
    # takes effect while the owner's plan has `auto_sync` (see `features` in the list response).
    auto_sync_targets: dict[str, str] = {}
    redeploy: bool = False
    
    class Config:
        from_attributes = True


class IntegrationUpdate(BaseModel):
    """Omitted fields stay as they are."""
    auto_sync_targets: Optional[dict[UUID, Annotated[str, Field(min_length=1, max_length=64)]]] = Field(
        default=None, max_length=50
    )
    redeploy: Optional[bool] = None


class IntegrationListResponse(BaseModel):
    integrations: list[IntegrationResponse]
    total: int
    available_providers: list[str]
    # Sync features of the plan that applies to this project (its owner's): auto_sync, ci_sync, sync_redeploy.
    features: list[str] = []


class SyncSecret(BaseModel):
    key: str = Field(..., min_length=1, max_length=256)
    value: str = Field(..., max_length=65536)
    # None keeps the provider's pre-kind behaviour (Vercel: encrypted, no conversion).
    kind: Optional[SecretKind] = None


class SyncRequest(BaseModel):
    direction: str = Field(..., pattern=r'^(push|pull)$')
    environment: str = Field(default="production", min_length=1, max_length=64)
    secrets: Optional[list[SyncSecret]] = Field(default=None, max_length=1000)


class SyncResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    synced_count: Optional[int] = None
    # Pull only: plaintext values read from the provider, for the client to encrypt into the vault.
    secrets: Optional[list[SyncSecret]] = None
    # Push only: keys removed from Vercel and created again with the other kind.
    recreated: Optional[list[str]] = None


def _force_load_integration(i):
    """Force-load all column attributes to avoid async lazy-loading errors."""
    _ = i.id
    _ = i.project_id
    _ = i.provider
    _ = i.name
    _ = i.config
    _ = i.status
    _ = i.last_sync_at
    _ = i.last_error
    _ = i.created_at
    _ = i.auto_sync_targets
    _ = i.redeploy
    return i


def _extract_bearer_token(request: Request) -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


async def _authenticate_integration_read_or_ci(
    project_service: ProjectService,
    request: Request,
    db: AsyncSession,
    project_uuid: UUID,
) -> tuple[User | None, dict | None]:
    token = _extract_bearer_token(request)
    if token and token.startswith(CI_SESSION_PREFIX):
        ci_session = await validate_ci_session(token, project_uuid)
        require_ci_session_scope(ci_session, "write:integrations")
        return None, ci_session

    current_user = await get_current_user(request, db)
    member = await project_service.check_user_access(current_user.id, project_uuid)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return current_user, None


async def _authenticate_integration_sync_or_ci(
    project_service: ProjectService,
    request: Request,
    db: AsyncSession,
    project_uuid: UUID,
) -> tuple[User | None, dict | None]:
    token = _extract_bearer_token(request)
    if token and token.startswith(CI_SESSION_PREFIX):
        ci_session = await validate_ci_session(token, project_uuid)
        require_ci_session_scope(ci_session, "write:integrations")
        return None, ci_session

    current_user = await get_current_user(request, db)
    member = await project_service.check_user_access(current_user.id, project_uuid, "admin")
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or insufficient permissions",
        )
    return current_user, None


@router.post("", response_model=IntegrationResponse, status_code=status.HTTP_201_CREATED)
async def create_integration(
    project_id: str,
    request: Request,
    payload: IntegrationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new integration for a project.
    
    Args:
        provider: A registered provider (see available_providers in the list response)
        name: Human-readable name for this integration
        config: Provider-specific configuration (API token, project ID, etc.)
        
    Returns:
        Created integration details
    """
    project_service = ProjectService(db)
    integration_service = IntegrationService(db)
    audit_service = AuditService(db)
    
    try:
        project_uuid = UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid project ID"
        )
    
    # Check access
    member = await project_service.check_user_access(current_user.id, project_uuid, "admin")
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or insufficient permissions"
        )
    
    await PlanLimits(db).check_integrations(project_uuid)

    # Create integration
    try:
        integration = await integration_service.create_integration(
            project_id=project_uuid,
            provider=payload.provider,
            name=payload.name,
            config=payload.config,
            # On by default where the plan includes it; the user can turn it off per connection.
            redeploy=await PlanLimits(db).has_feature(project_uuid, SYNC_REDEPLOY),
        )
    except IntegrationConfigError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except IntegrationConfigEncryptionError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    
    # Log audit
    await audit_service.log(
        action="integration.created",
        resource_type="integration",
        resource_id=integration.id,
        user_id=current_user.id,
        project_id=project_uuid,
        metadata={"provider": payload.provider, "name": payload.name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )
    
    return IntegrationResponse.model_validate(_force_load_integration(integration))


@router.get("", response_model=IntegrationListResponse)
async def list_integrations(
    project_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """List all integrations for a project.
    
    Returns:
        List of integrations with available provider info
    """
    project_service = ProjectService(db)
    integration_service = IntegrationService(db)
    
    try:
        project_uuid = UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid project ID"
        )
    
    await _authenticate_integration_read_or_ci(project_service, request, db, project_uuid)
    
    integrations = await integration_service.list_integrations(project_uuid)
    providers = integration_service.get_available_providers()
    
    return IntegrationListResponse(
        integrations=[
            IntegrationResponse.model_validate(_force_load_integration(i))
            for i in integrations
        ],
        total=len(integrations),
        available_providers=providers,
        features=sorted((await PlanLimits(db).owner_plan(project_uuid)).features),
    )


@router.get("/{integration_id}", response_model=IntegrationResponse)
async def get_integration(
    project_id: str,
    integration_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific integration."""
    project_service = ProjectService(db)
    integration_service = IntegrationService(db)
    
    try:
        project_uuid = UUID(project_id)
        integration_uuid = UUID(integration_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    # Check access
    member = await project_service.check_user_access(current_user.id, project_uuid)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    integration = await integration_service.get_integration(
        integration_uuid, project_id=project_uuid
    )
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )
    
    return IntegrationResponse.model_validate(_force_load_integration(integration))


@router.patch("/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    project_id: str,
    integration_id: str,
    request: Request,
    payload: IntegrationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Set the auto-sync binding and the deploy option of an integration.

    Turning either on needs the feature in the plan of the project's owner
    (402 otherwise); turning them off works on any plan.
    """
    project_service = ProjectService(db)
    integration_service = IntegrationService(db)

    try:
        project_uuid = UUID(project_id)
        integration_uuid = UUID(integration_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )

    member = await project_service.check_user_access(current_user.id, project_uuid, "admin")
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or insufficient permissions"
        )

    limits = PlanLimits(db)
    if payload.auto_sync_targets:
        await limits.require_feature(project_uuid, AUTO_SYNC)
    if payload.redeploy:
        await limits.require_feature(project_uuid, SYNC_REDEPLOY)

    targets = payload.auto_sync_targets
    try:
        integration = await integration_service.update_settings(
            integration_uuid,
            project_id=project_uuid,
            auto_sync_targets=None if targets is None else {str(key): value for key, value in targets.items()},
            redeploy=payload.redeploy,
        )
    except IntegrationConfigError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except IntegrationConfigEncryptionError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )

    await AuditService(db).log(
        action="integration.updated",
        resource_type="integration",
        resource_id=integration.id,
        user_id=current_user.id,
        project_id=project_uuid,
        metadata={
            "auto_sync_environments": len(integration.auto_sync_targets or {}),
            "redeploy": integration.redeploy,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    return IntegrationResponse.model_validate(_force_load_integration(integration))


@router.delete("/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_integration(
    project_id: str,
    integration_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete an integration."""
    project_service = ProjectService(db)
    integration_service = IntegrationService(db)
    audit_service = AuditService(db)
    
    try:
        project_uuid = UUID(project_id)
        integration_uuid = UUID(integration_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    # Check access
    member = await project_service.check_user_access(current_user.id, project_uuid, "admin")
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or insufficient permissions"
        )
    
    integration = await integration_service.get_integration(
        integration_uuid, project_id=project_uuid
    )
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )
    
    await integration_service.delete_integration(
        integration_uuid, project_id=project_uuid
    )
    
    # Log audit
    await audit_service.log(
        action="integration.deleted",
        resource_type="integration",
        resource_id=integration_uuid,
        user_id=current_user.id,
        project_id=project_uuid,
        metadata={"provider": integration.provider, "name": integration.name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )


@router.post("/{integration_id}/sync", response_model=SyncResponse)
async def sync_integration(
    project_id: str,
    integration_id: str,
    request: Request,
    payload: SyncRequest,
    db: AsyncSession = Depends(get_db)
):
    """Sync secrets with an integration.
    
    Args:
        direction: 'push' (criptenv -> provider) or 'pull' (provider -> criptenv)
        environment: Target/source environment (production, preview, etc.)
        secrets: For push, list of {key, value} dicts to send
        
    Returns:
        Sync result with count of synced secrets
    """
    project_service = ProjectService(db)
    integration_service = IntegrationService(db)
    audit_service = AuditService(db)
    
    try:
        project_uuid = UUID(project_id)
        integration_uuid = UUID(integration_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    current_user, ci_session = await _authenticate_integration_sync_or_ci(
        project_service,
        request,
        db,
        project_uuid,
    )
    
    pushed = [secret.model_dump() for secret in payload.secrets or []]
    success, error, pulled = await integration_service.sync_integration(
        integration_id=integration_uuid,
        project_id=project_uuid,
        direction=payload.direction,
        secrets=pushed,
        environment=payload.environment
    )
    synced_count = len(pulled) if payload.direction == "pull" else len(pushed)
    recreated = (pulled or None) if payload.direction == "push" else None

    if success:
        await audit_service.log(
            action=f"integration.synced.{payload.direction}",
            resource_type="integration",
            resource_id=integration_uuid,
            user_id=current_user.id if current_user else None,
            project_id=project_uuid,
            metadata={
                "direction": payload.direction,
                "environment": payload.environment,
                "synced_count": synced_count,
                "recreated": recreated,
                "auth_type": "ci_session" if ci_session else "session",
                "ci_session_id": ci_session.get("session_id") if ci_session else None,
                "ci_token_id": ci_session.get("ci_token_id") if ci_session else None,
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent")
        )
        
        return SyncResponse(
            success=True,
            message=f"Successfully synced {payload.direction} ({payload.environment})",
            synced_count=synced_count,
            secrets=pulled if payload.direction == "pull" else None,
            recreated=recreated,
        )
    else:
        return SyncResponse(
            success=False,
            message=error or "Sync failed"
        )


@router.post("/{integration_id}/validate")
async def validate_integration(
    project_id: str,
    integration_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Validate an integration by testing provider connection.
    
    Returns:
        Validation result with status
    """
    project_service = ProjectService(db)
    integration_service = IntegrationService(db)
    
    try:
        project_uuid = UUID(project_id)
        integration_uuid = UUID(integration_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    # Check access
    member = await project_service.check_user_access(current_user.id, project_uuid, "admin")
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or insufficient permissions"
        )
    
    is_valid, error = await integration_service.validate_integration(
        integration_uuid, project_id=project_uuid
    )
    
    return {
        "valid": is_valid,
        "error": error
    }
