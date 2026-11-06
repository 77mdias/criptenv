"""Personal vault (cofre pessoal): per-user items outside projects.

Zero-knowledge: the server stores only wrapped keys and AES-GCM envelopes
({iv, ciphertext, auth_tag}); see docs/security/personal-vault.md.
"""
import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.database import Base


class PersonalVault(Base):
    __tablename__ = "personal_vaults"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    version = Column(Integer, nullable=False, default=1)
    kdf = Column(String(32), nullable=False)
    iterations = Column(Integer, nullable=False)
    master_salt = Column(String(64), nullable=False)
    extra_salt = Column(String(64), nullable=False)
    master_wrapped_vault_key = Column(JSONB, nullable=False)
    recovery_wrapped_vault_key = Column(JSONB, nullable=False)
    extra_wrapped_protected_key = Column(JSONB, nullable=False)
    recovery_wrapped_protected_key = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PersonalVaultItem(Base):
    __tablename__ = "personal_vault_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    protected = Column(Boolean, nullable=False, default=False)
    summary = Column(JSONB, nullable=False)
    body = Column(JSONB, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_personal_vault_items_user_id_updated_at", "user_id", "updated_at"),
    )
