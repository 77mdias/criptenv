from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class MemberAdd(BaseModel):
    user_id: UUID
    role: str = Field(..., pattern=r'^(admin|developer|viewer)$')


class MemberUpdate(BaseModel):
    role: str = Field(..., pattern=r'^(admin|developer|viewer)$')


class MemberResponse(BaseModel):
    id: UUID
    project_id: UUID
    user_id: UUID
    role: str
    invited_by: Optional[UUID] = None
    created_at: datetime
    accepted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MemberListResponse(BaseModel):
    members: list[MemberResponse]
    total: int


class InviteCreate(BaseModel):
    email: EmailStr
    role: str = Field(..., pattern=r'^(admin|developer|viewer)$')


class InviteResponse(BaseModel):
    id: UUID
    project_id: UUID
    email: str
    role: str
    invited_by: Optional[UUID] = None
    token: str
    expires_at: datetime
    accepted_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class InviteListResponse(BaseModel):
    invites: list[InviteResponse]
    total: int


class CITokenCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    expires_at: Optional[datetime] = None
    scopes: list[str] = Field(default=["read:secrets"])
    environment_scope: Optional[str] = Field(
        None,
        pattern=r'^[a-z0-9-]+$',  # kebab-case env names only
        description="Restrict token to specific environment"
    )


class CITokenResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    description: Optional[str] = None
    scopes: list[str]
    environment_scope: Optional[str] = None
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CITokenWithPlaintext(BaseModel):
    token: str
    token_info: CITokenResponse


class CITokenListResponse(BaseModel):
    tokens: list[CITokenResponse]
    total: int
