from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.overview import ActivityDay, OverviewResponse
from app.services.overview_service import OverviewService

router = APIRouter(prefix="/api/v1/me", tags=["Me"])


@router.get("/overview", response_model=OverviewResponse)
async def get_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dashboard aggregate: the user's projects plus items that need attention."""
    return await OverviewService(db).get_overview(current_user.id)


@router.get("/activity-stats", response_model=list[ActivityDay])
async def get_activity_stats(
    days: int = Query(30, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Audit events per day across the user's projects (secret changes vs other)."""
    return await OverviewService(db).get_activity_stats(current_user.id, days)
