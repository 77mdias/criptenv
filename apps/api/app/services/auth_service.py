from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID, uuid4
import base64
import inspect
import os
import secrets

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
import bcrypt

from app.models.user import User, Session
from app.config import settings


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _scalar_one_or_none(self, result):
        value = result.scalar_one_or_none()
        if inspect.isawaitable(value):
            value = await value
        return value

    def generate_kdf_salt(self) -> str:
        return base64.b64encode(os.urandom(32)).decode("ascii")

    async def ensure_kdf_salt(self, user: User) -> User:
        if not user.kdf_salt:
            user.kdf_salt = self.generate_kdf_salt()
            await self.db.flush()
        return user

    def hash_password(self, password: str) -> str:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

    def generate_session_token(self) -> str:
        return secrets.token_urlsafe(64)

    async def create_user(
        self,
        email: str,
        password: str,
        name: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> tuple[User, Session]:
        existing = await self.db.execute(
            select(User).where(User.email == email)
        )
        if existing.scalar_one_or_none():
            raise ValueError("Email already registered")

        user = User(
            id=uuid4(),
            email=email,
            name=name,
            password_hash=self.hash_password(password),
            kdf_salt=self.generate_kdf_salt(),
            email_verified=False,
            two_factor_enabled=False
        )
        self.db.add(user)
        await self.db.flush()

        session = await self.create_session(user.id, ip_address, user_agent)

        return user, session

    async def authenticate_user(
        self,
        email: str,
        password: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> tuple[User, Session]:
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()

        if not user or not self.verify_password(password, user.password_hash):
            raise ValueError("Invalid email or password")

        await self.ensure_kdf_salt(user)

        await self.db.execute(
            update(User)
            .where(User.id == user.id)
            .values(last_login_at=datetime.now(timezone.utc))
        )
        await self.db.flush()

        # Re-fetch to get updated last_login_at
        result2 = await self.db.execute(
            select(User).where(User.id == user.id)
        )
        user = result2.scalar_one()
        await self.ensure_kdf_salt(user)

        session = await self.create_session(user.id, ip_address, user_agent)

        return user, session

    async def create_session(
        self,
        user_id: UUID,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Session:
        token = self.generate_session_token()
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.SESSION_EXPIRE_DAYS)

        session = Session(
            id=uuid4(),
            user_id=user_id,
            token=token,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent
        )
        self.db.add(session)
        await self.db.flush()

        return session

    async def validate_session(self, token: str) -> Optional[User]:
        if len(token) < 32:
            return None

        result = await self.db.execute(
            select(Session).where(
                Session.token == token,
                Session.expires_at > datetime.now(timezone.utc)
            )
        )
        session = await self._scalar_one_or_none(result)

        if not session:
            return None

        user_result = await self.db.execute(
            select(User).where(User.id == session.user_id)
        )
        user = await self._scalar_one_or_none(user_result)
        if user:
            await self.ensure_kdf_salt(user)
        return user

    async def invalidate_session(self, token: str) -> bool:
        result = await self.db.execute(
            select(Session).where(Session.token == token)
        )
        session = result.scalar_one_or_none()

        if not session:
            return False

        await self.db.delete(session)
        return True

    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_user_sessions(self, user_id: UUID) -> list[Session]:
        result = await self.db.execute(
            select(Session)
            .where(Session.user_id == user_id)
            .where(Session.expires_at > datetime.now(timezone.utc))
            .order_by(Session.created_at.desc())
        )
        return list(result.scalars().all())
