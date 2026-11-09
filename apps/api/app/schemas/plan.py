from pydantic import BaseModel


class PlanResponse(BaseModel):
    id: str
    # None = no limit on this plan.
    limits: dict[str, int | None]
    features: list[str]
    # How much of each limit is in use; only the limits that apply to the answer's scope (user or project).
    usage: dict[str, int] = {}
