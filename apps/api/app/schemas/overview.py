from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel


class OverviewEnvironment(BaseModel):
    id: UUID
    name: str
    is_default: bool
    secret_count: int
    version: int
    updated_at: Optional[datetime] = None


class OverviewProject(BaseModel):
    id: UUID
    name: str
    slug: str
    role: str
    member_count: int
    last_activity_at: Optional[datetime] = None
    environments: list[OverviewEnvironment]


class AttentionExpiration(BaseModel):
    project_id: UUID
    environment_id: UUID
    environment_name: str
    secret_key: str
    expires_at: datetime


class AttentionInvite(BaseModel):
    project_id: UUID
    id: UUID
    email: str
    role: str
    expires_at: datetime


class AttentionCredential(BaseModel):
    project_id: UUID
    id: UUID
    kind: Literal["ci_token", "api_key"]
    name: str
    reason: Literal["no_expiry", "unused"]
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class AttentionIntegration(BaseModel):
    project_id: UUID
    id: UUID
    provider: str
    name: str
    last_error: Optional[str] = None


class OverviewAttention(BaseModel):
    expired: list[AttentionExpiration]
    expiring: list[AttentionExpiration]
    pending_invites: list[AttentionInvite]
    stale_credentials: list[AttentionCredential]
    failing_integrations: list[AttentionIntegration]


class OverviewTotals(BaseModel):
    projects: int
    secrets: int
    members: int


class OverviewResponse(BaseModel):
    projects: list[OverviewProject]
    attention: OverviewAttention
    totals: OverviewTotals


class MatrixEnvironment(BaseModel):
    id: UUID
    name: str
    is_default: bool


class MatrixCell(BaseModel):
    version: int
    updated_at: Optional[datetime] = None


class MatrixKey(BaseModel):
    key_id: str
    # environment id -> cell, or null when the key is missing in that environment
    cells: dict[str, Optional[MatrixCell]]


class SecretMatrixResponse(BaseModel):
    environments: list[MatrixEnvironment]
    keys: list[MatrixKey]


class ActivityDay(BaseModel):
    date: str
    changes: int
    other: int
