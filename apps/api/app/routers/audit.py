from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional

from app.database import get_db
from app.services.project_service import ProjectService
from app.services.audit_service import AuditService
from app.schemas.audit import AuditActor, AuditLogResponse, AuditLogListResponse
from app.middleware.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/v1/projects/{project_id}/audit", tags=["Audit"])


def _force_load_audit_log(log):
    """Force-load all column attributes to avoid async lazy-loading errors."""
    _ = log.id
    _ = log.user_id
    _ = log.project_id
    _ = log.action
    _ = log.resource_type
    _ = log.resource_id
    _ = log.meta
    _ = log.ip_address
    _ = log.user_agent
    _ = log.created_at
    return log


def _to_response(log, actors: dict) -> AuditLogResponse:
    response = AuditLogResponse.model_validate(_force_load_audit_log(log))
    actor = actors.get(log.user_id)
    if actor is not None:
        response.actor = AuditActor(
            id=actor.id, name=actor.name, email=str(actor.email), avatar_url=actor.avatar_url
        )
    auth_type = (log.meta or {}).get("auth_type")
    if auth_type in ("api_key", "ci_session"):
        response.auth_type = auth_type
    return response


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    project_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
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

    member = await project_service.check_user_access(current_user.id, project_uuid)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    logs, total = await audit_service.get_project_logs(
        project_id=project_uuid,
        page=page,
        per_page=per_page,
        action=action,
        resource_type=resource_type
    )

    actors = await audit_service.get_actors({log.user_id for log in logs if log.user_id})

    return AuditLogListResponse(
        logs=[_to_response(log, actors) for log in logs],
        total=total,
        page=page,
        per_page=per_page
    )
