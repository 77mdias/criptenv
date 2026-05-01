"""API Key Authentication Middleware for M3.4 Public API

Provides authentication for API consumers using API keys.
These keys are created by users and have limited scopes.
"""

from typing import Optional
from uuid import UUID
from datetime import datetime, timezone

from fastapi import HTTPException, Request, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db, async_session_factory
from app.models.api_key import APIKey, hash_api_key, API_KEY_PREFIX, ScopeValidator
from app.models.user import User


# Security scheme for OpenAPI docs
api_key_scheme = HTTPBearer(auto_error=False)


class APIKeyError(HTTPException):
    """Base class for API key errors."""
    pass


class InvalidApiKeyError(APIKeyError):
    """Raised when API key is invalid or not found."""
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "Bearer"}
        )


class ExpiredApiKeyError(APIKeyError):
    """Raised when API key has expired."""
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key has expired",
            headers={"WWW-Authenticate": "Bearer"}
        )


class RevokedApiKeyError(APIKeyError):
    """Raised when API key has been revoked."""
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key has been revoked",
            headers={"WWW-Authenticate": "Bearer"}
        )


def is_api_key_format(key: str) -> bool:
    """Check if a key has the API key format (cek_ prefix)."""
    if not key:
        return False
    return key.startswith(API_KEY_PREFIX)


def extract_api_key_from_auth(auth_header: Optional[str]) -> Optional[str]:
    """Extract API key from Authorization header.
    
    Returns None if:
    - No header
    - Not Bearer scheme
    - Not cek_ prefix (let CI auth handle ci_ tokens)
    """
    if not auth_header:
        return None
    
    if not auth_header.startswith("Bearer "):
        return None
    
    key = auth_header[7:]  # Remove "Bearer "
    
    # Only recognize cek_ prefixed keys as API keys
    if not is_api_key_format(key):
        return None
    
    return key


async def get_db_api_key(key: str, db: AsyncSession) -> Optional[APIKey]:
    """Look up API key by hash."""
    key_hash = hash_api_key(key)
    
    result = await db.execute(
        select(APIKey).where(APIKey.key_hash == key_hash)
    )
    
    return result.scalar_one_or_none()


async def validate_api_key(key: str) -> User:
    """Validate an API key and return the associated user.
    
    Raises:
        InvalidApiKeyError: Key not found or invalid
        ExpiredApiKeyError: Key has expired
        RevokedApiKeyError: Key has been revoked
    """
    async with async_session_factory() as db:
        api_key = await get_db_api_key(key, db)
        
        if not api_key:
            raise InvalidApiKeyError()
        
        # Check if revoked
        if api_key.is_revoked():
            raise RevokedApiKeyError()
        
        # Check if expired
        if api_key.is_expired():
            raise ExpiredApiKeyError()
        
        # Check if valid
        if not api_key.is_valid():
            raise InvalidApiKeyError()
        
        # Update last_used_at
        api_key.last_used_at = datetime.now(timezone.utc)
        await db.commit()
        
        return api_key.user


def check_api_key_scope(scopes: list[str], required_scope: str) -> bool:
    """Check if API key scopes include the required scope.
    
    Uses ScopeValidator for GRASP compliance.
    """
    validator = ScopeValidator()
    return validator.has_scope(scopes, required_scope)


def get_request_api_key_id(request: Request) -> Optional[str]:
    """Extract API key identifier for rate limiting.
    
    Returns the key prefix (e.g., "cek_live_") if API key present,
    or None if session/CI token auth is being used.
    """
    auth_header = request.headers.get("Authorization", "")
    
    if auth_header.startswith("Bearer cek_"):
        # Extract prefix for rate limiting
        # e.g., "Bearer cek_live_abc123xyz" -> "cek_live_"
        key = auth_header[7:]  # Remove "Bearer "
        return key[:13] if len(key) >= 13 else key
    
    return None


class APIKeyAuth:
    """API Key authentication dependency for FastAPI routes."""
    
    def __init__(self, required_scope: Optional[str] = None):
        self.required_scope = required_scope
    
    async def __call__(
        self,
        request: Request,
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(api_key_scheme),
        db: AsyncSession = Depends(get_db)
    ) -> User:
        """Authenticate via API key.
        
        Raises:
            HTTPException 401 if authentication fails
        """
        # Try to extract API key from header
        auth_header = request.headers.get("Authorization", "")
        api_key = extract_api_key_from_auth(auth_header)
        
        if not api_key:
            # Not an API key request - let other auth handle it
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key required",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Validate the API key
        user = await validate_api_key(api_key)
        
        # Check scope if required
        if self.required_scope:
            # Get the API key again to check scopes
            key_record = await get_db_api_key(api_key, db)
            if key_record:
                if not check_api_key_scope(key_record.scopes, self.required_scope):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Scope '{self.required_scope}' required"
                    )
        
        return user


# Pre-configured auth dependencies
api_key_auth = APIKeyAuth()  # Just requires valid API key
read_secrets_auth = APIKeyAuth(required_scope="read:secrets")
write_secrets_auth = APIKeyAuth(required_scope="write:secrets")
admin_auth = APIKeyAuth(required_scope="admin:project")