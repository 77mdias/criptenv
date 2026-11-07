"""Plans: the one place that says what each plan allows.

Limits are `None` when the plan has no limit. Paid plans will be new entries
here plus a value in `users.plan`; nothing else should hard-code a limit.
"""
from collections.abc import Mapping
from dataclasses import dataclass, field

PERSONAL_VAULT_ITEMS = "personal_vault_items"
PERSONAL_VAULT_FOLDERS = "personal_vault_folders"


@dataclass(frozen=True)
class Plan:
    id: str
    limits: Mapping[str, int | None]
    features: frozenset[str] = field(default_factory=frozenset)


PLANS: dict[str, Plan] = {
    "free": Plan("free", {PERSONAL_VAULT_ITEMS: 120, PERSONAL_VAULT_FOLDERS: 10}),
    # For self-hosted installs (DEFAULT_PLAN=unlimited).
    "unlimited": Plan("unlimited", {PERSONAL_VAULT_ITEMS: None, PERSONAL_VAULT_FOLDERS: None}),
}


def plan_for(user_plan: str | None) -> Plan:
    """The user's own plan, else the server's DEFAULT_PLAN; an unknown value is `free`, never unlimited."""
    # Imported here: app.config imports PLANS to validate DEFAULT_PLAN.
    from app.config import settings

    return PLANS.get(user_plan or settings.DEFAULT_PLAN, PLANS["free"])
