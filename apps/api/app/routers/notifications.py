from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_db
from app.services.notification_service import NotificationService
from app.schemas.notification import (
    NotificationResponse,
    NotificationListResponse,
    MarkReadResponse,
    MarkAllReadResponse,
    UnreadCountResponse,
)
from app.middleware.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


def _force_load_notification(n):
    """Force-load all column attributes to avoid async lazy-loading errors."""
    _ = n.id
    _ = n.user_id
    _ = n.type
    _ = n.title
    _ = n.message
    _ = n.read_at
    _ = n.action_url
    _ = n.meta
    _ = n.created_at
    return n


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    notification_service = NotificationService(db)

    notifications, total = await notification_service.list_user_notifications(
        user_id=current_user.id,
        limit=limit,
        offset=offset,
        unread_only=unread_only,
    )
    unread_count = await notification_service.get_unread_count(current_user.id)

    return NotificationListResponse(
        notifications=[NotificationResponse.model_validate(_force_load_notification(n)) for n in notifications],
        total=total,
        unread_count=unread_count,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    notification_service = NotificationService(db)
    unread_count = await notification_service.get_unread_count(current_user.id)
    return UnreadCountResponse(unread_count=unread_count)


@router.patch("/{notification_id}/read", response_model=MarkReadResponse)
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        notification_uuid = UUID(notification_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid notification ID"
        )

    notification_service = NotificationService(db)
    notification = await notification_service.mark_as_read(notification_uuid, current_user.id)

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

    return MarkReadResponse(success=True, id=notification.id)


@router.patch("/read-all", response_model=MarkAllReadResponse)
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    notification_service = NotificationService(db)
    marked_count = await notification_service.mark_all_as_read(current_user.id)
    return MarkAllReadResponse(success=True, marked_count=marked_count)
