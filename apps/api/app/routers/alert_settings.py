from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import settings
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.alert_settings import AlertSettingsPatch, AlertSettingsResponse
from app.services.alert_payload import build_alert_payload
from app.services.alert_settings_service import (
    AlertSettingsConfigurationError,
    AlertSettingsService,
    validate_webhook_url,
)
from app.services.audit_service import AuditService
from app.services.project_service import ProjectService
from app.services.webhook_service import DeliveryResult, WebhookService


router = APIRouter(
    prefix="/api/v1/projects/{project_id}/alert-settings",
    tags=["Alert Settings"],
)


async def send_alert_test_webhook(url: str, payload: dict[str, Any]) -> DeliveryResult:
    """Temporary delivery boundary for the alert settings test action."""
    await validate_webhook_url(url, settings.APP_ENV)
    return await WebhookService().send(url, "alert.test", payload)


async def _require_admin(
    project_id: UUID,
    current_user: User,
    db: AsyncSession,
) -> ProjectService:
    project_service = ProjectService(db)
    member = await project_service.check_user_access(current_user.id, project_id, "admin")
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or insufficient permissions",
        )
    return project_service


def _configuration_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unable to safely configure alert settings",
    )


@router.get("", response_model=AlertSettingsResponse)
async def get_alert_settings(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project_service = await _require_admin(project_id, current_user, db)
    project = await project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    try:
        return AlertSettingsService().get(project)
    except AlertSettingsConfigurationError as exc:
        raise _configuration_error() from exc


@router.patch("", response_model=AlertSettingsResponse)
async def patch_alert_settings(
    project_id: UUID,
    request: Request,
    payload: AlertSettingsPatch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project_service = await _require_admin(project_id, current_user, db)
    project = await project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    try:
        response = await AlertSettingsService().update(project, payload)
    except AlertSettingsConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unable to safely configure alert settings",
        ) from exc

    await AuditService(db).log(
        action="project.alert_settings_updated",
        resource_type="project",
        resource_id=project_id,
        user_id=current_user.id,
        project_id=project_id,
        metadata={"changed_fields": sorted(payload.model_fields_set)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    return response


@router.post("/test-webhook")
async def test_alert_webhook(
    project_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project_service = await _require_admin(project_id, current_user, db)
    project = await project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    settings_service = AlertSettingsService()
    try:
        webhook_url = settings_service.get_webhook_url(project)
    except AlertSettingsConfigurationError as exc:
        raise _configuration_error() from exc
    if not webhook_url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook is not configured")

    payload = build_alert_payload(
        project_id=project_id,
        project_name=getattr(project, "name", None),
        action_url=f"/projects/{project_id}/alerts",
        test=True,
    )
    try:
        result = await send_alert_test_webhook(webhook_url, payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid webhook target") from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Webhook delivery failed") from exc
    if not result.success:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Webhook delivery failed")

    await AuditService(db).log(
        action="alert_settings.test_webhook",
        resource_type="project",
        resource_id=project_id,
        user_id=current_user.id,
        project_id=project_id,
        metadata={"action": "test_webhook", "success": True},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    return {"success": True}
