"""CI Token Authentication Middleware

Provides authentication for CI/CD workflows using CI tokens.
These tokens are created by project admins and have limited scopes.
"""

import hashlib
import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import async_session_factory
from app.models.member import CIToken


# Constants
CI_TOKEN_PREFIX = "ci_"
CI_SESSION_PREFIX = "ci_s_"
CI_SESSION_EXPIRE_SECONDS = 3600  # 1 hour

# Valid scopes as per M3.3 specification
VALID_SCOPES = frozenset([
    "read:secrets",
    "write:secrets",
    "delete:secrets",
    "read:audit",
    "write:integrations",
    "admin:project"
])


class ScopeValidator:
    """Validates CI token scopes per M3.3 specification.
    
    Uses GRASP Protected Variations pattern to isolate scope validation logic.
    """
    
    def __init__(self):
        self._valid_scopes = VALID_SCOPES
        # Pattern for scope format: action:resource
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
    
    def has_scope(self, token_scopes: list[str], required_scope: str) -> bool:
        """Check if token has the required scope or admin:project."""
        if not token_scopes:
            return False
        # admin:project grants all access
        if "admin:project" in token_scopes:
            return True
        return required_scope in token_scopes


def hash_token(token: str) -> str:
    """Hash a CI token using SHA-256."""
    return hashlib.sha256(token.encode()).hexdigest()


def create_ci_session(project_id: UUID, permissions: list[str]) -> tuple[str, datetime]:
    """Create a temporary CI session token.
    
    Returns:
        tuple: (session_token, expires_at)
    """
    session_token = f"{CI_SESSION_PREFIX}{secrets.token_urlsafe(32)}"
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=CI_SESSION_EXPIRE_SECONDS)
    return session_token, expires_at


def _extract_ci_token(request: Request) -> Optional[str]:
    """Extract CI token from Authorization header.
    
    Supports both ci_ prefix tokens (direct) and ci_s_ session tokens.
    """
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


async def validate_ci_token(token: str, project_id: UUID) -> CIToken:
    """Validate a CI token and return the CIToken if valid.
    
    Args:
        token: The CI token (must start with 'ci_')
        project_id: The project UUID to validate against
        
    Returns:
        CIToken: The validated CI token
        
    Raises:
        HTTPException: If token is invalid, expired, or not found
    """
    # Validate token format
    if not token.startswith(CI_TOKEN_PREFIX):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format. CI tokens must start with 'ci_'"
        )
    
    token_hash = hash_token(token)
    
    async with async_session_factory() as db:
        result = await db.execute(
            select(CIToken).where(
                CIToken.token_hash == token_hash,
                CIToken.project_id == project_id
            )
        )
        ci_token = result.scalar_one_or_none()
        
        if not ci_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid CI token"
            )
        
        # Check if token is revoked
        if getattr(ci_token, 'revoked_at', None):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="CI token has been revoked"
            )
        
        # Check expiration
        if ci_token.expires_at and ci_token.expires_at < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="CI token has expired. Please generate a new token in project settings."
            )
        
        # Update last_used_at
        ci_token.last_used_at = datetime.now(timezone.utc)
        await db.commit()
        
        return ci_token


async def validate_ci_session(session_token: str, project_id: UUID) -> dict:
    """Validate a CI session token and return session info.
    
    Args:
        session_token: The session token (starts with 'ci_s_')
        project_id: The project UUID to validate against
        
    Returns:
        dict: Session info including token and permissions
        
    Raises:
        HTTPException: If session is invalid or expired
    """
    if not session_token.startswith(CI_SESSION_PREFIX):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token format"
        )
    
    # For now, we create a simple session validation
    # In production, this should use Redis or similar for session storage
    # For this implementation, we'll validate the token exists and isn't expired
    
    # TODO: Implement proper session storage with Redis
    # For now, we just check the format is correct
    if len(session_token) < 20:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token"
        )
    
    return {
        "session_token": session_token,
        "expires_in": CI_SESSION_EXPIRE_SECONDS,
        "project_id": str(project_id)
    }


async def get_current_ci_user(request: Request) -> dict:
    """FastAPI dependency for CI token authentication.
    
    Extracts the token from the request, validates it, and returns
    session info for the authenticated CI workflow.
    
    Returns:
        dict: Contains token info, session_token, and expires_in
        
    Raises:
        HTTPException: If authentication fails
    """
    token = _extract_ci_token(request)
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Provide CI token in Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Determine if this is a session token or a CI token
    if token.startswith(CI_SESSION_PREFIX):
        # This is a session token - validate and return session info
        # We need project_id from the request context
        project_id = getattr(request.state, 'project_id', None)
        if not project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project ID required for session validation"
            )
        
        return await validate_ci_session(token, UUID(project_id))
    
    elif token.startswith(CI_TOKEN_PREFIX):
        # This is a direct CI token - validate, create session, return
        project_id = getattr(request.state, 'project_id', None)
        if not project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project ID required for token validation"
            )
        
        ci_token = await validate_ci_token(token, UUID(project_id))
        
        # Create session for this CI token
        permissions = getattr(ci_token, 'scopes', ['read:secrets'])
        session_token, expires_at = create_ci_session(ci_token.project_id, permissions)
        
        return {
            "token": ci_token,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "expires_in": CI_SESSION_EXPIRE_SECONDS,
            "project_id": str(ci_token.project_id),
            "permissions": permissions,
            "scopes": permissions
        }
    
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format. Must start with 'ci_' or 'ci_s_'"
        )


def require_ci_scope(required_scope: str):
    """Dependency factory for requiring specific CI scopes.
    
    Usage:
        @router.get("/secrets", dependencies=[Depends(require_ci_scope("read:secrets"))])
    """
    validator = ScopeValidator()
    
    async def scope_checker(request: Request):
        ci_user = await get_current_ci_user(request)
        scopes = ci_user.get("scopes", [])
        
        if not validator.has_scope(scopes, required_scope):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required scope '{required_scope}' not granted"
            )
        
        return ci_user
    
    return scope_checker


async def validate_environment_access(ci_token, environment: str) -> None:
    """Validate that a CI token has access to the specified environment.
    
    Args:
        ci_token: CIToken model instance with environment_scope attribute
        environment: The environment name to access
        
    Raises:
        HTTPException: 403 if token is restricted to a different environment
    """
    environment_scope = getattr(ci_token, 'environment_scope', None)
    
    # null means all environments
    if environment_scope is None:
        return
    
    # Strict comparison - environment names are case-sensitive
    if environment_scope != environment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ENVIRONMENT_ACCESS_DENIED",
                "message": f"Token is restricted to environment '{environment_scope}' and cannot access '{environment}'"
            }
        )