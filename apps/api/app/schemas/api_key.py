"""API Key Schemas for M3.4 Public API

Pydantic schemas for API key creation, update, and response.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.api_key import VALID_API_KEY_SCOPES


class ApiKeyCreate(BaseModel):
    """Schema for creating a new API key."""
    
    name: str = Field(..., min_length=1, max_length=255, description="Name for the API key")
    description: Optional[str] = Field(None, max_length=500, description="Optional description")
    scopes: list[str] = Field(default=["read:secrets"], description="Permissions for this key")
    environment_scope: Optional[str] = Field(None, description="Limit to specific environment (null = all)")
    expires_in_days: Optional[int] = Field(None, ge=1, le=365, description="Expiration in days (optional)")
    
    @field_validator('scopes')
    @classmethod
    def validate_scopes(cls, v: list[str]) -> list[str]:
        """Validate that all scopes are valid."""
        if not v:
            raise ValueError("At least one scope is required")
        invalid_scopes = [s for s in v if s not in VALID_API_KEY_SCOPES]
        if invalid_scopes:
            raise ValueError(f"Invalid scopes: {invalid_scopes}. Valid: {list(VALID_API_KEY_SCOPES)}")
        return v


class ApiKeyUpdate(BaseModel):
    """Schema for updating an API key."""
    
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    scopes: Optional[list[str]] = None
    environment_scope: Optional[str] = None
    
    @field_validator('scopes')
    @classmethod
    def validate_scopes(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        """Validate that all scopes are valid."""
        if v is None:
            return v
        if not v:
            raise ValueError("At least one scope is required")
        invalid_scopes = [s for s in v if s not in VALID_API_KEY_SCOPES]
        if invalid_scopes:
            raise ValueError(f"Invalid scopes: {invalid_scopes}. Valid: {list(VALID_API_KEY_SCOPES)}")
        return v


class ApiKeyResponse(BaseModel):
    """Schema for API key response (without sensitive data)."""
    
    id: UUID
    name: str
    prefix: str  # e.g., "cek_live_" for identification
    scopes: list[str]
    environment_scope: Optional[str] = None
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    
    model_config = {"from_attributes": True}


class ApiKeyListResponse(BaseModel):
    """Schema for listing API keys."""
    
    items: list[ApiKeyResponse]
    total: int


class ApiKeyCreateResponse(BaseModel):
    """Schema for API key creation response (includes plaintext key ONCE)."""
    
    id: UUID
    name: str
    key: str  # Plaintext key - shown only once at creation!
    prefix: str
    scopes: list[str]
    environment_scope: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    
    model_config = {"from_attributes": True}


class ApiKeyRevokeResponse(BaseModel):
    """Schema for API key revocation response."""
    
    id: UUID
    name: str
    revoked_at: datetime
    message: str = "API key has been revoked successfully"
    
    model_config = {"from_attributes": True}