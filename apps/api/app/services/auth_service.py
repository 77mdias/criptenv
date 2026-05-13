from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID, uuid4
import base64
import inspect
import os
import secrets

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
import bcrypt

from app.models.member import ProjectInvite
from app.models.user import User, Session, PasswordResetToken, EmailVerificationToken
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

    async def get_invite_by_token(self, token: str) -> Optional[ProjectInvite]:
        """Lookup a pending invite by its token."""
        result = await self.db.execute(
            select(ProjectInvite).where(
                ProjectInvite.token == token,
                ProjectInvite.accepted_at.is_(None),
                ProjectInvite.revoked_at.is_(None),
                ProjectInvite.expires_at > datetime.now(timezone.utc)
            )
        )
        return result.scalar_one_or_none()

    async def accept_invite_by_token(self, token: str, user: User) -> Optional[ProjectInvite]:
        """Accept an invite using its token."""
        from app.strategies.invite_transitions import AcceptInviteStrategy
        from app.strategies.exceptions import DomainError

        invite = await self.get_invite_by_token(token)
        if not invite:
            return None

        try:
            invite = await AcceptInviteStrategy().execute(
                db=self.db,
                invite=invite,
                project_id=invite.project_id,
                current_user=user
            )
        except DomainError:
            return None

        return invite

    async def get_user_sessions(self, user_id: UUID) -> list[Session]:
        result = await self.db.execute(
            select(Session)
            .where(Session.user_id == user_id)
            .where(Session.expires_at > datetime.now(timezone.utc))
            .order_by(Session.created_at.desc())
        )
        return list(result.scalars().all())

    # ─── Password Reset ──────────────────────────────────────────────────────

    async def create_password_reset(self, email: str) -> Optional[PasswordResetToken]:
        """Create a password reset token for the given email."""
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            return None

        # Invalidate any existing unused tokens for this user
        await self.db.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.user_id == user.id)
            .where(PasswordResetToken.used_at.is_(None))
            .where(PasswordResetToken.expires_at > datetime.now(timezone.utc))
            .values(used_at=datetime.now(timezone.utc))
        )

        token = secrets.token_urlsafe(48)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

        reset = PasswordResetToken(
            id=uuid4(),
            user_id=user.id,
            token=token,
            expires_at=expires_at,
        )
        self.db.add(reset)
        await self.db.flush()
        return reset

    async def validate_reset_token(self, token: str) -> Optional[User]:
        """Validate a password reset token and return the associated user."""
        result = await self.db.execute(
            select(PasswordResetToken)
            .where(PasswordResetToken.token == token)
            .where(PasswordResetToken.expires_at > datetime.now(timezone.utc))
            .where(PasswordResetToken.used_at.is_(None))
        )
        reset = result.scalar_one_or_none()
        if not reset:
            return None

        user_result = await self.db.execute(
            select(User).where(User.id == reset.user_id)
        )
        return user_result.scalar_one_or_none()

    async def reset_password(self, token: str, new_password: str) -> bool:
        """Reset password using a valid token."""
        user = await self.validate_reset_token(token)
        if not user:
            return False

        # Update password
        user.password_hash = self.hash_password(new_password)
        await self.db.flush()

        # Mark token as used
        await self.db.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.token == token)
            .values(used_at=datetime.now(timezone.utc))
        )

        # Invalidate all user sessions for security
        await self.db.execute(
            delete(Session).where(Session.user_id == user.id)
        )
        await self.db.flush()
        return True

    async def change_password(self, user: User, current_password: str, new_password: str) -> bool:
        """Change password for an authenticated user."""
        if not self.verify_password(current_password, user.password_hash):
            return False

        user.password_hash = self.hash_password(new_password)
        await self.db.flush()

        # Invalidate all other sessions (keep current if possible, but for simplicity invalidate all)
        await self.db.execute(
            delete(Session).where(Session.user_id == user.id)
        )
        await self.db.flush()
        return True

    # ─── Profile Management ──────────────────────────────────────────────────

    async def update_profile(self, user: User, name: Optional[str] = None, email: Optional[str] = None) -> User:
        """Update user profile fields."""
        if name is not None:
            user.name = name
        if email is not None:
            # Check email uniqueness
            existing = await self.db.execute(
                select(User).where(User.email == email).where(User.id != user.id)
            )
            if existing.scalar_one_or_none():
                raise ValueError("Email already in use")
            user.email = email
            user.email_verified = False

        await self.db.flush()
        return user

    async def delete_account(self, user: User) -> bool:
        """Permanently delete user account and all associated data."""
        # Delete all sessions
        await self.db.execute(delete(Session).where(Session.user_id == user.id))
        # Delete all password reset tokens
        await self.db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
        # Delete all email verification tokens
        await self.db.execute(delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id))
        # The user model has cascade deletes for OAuth accounts and memberships
        # Projects where user is owner: we delete them (cascade from User.projects)
        await self.db.delete(user)
        await self.db.flush()
        return True

    # ─── Two-Factor Authentication ───────────────────────────────────────────

    async def setup_2fa(self, user: User) -> str:
        """Generate and store a new 2FA secret for the user. Returns the secret URI for QR code."""
        import pyotp

        secret = pyotp.random_base32()
        user.two_factor_secret = secret.encode("utf-8")
        await self.db.flush()

        # Build otpauth URI for QR code
        uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=user.email,
            issuer_name="CriptEnv"
        )
        return uri

    async def verify_and_enable_2fa(self, user: User, code: str) -> bool:
        """Verify a TOTP code and enable 2FA."""
        import pyotp

        if not user.two_factor_secret:
            return False

        secret = user.two_factor_secret.decode("utf-8")
        totp = pyotp.TOTP(secret)
        if not totp.verify(code, valid_window=1):
            return False

        user.two_factor_enabled = True
        await self.db.flush()
        return True

    async def disable_2fa(self, user: User, password: str) -> bool:
        """Disable 2FA after verifying the user's password."""
        if not self.verify_password(password, user.password_hash):
            return False

        user.two_factor_enabled = False
        user.two_factor_secret = None
        await self.db.flush()
        return True

    # ─── Email Verification ──────────────────────────────────────────────────

    async def create_email_verification(self, email: str) -> Optional[EmailVerificationToken]:
        """Create an email verification token for the given email."""
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            return None

        # If already verified, no need to create token
        if user.email_verified:
            return None

        # Invalidate any existing unused tokens for this user
        await self.db.execute(
            update(EmailVerificationToken)
            .where(EmailVerificationToken.user_id == user.id)
            .where(EmailVerificationToken.used_at.is_(None))
            .where(EmailVerificationToken.expires_at > datetime.now(timezone.utc))
            .values(used_at=datetime.now(timezone.utc))
        )

        token = secrets.token_urlsafe(48)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

        verification = EmailVerificationToken(
            id=uuid4(),
            user_id=user.id,
            token=token,
            expires_at=expires_at,
        )
        self.db.add(verification)
        await self.db.flush()
        return verification

    async def verify_email(self, token: str) -> Optional[User]:
        """Verify an email using a valid token and return the associated user."""
        result = await self.db.execute(
            select(EmailVerificationToken)
            .where(EmailVerificationToken.token == token)
            .where(EmailVerificationToken.expires_at > datetime.now(timezone.utc))
            .where(EmailVerificationToken.used_at.is_(None))
        )
        verification = result.scalar_one_or_none()
        if not verification:
            return None

        # Mark token as used
        verification.used_at = datetime.now(timezone.utc)

        # Mark user as verified
        user_result = await self.db.execute(
            select(User).where(User.id == verification.user_id)
        )
        user = user_result.scalar_one_or_none()
        if user:
            user.email_verified = True
            await self.db.flush()
        return user
