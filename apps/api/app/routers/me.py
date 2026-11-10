from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.plans import plan_for
from app.schemas.overview import ActivityDay, OverviewResponse
from app.schemas.plan import PlanResponse
from app.services.overview_service import OverviewService
from app.services.billing_service import billing_enabled, grace_until_for
from app.services.plan_limits import PlanLimits

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


@router.get("/plan", response_model=PlanResponse)
async def get_plan(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The user's plan: its limits (null = no limit), the features it unlocks and the projects they own."""
    plan = plan_for(current_user.plan)
    billing = billing_enabled()
    return PlanResponse(
        id=plan.id, limits=dict(plan.limits), features=sorted(plan.features),
        usage=await PlanLimits(db).user_usage(current_user.id),
        can_upgrade=billing,
        grace_until=await grace_until_for(db, current_user.id) if billing else None,
    )
