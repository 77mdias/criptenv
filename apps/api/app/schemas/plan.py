from pydantic import BaseModel


class PlanResponse(BaseModel):
    id: str
    # None = no limit on this plan.
    limits: dict[str, int | None]
    features: list[str]
