from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    title: str
    message: str
    read_at: Optional[datetime] = None
    action_url: Optional[str] = None
    meta: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    total: int
    unread_count: int


class MarkReadResponse(BaseModel):
    success: bool
    id: UUID


class MarkAllReadResponse(BaseModel):
    success: bool
    marked_count: int


class UnreadCountResponse(BaseModel):
    unread_count: int
