"""Contribution/Payment Model for Mercado Pago Pix donations.

Tracks Pix contributions from creation through payment lifecycle.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, String, DateTime, Numeric, Index, func
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.database import Base


class ContributionStatus:
    """Contribution lifecycle statuses."""
    
    PENDING = "PENDING"
    PAID = "PAID"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"
    FAILED = "FAILED"
    DISPUTED = "DISPUTED"


class Contribution(Base):
    """Contribution model for Pix payments via Mercado Pago.
    
    Stores payment metadata, Pix codes, and full provider response
    for audit and reconciliation purposes.
    """
    
    __tablename__ = "contributions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Provider info
    provider = Column(String(50), nullable=False, default="mercadopago")
    provider_payment_id = Column(String(100), nullable=True)
    
    # Financial details
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="BRL")
    
    # Lifecycle status
    status = Column(String(20), nullable=False, default=ContributionStatus.PENDING)
    
    # Pix-specific data
    pix_copy_paste = Column(String(500), nullable=True)
    pix_qr_code_base64 = Column(String(20000), nullable=True)
    ticket_url = Column(String(500), nullable=True)
    
    # Timing
    expires_at = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    refunded_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    
    # Payer info (minimal, non-sensitive)
    payer_email = Column(String(255), nullable=True)
    payer_name = Column(String(255), nullable=True)
    
    # Provider response and metadata
    raw_provider_response = Column(JSONB, nullable=True)
    extra_metadata = Column(JSONB, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        Index('ix_contributions_status', 'status'),
        Index('ix_contributions_provider_payment_id', 'provider_payment_id'),
        Index('ix_contributions_created_at', 'created_at'),
    )
    
    def is_terminal_status(self) -> bool:
        """Check if the contribution has reached a terminal state."""
        return self.status in {
            ContributionStatus.PAID,
            ContributionStatus.EXPIRED,
            ContributionStatus.CANCELLED,
            ContributionStatus.REFUNDED,
            ContributionStatus.FAILED,
        }
    
    def can_transition_to(self, new_status: str) -> bool:
        """Check if a status transition is valid.
        
        Prevents reverting from terminal states and invalid transitions.
        """
        if self.status == new_status:
            return True
        
        # Terminal states cannot change (idempotency)
        if self.is_terminal_status():
            return False
        
        # PENDING can go to any state
        if self.status == ContributionStatus.PENDING:
            return True
        
        # DISPUTED can only go to PAID, FAILED, or REFUNDED
        if self.status == ContributionStatus.DISPUTED:
            return new_status in {
                ContributionStatus.PAID,
                ContributionStatus.FAILED,
                ContributionStatus.REFUNDED,
            }
        
        return True
