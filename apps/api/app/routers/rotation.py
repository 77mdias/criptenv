"""Rotation Router for M3.5 Secret Alerts

Endpoints for secret rotation, expiration management, and rotation status.

GRASP Patterns:
- Controller: Thin router delegating to RotationService
- Protected Variations: Auth via get_current_user dependency
- Information Expert: RotationService handles business logic
"""

from uuid import UUID
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.rotation_service import RotationService
from app.services.project_service import ProjectService
from app.services.audit_service import AuditService
from app.schemas.secret_expiration import (
    ExpirationCreate, ExpirationUpdate, ExpirationResponse,
    ExpirationListResponse, RotationRequest, RotationResponse,
    RotationStatus, RotationHistoryResponse
)
from app.middleware.auth import get_current_user
from app.models.user import User


router = APIRouter(
    prefix="/api/v1/projects/{project_id}/environments/{environment_id}/secrets",
    tags=["Rotation"]
)

expiring_router = APIRouter(
    prefix="/api/v1/projects/{project_id}/secrets",
    tags=["Rotation"]
)


def _load_expiration_fields(e):
    """Force-load expiration fields to avoid async lazy-loading."""
    _ = e.id, e.secret_key, e.expires_at, e.rotation_policy
    _ = e.notify_days_before, e.last_notified_at, e.rotated_at
    _ = e.created_at, e.updated_at, e.project_id, e.environment_id
    return e


async def _check_access(
    user: User, 
    project_id: UUID, 
    environment_id: UUID,
    project_service: ProjectService, 
    required_role: str = "developer"
):
    """Verify user has access to project/environment."""
    member = await project_service.check_user_access(user.id, project_id, required_role)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or insufficient permissions"
        )


@router.post("/{secret_key}/rotate", response_model=RotationResponse)
async def rotate_secret(
    project_id: UUID,
    environment_id: UUID,
    secret_key: str,
    request: Request,
    payload: RotationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Rotate a secret with a new encrypted value.
    
    Creates a new version of the secret, marks old as rotated,
    and logs the rotation to audit.
    """
    project_service = ProjectService(db)
    rotation_service = RotationService(db)
    audit_service = AuditService(db)

    await _check_access(current_user, project_id, environment_id, project_service)

    try:
        rotation, new_version = await rotation_service.rotate_secret(
            project_id=project_id,
            environment_id=environment_id,
            secret_key=secret_key,
            payload=payload,
            user_id=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    await audit_service.log(
        action="secret.rotated",
        resource_type="vault",
        resource_id=environment_id,
        user_id=current_user.id,
        project_id=project_id,
        metadata={
            "secret_key": secret_key, 
            "new_version": new_version,
            "previous_version": rotation.previous_version
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    return RotationResponse(
        rotation_id=rotation.id,
        secret_key=secret_key,
        rotated_at=rotation.rotated_at,
        new_version=new_version,
        previous_version=rotation.previous_version
    )


@router.post("/{secret_key}/expiration", response_model=ExpirationResponse, status_code=status.HTTP_201_CREATED)
async def set_expiration(
    project_id: UUID,
    environment_id: UUID,
    secret_key: str,
    request: Request,
    payload: ExpirationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Configure expiration for a secret.
    
    If expiration already exists, updates it. Otherwise creates new.
    """
    project_service = ProjectService(db)
    rotation_service = RotationService(db)
    audit_service = AuditService(db)

    await _check_access(current_user, project_id, environment_id, project_service)

    # Check if expiration already exists
    existing = await rotation_service.get_expiration(project_id, environment_id, secret_key)
    
    if existing:
        # Update existing
        update_payload = ExpirationUpdate(
            expires_at=payload.expires_at,
            rotation_policy=payload.rotation_policy,
            notify_days_before=payload.notify_days_before
        )
        expiration = await rotation_service.update_expiration(
            project_id, environment_id, secret_key, update_payload
        )
    else:
        # Override secret_key from path (user provides in body but we use path)
        create_payload = ExpirationCreate(
            secret_key=secret_key,
            expires_at=payload.expires_at,
            rotation_policy=payload.rotation_policy,
            notify_days_before=payload.notify_days_before
        )
        expiration = await rotation_service.create_expiration(
            project_id, environment_id, create_payload
        )

    await audit_service.log(
        action="expiration.set",
        resource_type="vault",
        resource_id=environment_id,
        user_id=current_user.id,
        project_id=project_id,
        metadata={
            "secret_key": secret_key, 
            "expires_at": str(expiration.expires_at),
            "policy": expiration.rotation_policy
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    # Force-load fields to avoid lazy loading issues
    _load_expiration_fields(expiration)

    return ExpirationResponse(
        id=expiration.id,
        secret_key=expiration.secret_key,
        expires_at=expiration.expires_at,
        rotation_policy=expiration.rotation_policy,
        notify_days_before=expiration.notify_days_before,
        last_notified_at=expiration.last_notified_at,
        rotated_at=expiration.rotated_at,
        created_at=expiration.created_at,
        updated_at=expiration.updated_at,
        project_id=expiration.project_id,
        environment_id=expiration.environment_id,
        is_expired=expiration.is_expired,
        days_until_expiration=expiration.days_until_expiration
    )


@router.get("/{secret_key}/rotation", response_model=RotationStatus)
async def get_rotation_status(
    project_id: UUID,
    environment_id: UUID,
    secret_key: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get rotation status for a secret.
    
    Returns current version, expiration info, and rotation policy.
    """
    project_service = ProjectService(db)
    rotation_service = RotationService(db)

    await _check_access(current_user, project_id, environment_id, project_service)

    status_data = await rotation_service.get_rotation_status(
        project_id, environment_id, secret_key
    )

    if not status_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Secret not found or no expiration configured"
        )

    return status_data


@expiring_router.get("/expiring", response_model=ExpirationListResponse)
async def list_expiring_secrets(
    project_id: UUID,
    days: int = Query(default=30, ge=1, le=365, description="Days to look ahead"),
    include_expired: bool = Query(default=False, description="Include already expired secrets"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List secrets expiring within N days.
    
    Returns all secrets in the project that will expire within
    the specified number of days, ordered by expiration date.
    """
    project_service = ProjectService(db)
    rotation_service = RotationService(db)

    member = await project_service.check_user_access(current_user.id, project_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Get all expirations for project
    expirations, total = await rotation_service.list_expirations(
        project_id=project_id,
        include_expired=include_expired
    )

    # Filter by days
    cutoff = datetime.now(timezone.utc) + timedelta(days=days)
    now = datetime.now(timezone.utc)
    filtered = [
        e for e in expirations
        if e.expires_at <= cutoff and (include_expired or e.expires_at >= now)
    ]

    # Force-load fields
    for e in filtered:
        _load_expiration_fields(e)

    items = [
        ExpirationResponse(
            id=e.id,
            secret_key=e.secret_key,
            expires_at=e.expires_at,
            rotation_policy=e.rotation_policy,
            notify_days_before=e.notify_days_before,
            last_notified_at=e.last_notified_at,
            rotated_at=e.rotated_at,
            created_at=e.created_at,
            updated_at=e.updated_at,
            project_id=e.project_id,
            environment_id=e.environment_id,
            is_expired=e.is_expired,
            days_until_expiration=e.days_until_expiration
        )
        for e in sorted(filtered, key=lambda x: x.expires_at)
    ]

    return ExpirationListResponse(items=items, total=len(items))


@router.get("/{secret_key}/rotation/history", response_model=RotationHistoryResponse)
async def get_rotation_history(
    project_id: UUID,
    environment_id: UUID,
    secret_key: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get rotation history for a secret.
    
    Returns list of all rotation events for this secret,
    ordered by most recent first.
    """
    project_service = ProjectService(db)
    rotation_service = RotationService(db)

    await _check_access(current_user, project_id, environment_id, project_service)

    history = await rotation_service.get_rotation_history(
        project_id, environment_id, secret_key
    )

    return RotationHistoryResponse(items=history, total=len(history))


@router.delete("/{secret_key}/expiration")
async def delete_expiration(
    project_id: UUID,
    environment_id: UUID,
    secret_key: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete expiration configuration for a secret.
    
    This removes the expiration tracking but does not affect
    the secret itself.
    """
    project_service = ProjectService(db)
    rotation_service = RotationService(db)
    audit_service = AuditService(db)

    await _check_access(current_user, project_id, environment_id, project_service)

    deleted = await rotation_service.delete_expiration(
        project_id, environment_id, secret_key
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expiration not found"
        )

    await audit_service.log(
        action="expiration.deleted",
        resource_type="vault",
        resource_id=environment_id,
        user_id=current_user.id,
        project_id=project_id,
        metadata={"secret_key": secret_key},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    return {"message": "Expiration deleted", "secret_key": secret_key}
