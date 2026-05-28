from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.auth_service import AuthService
from app.models.user import User
from app.models.api_key import APIKey
from app.models.api_key import API_KEY_PREFIX


@dataclass
class AuthContext:
    """Authenticated principal plus optional programmatic credential metadata."""

    user: User
    auth_type: str
    api_key: Optional[APIKey] = None


def _extract_token(request: Request) -> Optional[str]:
    """Extract Bearer token from Authorization header or cookie."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    return request.cookies.get("session_token")


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    auth_service = AuthService(db)
    user = await auth_service.validate_session(token)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email before accessing this resource.",
        )

    return user


async def get_current_user_or_api_key(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Authenticate via session token OR API key (cek_ prefix).
    
    This enables dual-auth for public API endpoints:
    - Session tokens (JWT) for web dashboard users
    - API keys (cek_ prefix) for programmatic access
    """
    context = await get_current_auth_context(request, db)
    return context.user


async def get_current_auth_context(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AuthContext:
    """Authenticate via session token or API key while preserving auth metadata."""
    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # API Key authentication
    if token.startswith(API_KEY_PREFIX):
        from app.middleware.api_key_auth import validate_api_key_context, APIKeyError
        try:
            api_context = await validate_api_key_context(token)
            return AuthContext(
                user=api_context.user,
                auth_type=api_context.auth_type,
                api_key=api_context.api_key,
            )
        except APIKeyError:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    # Session authentication
    auth_service = AuthService(db)
    user = await auth_service.validate_session(token)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return AuthContext(user=user, auth_type="session")


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    try:
        return await get_current_user(request, db)
    except HTTPException:
        return None
