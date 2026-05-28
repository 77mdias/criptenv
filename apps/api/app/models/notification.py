from sqlalchemy import Column, String, DateTime, ForeignKey, func, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base
import uuid


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False, default="system")
    title = Column(String(255), nullable=False)
    message = Column(String(1000), nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    action_url = Column(String(512), nullable=True)
    meta = Column(JSONB, nullable=True, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        Index("idx_notifications_user_id_read_at", "user_id", "read_at"),
        Index("idx_notifications_user_id_created_at", "user_id", "created_at"),
    )
