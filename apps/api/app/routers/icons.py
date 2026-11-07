"""Site icons for personal-vault logins (`<img>` from the dashboard).

Web session only, so the API is not an open icon proxy. Nothing about the
request is stored; the hostname is also redacted from every log.
"""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_web_user
from app.models.user import User
from app.services.site_icon_service import ICON_PATH_PREFIX, get_site_icon, normalize_hostname

router = APIRouter(prefix=ICON_PATH_PREFIX.rstrip("/"), tags=["Icons"])

FOUND_CACHE = "private, max-age=604800"
MISSING_CACHE = "private, max-age=86400"


@router.get("/{hostname}/icon.png")
async def get_icon(
    hostname: str,
    user: User = Depends(get_current_web_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    host = normalize_hostname(hostname)
    if host is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid hostname")
    # Release the pooled connection and the sessions-row lock (last_accessed_at)
    # before an outbound fetch that can take up to 10 s.
    await db.commit()
    icon = await get_site_icon(host)
    if icon is None:
        return Response(status_code=status.HTTP_404_NOT_FOUND, headers={"Cache-Control": MISSING_CACHE})
    return Response(
        content=icon.content,
        media_type=icon.media_type,
        headers={"Cache-Control": FOUND_CACHE, "X-Content-Type-Options": "nosniff"},
    )
