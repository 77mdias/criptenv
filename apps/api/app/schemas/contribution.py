"""Contribution Schemas for Mercado Pago Pix payments.

Pydantic schemas for creating, reading, and updating contributions.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class ContributionPixCreate(BaseModel):
    """Schema for creating a new Pix contribution."""
    
    amount: Decimal = Field(
        ...,
        ge=5.00,
        le=100000.00,
        decimal_places=2,
        description="Contribution amount in BRL (minimum R$5.00, maximum R$100,000.00)"
    )
    payer_name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255,
        description="Optional payer name"
    )
    payer_email: Optional[str] = Field(
        None,
        max_length=255,
        description="Optional payer email"
    )
    
    @field_validator('amount')
    @classmethod
    def validate_amount_positive(cls, v: Decimal) -> Decimal:
        """Ensure amount is positive and has at most 2 decimal places."""
        if v <= 0:
            raise ValueError("Amount must be greater than zero")
        
        # Ensure only 2 decimal places
        quantized = v.quantize(Decimal("0.01"))
        if v != quantized:
            raise ValueError("Amount must have at most 2 decimal places")
        
        return quantized
    
    @field_validator('payer_email')
    @classmethod
    def validate_email_if_provided(cls, v: Optional[str]) -> Optional[str]:
        """Basic email validation if provided."""
        if v is not None:
            v = v.strip()
            if v == "":
                return None
            if "@" not in v or "." not in v.split("@")[-1]:
                raise ValueError("Invalid email format")
        return v

    @field_validator('payer_name', mode='before')
    @classmethod
    def normalize_name_if_provided(cls, v: Optional[str]) -> Optional[str]:
        """Treat blank optional payer names as omitted."""
        if isinstance(v, str):
            stripped = v.strip()
            return stripped or None
        return v

    @field_validator('payer_email', mode='before')
    @classmethod
    def normalize_email_if_provided(cls, v: Optional[str]) -> Optional[str]:
        """Treat blank optional payer emails as omitted."""
        if isinstance(v, str):
            stripped = v.strip()
            return stripped or None
        return v


class ContributionPixResponse(BaseModel):
    """Schema for Pix contribution creation response."""
    
    contribution_id: UUID
    status: str
    amount: Decimal
    pix_copy_paste: str
    pix_qr_code_base64: str
    expires_at: Optional[datetime] = None
    
    model_config = {"from_attributes": True}


class ContributionStatusResponse(BaseModel):
    """Schema for contribution status check response."""
    
    contribution_id: UUID
    status: str
    amount: Decimal
    provider_payment_id: Optional[str] = None
    paid_at: Optional[datetime] = None
    refunded_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    
    model_config = {"from_attributes": True}


class WebhookResponse(BaseModel):
    """Schema for webhook acknowledgment response."""
    
    received: bool = True


class MercadoPagoWebhookPayload(BaseModel):
    """Schema for Mercado Pago webhook notification body.
    
    Mercado Pago sends various notification formats depending on the topic.
    This schema is permissive to accept the common fields.
    """
    
    id: Optional[int] = None
    live_mode: Optional[bool] = None
    type: Optional[str] = None
    action: Optional[str] = None
    api_version: Optional[str] = None
    date_created: Optional[str] = None
    user_id: Optional[int] = None
    data: Optional[dict] = None
