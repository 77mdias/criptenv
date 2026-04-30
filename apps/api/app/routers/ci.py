"""CI/CD Endpoints for Secret Management

Provides endpoints for CI/CD workflows to authenticate with CI tokens
and retrieve secrets from the vault.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.member import CIToken
from app.models.vault import VaultBlob
from app.models.environment import Environment
from app.middleware.ci_auth import (
    hash_token,
    create_ci_session,
    CI_TOKEN_PREFIX,
    CI_SESSION_PREFIX,
    CI_SESSION_EXPIRE_SECONDS
)
from app.schemas.vault import VaultBlobPull, VaultPullResponse


router = APIRouter(prefix="/api/v1", tags=["CI/CD"])


# Schemas
class CILoginRequest(BaseModel):
    token: str = Field(..., min_length=10, description="CI token starting with 'ci_'")
    project_id: Optional[str] = None  # Optional, extracted from token if not provided


class CILoginResponse(BaseModel):
    session_token: str
    expires_in: int = Field(..., description="Seconds until session expires")
    project_id: str
    permissions: list[str]


class CISecretsResponse(BaseModel):
    blobs: list[VaultBlobPull]
    version: int
    environment: str


class CIErrorResponse(BaseModel):
    code: str
    message: str
    details: Optional[dict] = None


def _force_load_blob(blob):
    """Force-load all column attributes to avoid async lazy-loading errors."""
    _ = blob.id
    _ = blob.project_id
    _ = blob.environment_id
    _ = blob.key_id
    _ = blob.iv
    _ = blob.ciphertext
    _ = blob.auth_tag
    _ = blob.version
    _ = blob.checksum
    _ = blob.created_at
    _ = blob.updated_at
    return blob


@router.post("/auth/ci-login", response_model=CILoginResponse, tags=["CI/CD"])
async def ci_login(
    request: Request,
    payload: CILoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Authenticate with a CI token and receive a session token.
    
    The session token is valid for 1 hour and can be used to access
    secrets in subsequent requests.
    
    Args:
        token: CI token starting with 'ci_' (from project settings)
        
    Returns:
        CILoginResponse: Session token and metadata
        
    Raises:
        401: If token is invalid or expired
        404: If project not found
    """
    # Validate token format
    if not payload.token.startswith(CI_TOKEN_PREFIX):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_TOKEN_FORMAT",
                "message": "Invalid token format. CI tokens must start with 'ci_'"
            }
        )
    
    token_hash = hash_token(payload.token)
    
    # Find the CI token in database
    result = await db.execute(
        select(CIToken).where(CIToken.token_hash == token_hash)
    )
    ci_token = result.scalar_one_or_none()
    
    if not ci_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_TOKEN",
                "message": "Invalid CI token"
            }
        )
    
    # Check if token is revoked
    if getattr(ci_token, 'revoked_at', None):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "TOKEN_REVOKED",
                "message": "CI token has been revoked"
            }
        )
    
    # Check expiration
    if ci_token.expires_at and ci_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "TOKEN_EXPIRED",
                "message": "CI token has expired. Please generate a new token in project settings."
            }
        )
    
    # Update last_used_at
    ci_token.last_used_at = datetime.now(timezone.utc)
    await db.commit()
    
    # Create session
    permissions = getattr(ci_token, 'scopes', ['read:secrets'])
    session_token, expires_at = create_ci_session(ci_token.project_id, permissions)
    
    return CILoginResponse(
        session_token=session_token,
        expires_in=CI_SESSION_EXPIRE_SECONDS,
        project_id=str(ci_token.project_id),
        permissions=permissions
    )


@router.get("/ci/secrets", response_model=CISecretsResponse, tags=["CI/CD"])
async def get_ci_secrets(
    request: Request,
    environment: str = Query(default="production", description="Environment name"),
    db: AsyncSession = Depends(get_db)
):
    """Get secrets for CI/CD workflow.
    
    This endpoint requires a valid session token (from ci-login)
    passed in the Authorization header.
    
    Args:
        environment: Environment name (default: production)
        
    Returns:
        CISecretsResponse: List of encrypted blobs and version
        
    Raises:
        401: If session token is invalid
        404: If environment not found
    """
    # Extract session token
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "MISSING_TOKEN",
                "message": "Authorization header required"
            }
        )
    
    session_token = auth_header[7:]
    
    # Validate session token format
    if not session_token.startswith(CI_SESSION_PREFIX):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_SESSION",
                "message": "Invalid session token format"
            }
        )
    
    # TODO: Validate session against Redis/DB in production
    # For now, we just check the format is valid
    
    # Get project_id from query or state
    project_id = request.query_params.get("project_id")
    if not project_id:
        project_id = getattr(request.state, 'project_id', None)
    
    if not project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "MISSING_PROJECT",
                "message": "Project ID required"
            }
        )
    
    try:
        project_uuid = UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_PROJECT_ID",
                "message": "Invalid project ID format"
            }
        )
    
    # Find environment
    env_result = await db.execute(
        select(Environment).where(
            Environment.project_id == project_uuid,
            Environment.name == environment
        )
    )
    env = env_result.scalar_one_or_none()
    
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "ENVIRONMENT_NOT_FOUND",
                "message": f"Environment '{environment}' not found in project '{project_id}'"
            }
        )
    
    # Fetch vault blobs
    blobs_result = await db.execute(
        select(VaultBlob)
        .where(
            VaultBlob.project_id == project_uuid,
            VaultBlob.environment_id == env.id
        )
        .order_by(VaultBlob.created_at)
    )
    blobs = list(blobs_result.scalars().all())
    
    return CISecretsResponse(
        blobs=[VaultBlobPull.model_validate(_force_load_blob(b)) for b in blobs],
        version=env.secrets_version,
        environment=environment
    )


@router.get("/ci/secrets/list", tags=["CI/CD"])
async def list_ci_secrets_keys(
    request: Request,
    environment: str = Query(default="production", description="Environment name"),
    db: AsyncSession = Depends(get_db)
):
    """List secret keys (without values) for CI/CD.
    
    This is a lighter endpoint that only returns key names and versions,
    useful for auditing what secrets are available without fetching values.
    
    Args:
        environment: Environment name (default: production)
        
    Returns:
        dict: List of secret metadata (no values)
    """
    # Same auth as get_ci_secrets
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "MISSING_TOKEN", "message": "Authorization header required"}
        )
    
    session_token = auth_header[7:]
    if not session_token.startswith(CI_SESSION_PREFIX):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_SESSION", "message": "Invalid session token format"}
        )
    
    project_id = request.query_params.get("project_id")
    if not project_id:
        project_id = getattr(request.state, 'project_id', None)
    
    if not project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "MISSING_PROJECT", "message": "Project ID required"}
        )
    
    try:
        project_uuid = UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_PROJECT_ID", "message": "Invalid project ID format"}
        )
    
    # Find environment
    env_result = await db.execute(
        select(Environment).where(
            Environment.project_id == project_uuid,
            Environment.name == environment
        )
    )
    env = env_result.scalar_one_or_none()
    
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "ENVIRONMENT_NOT_FOUND",
                "message": f"Environment '{environment}' not found"
            }
        )
    
    # Get blob metadata only
    blobs_result = await db.execute(
        select(VaultBlob.key_id, VaultBlob.version, VaultBlob.created_at)
        .where(
            VaultBlob.project_id == project_uuid,
            VaultBlob.environment_id == env.id
        )
        .order_by(VaultBlob.key_id)
    )
    blob_meta = list(blobs_result.all())
    
    return {
        "keys": [
            {"key_id": row[0], "version": row[1], "created_at": row[2].isoformat() if row[2] else None}
            for row in blob_meta
        ],
        "count": len(blob_meta),
        "version": env.secrets_version,
        "environment": environment
    }