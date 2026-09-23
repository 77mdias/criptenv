from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime
from uuid import UUID


class UserSignup(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=1, max_length=255)
    accept_terms: bool = Field(
        ...,
        description="Must be true: explicit acceptance of the Terms of Use and Privacy Policy.",
    )

    @field_validator("accept_terms")
    @classmethod
    def accept_terms_must_be_true(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError(
                "You must accept the Terms of Use and the Privacy Policy to create an account"
            )
        return value


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
    terms_accepted_at: Optional[datetime] = None
    terms_version: Optional[str] = None
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
    last_accessed_at: Optional[datetime] = None
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


class TwoFactorRequiredResponse(BaseModel):
    requires_two_factor: bool = True
    expires_at: datetime


class MessageResponse(BaseModel):
    message: str


class ForgotPasswordResponse(BaseModel):
    message: str
    dev_token: Optional[str] = None
    dev_warning: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None


class TwoFactorSetupResponse(BaseModel):
    secret_uri: str
    backup_codes: list[str]


class TwoFactorVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


class TwoFactorDisableRequest(BaseModel):
    password: str = Field(..., min_length=1)


class TwoFactorChallengeVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=32)
    remember_device: bool = False


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=1)


class SendVerificationResponse(BaseModel):
    message: str
    dev_token: Optional[str] = None
    dev_warning: Optional[str] = None


class VerifyEmailResponse(BaseModel):
    message: str
    email_verified: bool
