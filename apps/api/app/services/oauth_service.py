from datetime import datetime, timedelta, timezone
from typing import Optional, Protocol, TypedDict
from uuid import UUID, uuid4
import base64
import secrets
import httpx
from urllib.parse import urlsplit, urlunsplit

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, Session
from app.models.oauth_account import OAuthAccount
from app.config import settings
import os
import base64


class OAuthUserInfo(TypedDict):
    id: str
    email: str
    name: Optional[str]
    avatar_url: Optional[str]


class OAuthProvider(Protocol):
    async def get_authorization_url(self, state: str) -> str: ...
    async def exchange_code(self, code: str) -> dict: ...
    async def get_user_info(self, access_token: str) -> OAuthUserInfo: ...


class GitHubOAuthProvider:
    """GitHub OAuth 2.0 provider."""
    
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.authorize_url = "https://github.com/login/oauth/authorize"
        self.token_url = "https://github.com/login/oauth/access_token"
        self.user_url = "https://api.github.com/user"
        self.emails_url = "https://api.github.com/user/emails"
    
    async def get_authorization_url(self, state: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": "read:user user:email",
            "state": state,
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{self.authorize_url}?{query}"
    
    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
            response = await client.post(
                self.token_url,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                },
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            return response.json()
    
    async def get_user_info(self, access_token: str) -> OAuthUserInfo:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
            headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
            
            # Get user info
            user_response = await client.get(self.user_url, headers=headers)
            user_response.raise_for_status()
            user_data = user_response.json()
            
            # Get primary email
            email = None
            try:
                emails_response = await client.get(self.emails_url, headers=headers)
                emails_response.raise_for_status()
                emails = emails_response.json()
                for e in emails:
                    if e.get("primary") and e.get("verified"):
                        email = e.get("email")
                        break
            except Exception:
                pass
            
            # Fallback to login email if no verified email found
            if not email:
                email = user_data.get("login", "") + "@github.noreply.users.github.com"
            
            return OAuthUserInfo(
                id=str(user_data["id"]),
                email=email,
                name=user_data.get("name") or user_data.get("login"),
                avatar_url=user_data.get("avatar_url"),
            )


class GoogleOAuthProvider:
    """Google OAuth 2.0 provider."""
    
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.authorize_url = "https://accounts.google.com/o/oauth2/v2/auth"
        self.token_url = "https://oauth2.googleapis.com/token"
        self.user_url = "https://openidconnect.googleapis.com/v1/userinfo"
    
    async def get_authorization_url(self, state: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "state": state,
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{self.authorize_url}?{query}"
    
    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": self.redirect_uri,
                },
            )
            response.raise_for_status()
            return response.json()
    
    async def get_user_info(self, access_token: str) -> OAuthUserInfo:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {access_token}"}
            response = await client.get(self.user_url, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            return OAuthUserInfo(
                id=data["sub"],
                email=data["email"],
                name=data.get("name"),
                avatar_url=data.get("picture"),
            )


class DiscordOAuthProvider:
    """Discord OAuth 2.0 provider."""
    
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.authorize_url = "https://discord.com/api/oauth2/authorize"
        self.token_url = "https://discord.com/api/oauth2/token"
        self.user_url = "https://discord.com/api/users/@me"
    
    async def get_authorization_url(self, state: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": "identify email",
            "state": state,
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{self.authorize_url}?{query}"
    
    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": self.redirect_uri,
                },
            )
            response.raise_for_status()
            return response.json()
    
    async def get_user_info(self, access_token: str) -> OAuthUserInfo:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {access_token}"}
            response = await client.get(self.user_url, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            # Discord doesn't provide email by default, must request email scope
            email = data.get("email", f"{data['id']}@discord.noreply.local")
            
            return OAuthUserInfo(
                id=data["id"],
                email=email,
                name=data.get("global_name") or data.get("username"),
                avatar_url=f"https://cdn.discordapp.com/avatars/{data['id']}/{data.get('avatar', '')}.png" if data.get("avatar") else None,
            )


class OAuthService:
    """Service for handling OAuth authentication."""
    
    PROVIDERS = {
        "github": GitHubOAuthProvider,
        "google": GoogleOAuthProvider,
        "discord": DiscordOAuthProvider,
    }
    
    @staticmethod
    def generate_kdf_salt() -> str:
        """Generate a random salt for KDF."""
        return base64.b64encode(os.urandom(32)).decode("ascii")
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self._providers: dict[str, OAuthProvider] = {}

    @staticmethod
    def normalize_base_url(base_url: Optional[str]) -> str:
        normalized = (base_url or settings.API_URL).strip()
        if not normalized:
            normalized = settings.API_URL

        parsed = urlsplit(normalized)
        if not parsed.scheme or not parsed.netloc:
            return settings.API_URL.rstrip("/")

        return urlunsplit((parsed.scheme, parsed.netloc, "", "", "")).rstrip("/")

    def _get_provider_config(self, provider: str, base_url: Optional[str] = None) -> tuple[str, str, str]:
        """Get provider configuration from settings."""
        normalized_base_url = self.normalize_base_url(base_url)
        if provider == "github":
            return (
                settings.GITHUB_CLIENT_ID,
                settings.GITHUB_CLIENT_SECRET,
                f"{normalized_base_url}/api/auth/oauth/github/callback",
            )
        elif provider == "google":
            return (
                settings.GOOGLE_CLIENT_ID,
                settings.GOOGLE_CLIENT_SECRET,
                f"{normalized_base_url}/api/auth/oauth/google/callback",
            )
        elif provider == "discord":
            return (
                settings.DISCORD_CLIENT_ID,
                settings.DISCORD_CLIENT_SECRET,
                f"{normalized_base_url}/api/auth/oauth/discord/callback",
            )
        else:
            raise ValueError(f"Unknown OAuth provider: {provider}")

    def get_provider(self, provider: str, base_url: Optional[str] = None) -> OAuthProvider:
        """Get or create OAuth provider instance."""
        client_id, client_secret, redirect_uri = self._get_provider_config(provider, base_url)
        cache_key = f"{provider}:{redirect_uri}"

        if cache_key not in self._providers:
            provider_class = self.PROVIDERS.get(provider)
            if not provider_class:
                raise ValueError(f"Unknown OAuth provider: {provider}")
            self._providers[cache_key] = provider_class(client_id, client_secret, redirect_uri)
        return self._providers[cache_key]
    
    @staticmethod
    def generate_state() -> str:
        """Generate a random state string for CSRF protection."""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def encode_state(provider: str, state: str) -> str:
        """Encode state with provider for storage."""
        combined = f"{provider}:{state}"
        return base64.urlsafe_b64encode(combined.encode()).decode()
    
    @staticmethod
    def decode_state(encoded: str) -> tuple[str, str]:
        """Decode state to get provider and original state."""
        combined = base64.urlsafe_b64decode(encoded.encode()).decode()
        provider, state = combined.split(":", 1)
        return provider, state
    
    async def get_authorization_url(self, provider: str, base_url: Optional[str] = None) -> str:
        """Get authorization URL for the given provider."""
        if provider not in self.PROVIDERS:
            raise ValueError(f"Unknown OAuth provider: {provider}")
        
        state = self.generate_state()
        oauth_provider = self.get_provider(provider, base_url)
        return await oauth_provider.get_authorization_url(state), state
    
    async def authenticate_with_oauth(
        self,
        provider: str,
        code: str,
        base_url: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> tuple[User, Session]:
        """
        Authenticate or create user via OAuth.
        
        Returns (user, session) tuple.
        """
        oauth_provider = self.get_provider(provider, base_url)
        
        # Exchange code for tokens
        token_data = await oauth_provider.exchange_code(code)
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in")
        
        # Get user info from provider
        user_info = await oauth_provider.get_user_info(access_token)
        
        # Check if OAuth account already exists
        result = await self.db.execute(
            select(OAuthAccount).where(
                OAuthAccount.provider == provider,
                OAuthAccount.provider_user_id == user_info["id"],
            )
        )
        oauth_account = result.scalar_one_or_none()
        
        if oauth_account:
            # Existing user - update tokens and fetch fresh user
            user_id = oauth_account.user_id
            oauth_account.access_token = access_token.encode() if access_token else None
            oauth_account.refresh_token = refresh_token.encode() if refresh_token else None
            if expires_in:
                oauth_account.expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            
            result = await self.db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if not user:
                raise ValueError("User associated with OAuth account not found")
        else:
            # Check if user with this email already exists
            result = await self.db.execute(
                select(User).where(User.email == user_info["email"])
            )
            existing_user = result.scalar_one_or_none()
            
            if existing_user:
                # Link OAuth account to existing user
                user = existing_user
            else:
                # Create new user
                user = User(
                    id=uuid4(),
                    email=user_info["email"],
                    name=user_info["name"] or user_info["email"].split("@")[0],
                    password_hash="",  # OAuth users have no password
                    kdf_salt=self.generate_kdf_salt(),  # Required for OAuth users
                    avatar_url=user_info.get("avatar_url"),
                    email_verified=True,  # OAuth emails are verified by provider
                )
                self.db.add(user)
                await self.db.flush()
            
            # Create OAuth account link
            oauth_account = OAuthAccount(
                id=uuid4(),
                user_id=user.id,
                provider=provider,
                provider_user_id=user_info["id"],
                provider_email=user_info["email"],
                access_token=access_token.encode() if access_token else None,
                refresh_token=refresh_token.encode() if refresh_token else None,
                expires_at=datetime.now(timezone.utc) + timedelta(seconds=expires_in) if expires_in else None,
            )
            self.db.add(oauth_account)
        
        await self.db.flush()
        
        # Update last login
        user.last_login_at = datetime.now(timezone.utc)
        
        # Create session
        session = Session(
            id=uuid4(),
            user_id=user.id,
            token=secrets.token_urlsafe(64),
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.SESSION_EXPIRE_DAYS),
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.db.add(session)
        await self.db.flush()
        
        # Refresh user to ensure all attributes are loaded before returning
        await self.db.refresh(user)
        
        return user, session
    
    async def get_user_oauth_accounts(self, user_id: UUID) -> list[OAuthAccount]:
        """Get all OAuth accounts linked to a user."""
        result = await self.db.execute(
            select(OAuthAccount).where(OAuthAccount.user_id == user_id)
        )
        return list(result.scalars().all())
    
    async def unlink_oauth_account(self, user_id: UUID, provider: str) -> bool:
        """Unlink an OAuth account from a user."""
        result = await self.db.execute(
            select(OAuthAccount).where(
                OAuthAccount.user_id == user_id,
                OAuthAccount.provider == provider,
            )
        )
        oauth_account = result.scalar_one_or_none()
        if oauth_account:
            await self.db.delete(oauth_account)
            await self.db.flush()
            return True
        return False
