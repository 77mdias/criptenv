from sqlalchemy import Column, String, Boolean, DateTime, LargeBinary, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, CITEXT
from sqlalchemy.orm import relationship
from app.database import Base
import uuid


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(CITEXT, unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    avatar_url = Column(String(512))
    kdf_salt = Column(String(255))
    wrapped_dek = Column(LargeBinary)
    two_factor_secret = Column(LargeBinary)
    two_factor_enabled = Column(Boolean, default=False)
    email_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True))

    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan", foreign_keys="Session.user_id")
    projects = relationship("Project", back_populates="owner", foreign_keys="Project.owner_id")
    memberships = relationship("ProjectMember", back_populates="user", foreign_keys="ProjectMember.user_id", primaryjoin="User.id == ProjectMember.user_id")
    api_keys = relationship("APIKey", back_populates="user", foreign_keys="APIKey.user_id")
    oauth_accounts = relationship("OAuthAccount", back_populates="user", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String(512), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    ip_address = Column(String(45))
    user_agent = Column(String(512))

    user = relationship("User", back_populates="sessions", foreign_keys=[user_id])
