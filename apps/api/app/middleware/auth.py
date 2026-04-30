from typing import Optional
from uuid import UUID

from fastapi import Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.services.auth_service import AuthService
from app.models.user import User


def _extract_token(request: Request) -> Optional[str]:
    """Extract Bearer token from Authorization header or cookie."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    return request.cookies.get("session_token")


async def get_current_user(request: Request) -> User:
    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    async with async_session_factory() as db:
        auth_service = AuthService(db)
        try:
            user = await auth_service.validate_session(token)
            await db.commit()
        except Exception:
            await db.rollback()
            raise

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired session",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return user


async def get_optional_user(request: Request) -> Optional[User]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None
