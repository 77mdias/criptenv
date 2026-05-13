"""API Key Model for M3.4 Public API

Implements API key authentication with format cek_<prefix><random>,
SHA-256 hashing, scopes, and optional expiration.
"""

import secrets
import hashlib
import re
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from typing import Optional

from sqlalchemy import Column, String, DateTime, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.types import JSON
from sqlalchemy.orm import relationship

from app.database import Base


# Constants
API_KEY_PREFIX = "cek_"
API_KEY_PREFIX_LENGTH = len(API_KEY_PREFIX)

# Valid scopes as per M3.4 specification
VALID_API_KEY_SCOPES = frozenset([
    "read:secrets",
    "write:secrets",
    "delete:secrets",
    "read:audit",
    "write:integrations",
    "admin:project"
])


def generate_api_key() -> str:
    """Generate a new API key with cek_ prefix and random suffix.
    
    Format: cek_<prefix>_<random_32_chars>
    Example: cek_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
    """
    prefix_options = ["live", "test", "dev"]
    prefix = secrets.choice(prefix_options)
    random_part = secrets.token_urlsafe(24)[:32]
    return f"{API_KEY_PREFIX}{prefix}_{random_part}"


def extract_prefix(key: str) -> str:
    """Extract the displayable prefix from an API key.
    
    For key 'cek_live_abc123', returns 'cek_live_' (first 13 chars).
    """
    if not key or not key.startswith(API_KEY_PREFIX):
        return ""
    # Find the underscore after "live" or "test" or "dev"
    match = re.match(r'^(cek_(?:live|test|dev)_)', key)
    if match:
        return match.group(1)
    # Fallback: return first 13 chars (cek_live_ = 8, + random = 5)
    return key[:13] if len(key) >= 13 else key


def hash_api_key(key: str) -> str:
    """Hash an API key using SHA-256.
    
    The plaintext key is never stored, only its hash.
    """
    return hashlib.sha256(key.encode()).hexdigest()


class ScopeValidator:
    """Validates API key scopes per M3.4 specification.
    
    Uses GRASP Protected Variations pattern to isolate scope validation logic.
    """
    
    def __init__(self):
        self._valid_scopes = VALID_API_KEY_SCOPES
        self._scope_pattern = re.compile(r'^[a-z]+:[a-z]+$')
    
    def is_valid_scope(self, scope: str) -> bool:
        """Check if a scope string is valid."""
        if not scope or not isinstance(scope, str):
            return False
        return scope in self._valid_scopes
    
    def normalize_scopes(self, scopes: Optional[list[str]]) -> list[str]:
        """Normalize scopes to a list, defaulting to read:secrets."""
        if not scopes:
            return ["read:secrets"]
        return list(scopes)
    
    def has_scope(self, token_scopes: Optional[list[str]], required_scope: str) -> bool:
        """Check if token has the required scope or admin:project."""
        if not token_scopes:
            return False
        # admin:project grants all access
        if "admin:project" in token_scopes:
            return True
        return required_scope in token_scopes


class APIKey(Base):
    """API Key model for public API authentication.
    
    Format: cek_<prefix><random> (e.g., cek_live_abc123)
    Storage: SHA-256 hash, prefix stored for identification
    """
    
    __tablename__ = "api_keys"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)
    
    name = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    
    prefix = Column(String(20), nullable=False)  # "cek_live_" for display
    key_hash = Column(String(255), nullable=False, unique=True)
    
    scopes = Column(JSON, default=["read:secrets"])
    environment_scope = Column(String(255), nullable=True)  # null = all envs
    
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="api_keys", foreign_keys=[user_id])
    project = relationship("Project", back_populates="api_keys", foreign_keys=[project_id])
    
    __table_args__ = (
        Index('ix_api_keys_user_project', 'user_id', 'project_id'),
        Index('ix_api_keys_key_hash', 'key_hash', unique=True),
    )
    
    def is_valid(self) -> bool:
        """Check if the API key is valid (not revoked, not expired)."""
        if self.revoked_at is not None:
            return False
        if self.expires_at is not None and self.expires_at < datetime.now(timezone.utc):
            return False
        return True
    
    def is_expired(self) -> bool:
        """Check if the API key has expired."""
        if self.expires_at is None:
            return False
        return self.expires_at < datetime.now(timezone.utc)
    
    def is_revoked(self) -> bool:
        """Check if the API key has been revoked."""
        return self.revoked_at is not None