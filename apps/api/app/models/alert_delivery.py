from uuid import uuid4

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class AlertDelivery(Base):
    __tablename__ = "alert_deliveries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    expiration_id = Column(UUID(as_uuid=True), ForeignKey("secret_expirations.id", ondelete="CASCADE"), nullable=False)
    event = Column(String(50), nullable=False)
    channel = Column(String(20), nullable=False)
    recipient_key = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="pending", server_default="pending")
    attempts = Column(Integer, nullable=False, default=0, server_default="0")
    retry_after = Column(DateTime(timezone=True), nullable=True)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    claim_token = Column(String(128), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    project = relationship("Project")
    expiration = relationship("SecretExpiration")

    __table_args__ = (
        UniqueConstraint(
            "expiration_id",
            "event",
            "channel",
            "recipient_key",
            name="uq_alert_deliveries_identity",
        ),
        CheckConstraint(
            "status IN ('pending', 'processing', 'delivered', 'failed')",
            name="ck_alert_deliveries_status",
        ),
        CheckConstraint("attempts >= 0", name="ck_alert_deliveries_attempts_nonnegative"),
        Index("ix_alert_deliveries_claimable", "status", "retry_after", "locked_until"),
    )

    @property
    def idempotency_key(self) -> str:
        """Stable external-delivery key; never contains the target credential or URL."""
        return str(self.id)
