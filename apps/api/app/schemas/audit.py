from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, Literal
from datetime import datetime
from uuid import UUID


class AuditActor(BaseModel):
    id: UUID
    name: str
    email: str
    avatar_url: Optional[str] = None


class AuditLogResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    action: str
    resource_type: str
    resource_id: Optional[UUID] = None
    metadata: Optional[Dict[str, Any]] = Field(default=None, alias="meta")
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime
    actor: Optional[AuditActor] = None
    # Origin of the action; CI-session actions have no user_id
    auth_type: Literal["session", "api_key", "ci_session"] = "session"

    class Config:
        from_attributes = True
        populate_by_name = True


class AuditLogListResponse(BaseModel):
    logs: list[AuditLogResponse]
    total: int
    page: int
    per_page: int
