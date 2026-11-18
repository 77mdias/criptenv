"""Environment inheritance: a child environment stores only its overrides and reads through its parents.

Resolution of a key, walking the chain from the top ancestor down to the environment itself:
  - each level first drops the keys it unsets (`unset_keys`), then lays its own blobs on top;
  - so the child beats the parent, the parent beats the grandparent, and an unset hides a key
    from that level down without touching the ancestor that holds it.

The server resolves on key names only (they are plaintext already); values stay encrypted with the
key of the environment that holds them, and each resolved blob carries that environment's id so the
client derives the right key. Zero-knowledge is unchanged.

Ephemeral children (`expires_at`) count as gone the moment they expire, before the cleanup job
deletes them. A child's expiry never outlives its ancestors' (it is clamped at creation).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.api_key import APIKey
from app.models.environment import Environment
from app.models.member import CISession, CIToken
from app.models.secret_expiration import SecretExpiration, SecretRotation
from app.models.vault import VaultBlob

# Seconds. A worktree lives days or weeks; past 90 days it is not ephemeral any more.
MIN_TTL_SECONDS = 60
MAX_TTL_SECONDS = 90 * 24 * 3600


class InheritanceError(ValueError):
    """The chain is broken (cycle, too deep) or the requested parent cannot be one."""


def _aware(moment: datetime | None) -> datetime | None:
    # SQLite hands dates back without a zone; Postgres with one.
    if moment is None or moment.tzinfo is not None:
        return moment
    return moment.replace(tzinfo=timezone.utc)


def is_expired(env: Environment, now: datetime | None = None) -> bool:
    expires_at = getattr(env, "expires_at", None)
    if not isinstance(expires_at, datetime):  # unset (or a stand-in object without the column)
        return False
    return _aware(expires_at) <= (now or datetime.now(timezone.utc))


def is_gone(env: Environment | None, now: datetime | None = None) -> bool:
    """Archived or expired: every route treats it as not found."""
    return env is None or bool(getattr(env, "archived", False)) or is_expired(env, now)


def max_depth() -> int:
    return settings.ENV_INHERITANCE_MAX_DEPTH


async def load_chain(db: AsyncSession, env: Environment) -> list[Environment]:
    """[env, parent, grandparent, ...]. Refuses a cycle, a chain past the max depth and a gone ancestor."""
    chain = [env]
    seen = {env.id}
    current = env
    while current.parent_id is not None:
        if current.parent_id in seen:
            raise InheritanceError("Environment inheritance has a cycle")
        if len(chain) > max_depth():
            raise InheritanceError(f"Environment inheritance is deeper than {max_depth()} levels")
        parent = await db.get(Environment, current.parent_id)
        if parent is None or parent.project_id != env.project_id or is_gone(parent):
            raise InheritanceError("Parent environment not found")
        chain.append(parent)
        seen.add(parent.id)
        current = parent
    return chain


@dataclass
class ResolvedBlob:
    blob: VaultBlob
    source: Environment
    inherited: bool


async def resolve(db: AsyncSession, chain: list[Environment]) -> dict[str, ResolvedBlob]:
    """key name -> the blob that wins for chain[0], with the environment it comes from."""
    by_env: dict[UUID, list[VaultBlob]] = {e.id: [] for e in chain}
    rows = await db.scalars(
        select(VaultBlob).where(VaultBlob.environment_id.in_(list(by_env))).order_by(VaultBlob.created_at)
    )
    for blob in rows:
        by_env[blob.environment_id].append(blob)

    resolved: dict[str, ResolvedBlob] = {}
    for level in reversed(chain):
        for key in level.unset_keys or []:
            resolved.pop(key, None)
        for blob in by_env[level.id]:
            resolved[blob.key_id] = ResolvedBlob(blob=blob, source=level, inherited=level.id != chain[0].id)
    return resolved


async def diff_with_parent(db: AsyncSession, chain: list[Environment]) -> list[dict]:
    """Key names of chain[0] against what its parent resolves to: override, added, unset, inherited.
    Names and origins only, never a value."""
    if len(chain) < 2:
        raise InheritanceError("Environment has no parent")
    env = chain[0]
    parent_view = await resolve(db, chain[1:])
    own = set(await db.scalars(select(VaultBlob.key_id).where(VaultBlob.environment_id == env.id)))
    unset = set(env.unset_keys or [])
    rows = []
    for key in sorted(own | unset | set(parent_view)):
        inherited_from = parent_view[key].source.name if key in parent_view else None
        if key in own:
            status = "override" if key in parent_view else "added"
            source = env.name
        elif key in unset:
            status, source = "unset", inherited_from
        else:
            status, source = "inherited", inherited_from
        rows.append({"key": key, "status": status, "source": source, "parent_source": inherited_from})
    return rows


async def plan_child(
    db: AsyncSession, parent: Environment | None, project_id: UUID, ttl_seconds: int | None,
    restricted: bool, is_default: bool,
) -> tuple[bool, datetime | None]:
    """Validate a new environment's parent and TTL. Returns (restricted, expires_at) to store.

    - the parent is a live environment of the same project, within the max depth;
    - a child of a restricted parent is restricted too (an open child would hand restricted values to anyone);
    - a child is never the default; a TTL only goes on a child (a root environment is never ephemeral);
    - a child never outlives its ancestors: its expiry is clamped to theirs.
    """
    if parent is None:
        if ttl_seconds is not None:
            raise InheritanceError("Only a child environment (with a parent) can have a TTL")
        return restricted, None
    if parent.project_id != project_id or is_gone(parent):
        raise InheritanceError("Parent environment not found")
    if is_default:
        raise InheritanceError("A child environment cannot be the project's default")
    if ttl_seconds is not None and not MIN_TTL_SECONDS <= ttl_seconds <= MAX_TTL_SECONDS:
        raise InheritanceError(f"TTL must be between {MIN_TTL_SECONDS} seconds and {MAX_TTL_SECONDS // 86400} days")

    ancestors = await load_chain(db, parent)
    if len(ancestors) >= max_depth() + 1:
        raise InheritanceError(f"Environment inheritance is limited to {max_depth()} levels")

    deadlines = [_aware(a.expires_at) for a in ancestors if a.expires_at is not None]
    if ttl_seconds is not None:
        deadlines.append(datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds))
    expires_at = min(deadlines) if deadlines else None
    return restricted or any(a.restricted for a in ancestors), expires_at


async def live_children(db: AsyncSession, env: Environment) -> list[Environment]:
    rows = await db.scalars(select(Environment).where(Environment.parent_id == env.id))
    return [child for child in rows if not is_gone(child)]


async def descendants(db: AsyncSession, env: Environment) -> list[Environment]:
    """Every environment below env, deepest first (the order they can be deleted in)."""
    found: list[Environment] = []
    level = [env]
    while level:
        rows = list(await db.scalars(select(Environment).where(Environment.parent_id.in_([e.id for e in level]))))
        found.extend(rows)
        level = rows
    return list(reversed(found))


async def hard_delete(db: AsyncSession, env: Environment) -> None:
    """Delete a child environment and everything that is its own; frees its name for the next worktree.

    Credentials scoped to it by name are revoked: otherwise a token for an old worktree would reach a
    new environment created later under the same name. Ancestors are untouched.
    """
    now = datetime.now(timezone.utc)
    for model in (CIToken, APIKey):
        await db.execute(
            update(model)
            .where(model.project_id == env.project_id, model.environment_scope == env.name, model.revoked_at.is_(None))
            .values(revoked_at=now)
            .execution_options(synchronize_session=False)
        )
    for model in (SecretExpiration, SecretRotation):
        await db.execute(delete(model).where(model.environment_id == env.id))
    # Sessions already opened by those tokens end too (a session is checked on its own, not its token).
    await db.execute(
        delete(CISession).where(CISession.project_id == env.project_id, CISession.environment_scope == env.name)
    )
    await db.execute(delete(VaultBlob).where(VaultBlob.environment_id == env.id))
    await db.execute(delete(Environment).where(Environment.id == env.id))


async def purge(db: AsyncSession, env: Environment) -> list[Environment]:
    """Hard-delete env and every environment below it (deepest first). Returns what was deleted.

    Callers only reach here when the descendants are gone already (expired with their ancestor,
    or refused upfront while live), so nothing live is lost.
    """
    doomed = [*await descendants(db, env), env]
    for victim in doomed:
        await hard_delete(db, victim)
    return doomed


async def purge_expired(db: AsyncSession, now: datetime | None = None) -> list[Environment]:
    """Delete every expired child environment of every project. Returns what was deleted."""
    now = now or datetime.now(timezone.utc)
    expired = list(await db.scalars(
        select(Environment).where(
            # A root environment is never ephemeral, whatever the column holds.
            Environment.parent_id.is_not(None), Environment.expires_at.is_not(None), Environment.expires_at <= now,
        )
    ))
    deleted: list[Environment] = []
    deleted_ids: set[UUID] = set()
    for env in expired:
        if env.id in deleted_ids:
            continue  # went with an expired ancestor
        for victim in await purge(db, env):
            deleted_ids.add(victim.id)
            deleted.append(victim)
    return deleted
