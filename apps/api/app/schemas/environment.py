from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class EnvironmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, pattern=r'^[a-z0-9-]+$')
    display_name: Optional[str] = None
    is_default: bool = False


class EnvironmentUpdate(BaseModel):
    display_name: Optional[str] = None
    is_default: Optional[bool] = None


class EnvironmentResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    display_name: Optional[str] = None
    is_default: bool
    secrets_version: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EnvironmentListResponse(BaseModel):
    environments: list[EnvironmentResponse]
    total: int
