from sqlalchemy import Column, String, DateTime, ForeignKey, LargeBinary, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import uuid


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(50), nullable=False, index=True)  # 'github', 'google', 'discord'
    provider_user_id = Column(String(255), nullable=False)
    provider_email = Column(String(255))
    access_token = Column(LargeBinary)
    refresh_token = Column(LargeBinary)
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Unique constraints
    __table_args__ = (
        # Each provider can only have one account per provider_user_id
        {"schema": None},
    )

    # Relationship
    user = relationship("User", back_populates="oauth_accounts", foreign_keys=[user_id])

    def __repr__(self):
        return f"<OAuthAccount(id={self.id}, provider={self.provider}, user_id={self.user_id})>"
