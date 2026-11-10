from datetime import datetime

from pydantic import BaseModel


class PlanResponse(BaseModel):
    id: str
    # None = no limit on this plan.
    limits: dict[str, int | None]
    features: list[str]
    # How much of each limit is in use; only the limits that apply to the answer's scope (user or project).
    usage: dict[str, int] = {}
    # Billing is on and this plan is the caller's own to change (false for a member of someone else's project).
    can_upgrade: bool = False
    # Set while a payment is overdue: the plan holds until this date. Only on the caller's own plan.
    grace_until: datetime | None = None
