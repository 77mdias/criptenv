"""Secret Expiration Schemas for M3.5 Secret Alerts

Pydantic schemas for secret expiration, rotation, and notification management.
"""

from datetime import datetime
from typing import Optional, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ExpirationCreate(BaseModel):
    """Schema for creating a secret expiration record."""
    
    secret_key: str = Field(..., description="The secret key identifier", min_length=1, max_length=255)
    expires_at: datetime = Field(..., description="Expiration date and time")
    rotation_policy: Literal["manual", "notify", "auto"] = Field(
        default="notify",
        description="Rotation policy: manual (user triggers), notify (alert before expiration), auto (rotate on expiration)"
    )
    notify_days_before: int = Field(
        default=7,
        ge=1,
        le=365,
        description="Days before expiration to send notification"
    )
    
    @field_validator('expires_at')
    @classmethod
    def validate_expires_at(cls, v: datetime) -> datetime:
        """Ensure expires_at is in the future."""
        from datetime import timezone
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v


class ExpirationUpdate(BaseModel):
    """Schema for updating a secret expiration record."""
    
    expires_at: Optional[datetime] = Field(None, description="New expiration date")
    rotation_policy: Optional[Literal["manual", "notify", "auto"]] = Field(None, description="New rotation policy")
    notify_days_before: Optional[int] = Field(None, ge=1, le=365, description="New notify days")


class ExpirationResponse(BaseModel):
    """Schema for secret expiration response."""
    
    id: UUID
    secret_key: str
    expires_at: datetime
    rotation_policy: str
    notify_days_before: int
    last_notified_at: Optional[datetime] = None
    rotated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    project_id: UUID
    environment_id: UUID
    
    # Computed fields (optional - can be computed from expires_at)
    is_expired: Optional[bool] = Field(None, description="Whether the secret has expired")
    days_until_expiration: Optional[int] = Field(None, description="Days until expiration")
    
    class Config:
        from_attributes = True


class ExpirationListResponse(BaseModel):
    """Schema for listing expirations with pagination."""
    
    items: list[ExpirationResponse]
    total: int
    page: int = 1
    page_size: int = 50


class RotationRequest(BaseModel):
    """Schema for rotating a secret."""
    
    new_value: str = Field(..., description="New encrypted secret value")
    iv: str = Field(..., description="Initialization vector (base64)")
    auth_tag: str = Field(..., description="Authentication tag (base64)")
    reason: Optional[str] = Field(None, max_length=500, description="Reason for rotation")


class RotationResponse(BaseModel):
    """Schema for rotation operation response."""
    
    rotation_id: UUID
    secret_key: str = Field(..., description="The secret key that was rotated")
    rotated_at: datetime
    new_version: int
    previous_version: Optional[int] = Field(None, description="Previous version before rotation")


class RotationStatus(BaseModel):
    """Schema for rotation status of a secret."""
    
    secret_key: str
    current_version: int
    expires_at: Optional[datetime] = None
    rotation_policy: str
    rotated_at: Optional[datetime] = None
    last_notified_at: Optional[datetime] = None
    is_expired: bool = False
    days_until_expiration: Optional[int] = None
    needs_rotation: bool = False


class RotationHistoryItem(BaseModel):
    """Schema for a single rotation history entry."""
    
    id: UUID
    secret_key: str
    previous_version: Optional[int]
    new_version: int
    rotated_by: Optional[UUID]
    rotated_at: datetime
    reason: Optional[str]
    
    class Config:
        from_attributes = True


class RotationHistoryResponse(BaseModel):
    """Schema for rotation history list."""
    
    items: list[RotationHistoryItem]
    total: int


class ExpirationAlert(BaseModel):
    """Schema for expiration alert notification payload."""
    
    event: Literal["secret.expiring", "secret.expired", "secret.rotated"] = Field(..., description="Event type")
    project_id: UUID
    environment: str
    secret_key: str
    expires_at: datetime
    notify_days_before: int
    days_until_expiration: Optional[int] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_schema_extra = {
            "example": {
                "event": "secret.expiring",
                "project_id": "550e8400-e29b-41d4-a716-446655440000",
                "environment": "production",
                "secret_key": "DATABASE_PASSWORD",
                "expires_at": "2024-06-01T00:00:00Z",
                "notify_days_before": 7,
                "days_until_expiration": 5,
                "timestamp": "2024-05-25T12:00:00Z"
            }
        }