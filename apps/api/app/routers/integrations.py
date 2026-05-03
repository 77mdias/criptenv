"""Router for external integrations management"""

from typing import Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.project import Project
from app.services.integration_service import IntegrationService
from app.services.project_service import ProjectService
from app.services.audit_service import AuditService


router = APIRouter(prefix="/api/v1/projects/{project_id}/integrations", tags=["Integrations"])


# Schemas
class IntegrationCreate(BaseModel):
    provider: str = Field(..., pattern=r'^(vercel|railway|render)$')
    name: str = Field(..., min_length=1, max_length=255)
    config: dict = Field(..., description="Provider-specific configuration")
    
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
    
    class Config:
        from_attributes = True


class IntegrationListResponse(BaseModel):
    integrations: list[IntegrationResponse]
    total: int
    available_providers: list[str]


class SyncRequest(BaseModel):
    direction: str = Field(..., pattern=r'^(push|pull)$')
    environment: str = Field(default="production")
    secrets: Optional[list[dict]] = None


class SyncResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    synced_count: Optional[int] = None


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
    return i


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
        provider: One of 'vercel', 'railway', 'render'
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
    
    # Create integration
    integration = await integration_service.create_integration(
        project_id=project_uuid,
        provider=payload.provider,
        name=payload.name,
        config=payload.config
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
    current_user: User = Depends(get_current_user),
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
    
    # Check access
    member = await project_service.check_user_access(current_user.id, project_uuid)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    integrations = await integration_service.list_integrations(project_uuid)
    providers = integration_service.get_available_providers()
    
    return IntegrationListResponse(
        integrations=[
            IntegrationResponse.model_validate(_force_load_integration(i))
            for i in integrations
        ],
        total=len(integrations),
        available_providers=providers
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
    
    integration = await integration_service.get_integration(integration_uuid)
    if not integration or str(integration.project_id) != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
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
    
    integration = await integration_service.get_integration(integration_uuid)
    if not integration or str(integration.project_id) != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )
    
    await integration_service.delete_integration(integration_uuid)
    
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
    current_user: User = Depends(get_current_user),
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
    
    # Check access
    member = await project_service.check_user_access(current_user.id, project_uuid, "admin")
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or insufficient permissions"
        )
    
    success, error = await integration_service.sync_integration(
        integration_id=integration_uuid,
        direction=payload.direction,
        secrets=payload.secrets,
        environment=payload.environment
    )
    
    if success:
        await audit_service.log(
            action=f"integration.synced.{payload.direction}",
            resource_type="integration",
            resource_id=integration_uuid,
            user_id=current_user.id,
            project_id=project_uuid,
            metadata={"direction": payload.direction, "environment": payload.environment},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent")
        )
        
        return SyncResponse(
            success=True,
            message=f"Successfully synced to {payload.environment}",
            synced_count=len(payload.secrets) if payload.secrets else 0
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
    
    is_valid, error = await integration_service.validate_integration(integration_uuid)
    
    return {
        "valid": is_valid,
        "error": error
    }
