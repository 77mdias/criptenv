from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import uuid


class VaultBlob(Base):
    __tablename__ = "vault_blobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)
    environment_id = Column(UUID(as_uuid=True), ForeignKey("environments.id"), nullable=False, index=True)
    key_id = Column(String(255), nullable=False)
    iv = Column(String, nullable=False)
    ciphertext = Column(String, nullable=False)
    auth_tag = Column(String, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    checksum = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="vault_blobs")
    environment = relationship("Environment", back_populates="vault_blobs")
