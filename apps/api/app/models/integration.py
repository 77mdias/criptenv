"""Integration Model

Stores external service integrations (Vercel, Railway, Render) for secret sync.
"""

from sqlalchemy import Column, String, DateTime, ForeignKey, func, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base
import uuid


class Integration(Base):
    """External service integration for secret synchronization.
    
    Attributes:
        id: Unique identifier
        project_id: Associated project
        provider: Provider name (vercel, railway, render)
        name: Human-readable name for the integration
        config: Provider-specific configuration (API tokens, project IDs)
        status: Integration status (active, disconnected, error)
        last_sync_at: Last successful sync timestamp
        last_error: Last error message
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """
    __tablename__ = "integrations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)
    provider = Column(String(50), nullable=False)  # vercel, railway, render
    name = Column(String(255), nullable=False)
    config = Column(JSONB, nullable=False)  # Provider-specific config
    status = Column(String(20), default="active")  # active, disconnected, error
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(String(1000), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="integrations")
    
    __table_args__ = (
        Index('ix_integrations_project_provider', 'project_id', 'provider'),
    )
    
    def __repr__(self):
        return f"<Integration {self.provider}:{self.name} ({self.status})>"