"""Secret Expiration Model for M3.5 Secret Alerts

Implements secret expiration tracking, rotation policies, and notification scheduling.
"""

from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class SecretExpiration(Base):
    """Track secret expiration and rotation policies.
    
    GRASP Information Expert: Contains all expiration-related data
    GRASP Protected Variations: Rotation policy encapsulates behavior changes
    
    Table: secret_expirations
    Unique constraint: (project_id, environment_id, secret_key)
    Indexes: expires_at for efficient queries
    """
    
    __tablename__ = "secret_expirations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)
    environment_id = Column(UUID(as_uuid=True), ForeignKey("environments.id"), nullable=False, index=True)
    secret_key = Column(String(255), nullable=False)  # key_id from vault_blobs
    
    expires_at = Column(DateTime(timezone=True), nullable=False)
    rotation_policy = Column(String(20), default="notify")  # manual, notify, auto
    notify_days_before = Column(Integer, default=7)
    
    last_notified_at = Column(DateTime(timezone=True), nullable=True)
    rotated_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # GRASP Protected Variations: Unique constraint encapsulates uniqueness rules
    __table_args__ = (
        Index('ix_secret_expirations_project_env_key', 'project_id', 'environment_id', 'secret_key', unique=True),
        Index('ix_secret_expirations_expires_at', 'expires_at'),
    )
    
    # Relationships
    project = relationship("Project")
    environment = relationship("Environment")
    
    def __repr__(self) -> str:
        return f"<SecretExpiration(key={self.secret_key}, expires={self.expires_at})>"
    
    @property
    def is_expired(self) -> bool:
        """Check if the secret has expired."""
        return datetime.now(timezone.utc) > self.expires_at if self.expires_at else False
    
    @property
    def days_until_expiration(self) -> Optional[int]:
        """Calculate days until expiration."""
        if not self.expires_at:
            return None
        delta = self.expires_at - datetime.now(timezone.utc)
        return delta.days
    
    @property
    def should_notify(self) -> bool:
        """Check if notification should be sent based on notify_days_before."""
        if not self.expires_at or self.notify_days_before is None:
            return False
        
        days_until = self.days_until_expiration
        if days_until is None:
            return False
        
        return days_until <= self.notify_days_before
    
    @property
    def needs_rotation(self) -> bool:
        """Check if this secret needs rotation based on policy."""
        if self.rotated_at:
            return False
        
        if self.rotation_policy == "auto":
            return self.is_expired
        
        if self.rotation_policy == "notify":
            return self.should_notify
        
        # manual policy - only if expired
        return self.is_expired


class SecretRotation(Base):
    """Track secret rotation history.
    
    Stores rotation events for audit and rollback purposes.
    """
    
    __tablename__ = "secret_rotations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)
    environment_id = Column(UUID(as_uuid=True), ForeignKey("environments.id"), nullable=False, index=True)
    secret_key = Column(String(255), nullable=False)
    
    previous_version = Column(Integer, nullable=True)
    new_version = Column(Integer, nullable=False)
    
    rotated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    rotated_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Reason for rotation
    reason = Column(String(500), nullable=True)  # manual, expired, compromised, scheduled
    
    __table_args__ = (
        Index('ix_secret_rotations_project_env_key', 'project_id', 'environment_id', 'secret_key'),
    )
    
    project = relationship("Project")
    rotated_by_user = relationship("User")
    
    def __repr__(self) -> str:
        return f"<SecretRotation(key={self.secret_key}, v{self.previous_version}->v{self.new_version})>"