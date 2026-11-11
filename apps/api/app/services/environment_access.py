"""Who reaches which environment.

A restricted environment belongs to the project's owner and admins. For anyone
else it does not exist: every route that hands out environment data asks here,
none decides on its own.
"""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.environment import Environment
from app.strategies.access import ROLE_LEVELS

# The environments every project is born with: never restricted.
SEEDED_NAMES = ("production", "staging", "development")


def sees_restricted(role: str | None) -> bool:
    """Owner and admins. An unknown role sees nothing restricted."""
    return ROLE_LEVELS.get(role or "", -1) >= ROLE_LEVELS["admin"]


def restriction_error(name: str, *, is_default: bool, restricted: bool) -> str | None:
    """Why this combination is refused (422), or None when it is fine."""
    if not restricted:
        return None
    if name in SEEDED_NAMES:
        return "The production, staging and development environments cannot be restricted"
    if is_default:
        # The CLI falls back to the default environment: it must be one everybody reaches.
        return "The default environment cannot be restricted"
    return None


async def restricted_ids(db: AsyncSession, project_id: UUID) -> set[UUID]:
    """Every restricted environment of the project, archived ones included (their data is still there)."""
    result = await db.scalars(
        select(Environment.id).where(Environment.project_id == project_id, Environment.restricted.is_(True))
    )
    return set(result)


async def hidden_ids(db: AsyncSession, project_id: UUID, role: str | None) -> set[UUID]:
    """The environments this role must not see in the project: none for owner and admins."""
    return set() if sees_restricted(role) else await restricted_ids(db, project_id)


async def hidden_names(db: AsyncSession, project_id: UUID, role: str | None) -> set[str]:
    """Same as hidden_ids, by name (CI tokens and API keys are scoped by environment name)."""
    if sees_restricted(role):
        return set()
    result = await db.scalars(
        select(Environment.name).where(Environment.project_id == project_id, Environment.restricted.is_(True))
    )
    return set(result)


async def hidden_ids_for_credential(db: AsyncSession, project_id: UUID, scope: str | None) -> set[UUID]:
    """The restricted environments a CI token or API key with this scope does not reach."""
    result = await db.execute(
        select(Environment.id, Environment.name)
        .where(Environment.project_id == project_id, Environment.restricted.is_(True))
    )
    return {env_id for env_id, name in result.all() if name != scope}


def credential_reaches(environment, scope: str | None) -> bool:
    """A CI token or API key with no scope reaches every open environment; a restricted one
    only when the credential is scoped to it by name."""
    if getattr(environment, "restricted", False):
        return scope == environment.name
    return scope is None or scope == environment.name
