from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class UserSignup(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=1, max_length=255)


class UserSignin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str
    kdf_salt: str
    avatar_url: Optional[str] = None
    email_verified: bool
    two_factor_enabled: bool
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    expires_at: datetime
    created_at: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    class Config:
        from_attributes = True

    @classmethod
    def model_validate(cls, obj, **kwargs):
        if hasattr(obj, "ip_address") and obj.ip_address is not None:
            obj.ip_address = str(obj.ip_address)
        return super().model_validate(obj, **kwargs)


class AuthResponse(BaseModel):
    user: UserResponse
    session: SessionResponse


class MessageResponse(BaseModel):
    message: str
