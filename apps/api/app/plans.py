"""Plans: the one place that says what each plan allows.

Limits are `None` when the plan has no limit. A user's plan is the value in
`users.plan` (written by the subscription service); nothing else should
hard-code a limit. Per-project limits follow the plan of the project's owner
(app/services/plan_limits.py).
"""
from collections.abc import Mapping
from dataclasses import dataclass, field

PROJECTS = "projects"
ENVIRONMENTS_PER_PROJECT = "environments_per_project"
MEMBERS_PER_PROJECT = "members_per_project"
INTEGRATIONS_PER_PROJECT = "integrations_per_project"
AUDIT_RETENTION_DAYS = "audit_retention_days"
PERSONAL_VAULT_ITEMS = "personal_vault_items"
PERSONAL_VAULT_FOLDERS = "personal_vault_folders"

AUTO_SYNC = "auto_sync"
SYNC_REDEPLOY = "sync_redeploy"
CI_SYNC = "ci_sync"

_LIMIT_KEYS = (
    PROJECTS, ENVIRONMENTS_PER_PROJECT, MEMBERS_PER_PROJECT, INTEGRATIONS_PER_PROJECT,
    AUDIT_RETENTION_DAYS, PERSONAL_VAULT_ITEMS, PERSONAL_VAULT_FOLDERS,
)
_SYNC_FEATURES = frozenset({AUTO_SYNC, SYNC_REDEPLOY, CI_SYNC})


@dataclass(frozen=True)
class Plan:
    id: str
    limits: Mapping[str, int | None]
    features: frozenset[str] = field(default_factory=frozenset)


def _limits(*values: int | None) -> dict[str, int | None]:
    return dict(zip(_LIMIT_KEYS, values, strict=True))


PLANS: dict[str, Plan] = {
    #                       projects envs members integrations audit items folders
    "free": Plan("free", _limits(3, 3, 3, 1, 7, 120, 10)),
    "pro": Plan("pro", _limits(None, None, 10, None, 30, None, None)),
    "max": Plan("max", _limits(None, None, 25, None, 90, None, None), _SYNC_FEATURES),
    # For self-hosted installs (DEFAULT_PLAN=unlimited).
    "unlimited": Plan("unlimited", _limits(*[None] * len(_LIMIT_KEYS)), _SYNC_FEATURES),
}


def plan_for(user_plan: str | None) -> Plan:
    """The user's own plan, else the server's DEFAULT_PLAN; an unknown value is `free`, never unlimited."""
    # Imported here: app.config imports PLANS to validate DEFAULT_PLAN.
    from app.config import settings

    return PLANS.get(user_plan or settings.DEFAULT_PLAN, PLANS["free"])
