from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime
from uuid import UUID


class EnvironmentCreate(BaseModel):
    # kebab-case; '/' separates levels by convention for children (dev/wt-feature-x).
    name: str = Field(..., min_length=1, max_length=255, pattern=r'^[a-z0-9-]+(/[a-z0-9-]+)*$')
    display_name: Optional[str] = None
    is_default: bool = False
    # Only the project's owner and admins reach it. Not for production, staging, development or the default.
    restricted: bool = False
    # Inherit from this environment (same project): the new one stores only its overrides. Fixed once created.
    parent_id: Optional[UUID] = None
    # Ephemeral child: deleted this many seconds after creation (never past its ancestors' expiry).
    ttl_seconds: Optional[int] = Field(default=None, ge=1)


class EnvironmentUpdate(BaseModel):
    display_name: Optional[str] = None
    is_default: Optional[bool] = None
    restricted: Optional[bool] = None


class EnvironmentResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    display_name: Optional[str] = None
    is_default: bool
    restricted: bool = False
    secrets_version: int
    parent_id: Optional[UUID] = None
    expires_at: Optional[datetime] = None
    unset_keys: list[str] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EnvironmentListResponse(BaseModel):
    environments: list[EnvironmentResponse]
    total: int
    # Set when the caller is an environment-restricted API key, so clients can explain empty/filtered lists.
    api_key_environment_scope: Optional[str] = None


class EnvironmentDiffKey(BaseModel):
    key: str
    # override: the child sets a key the parent has; added: only the child has it;
    # unset: the child hides an inherited key; inherited: comes from the parent untouched.
    status: Literal["override", "added", "unset", "inherited"]
    # Environment the child's value comes from (None for an unset key with nothing left to hide).
    source: Optional[str] = None
    # Environment the parent's value comes from, when the parent resolves the key.
    parent_source: Optional[str] = None


class EnvironmentDiffResponse(BaseModel):
    environment: str
    parent: str
    keys: list[EnvironmentDiffKey]
