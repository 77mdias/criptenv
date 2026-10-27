"""Read-only aggregates for the authenticated dashboard (GET /api/v1/me/*).

Everything is scoped to projects the user is a member of; credentials
(CI tokens, API keys) and pending invites only for projects they manage.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_key import APIKey
from app.models.audit import AuditLog
from app.models.environment import Environment
from app.models.integration import Integration
from app.models.member import CIToken, ProjectInvite, ProjectMember
from app.models.secret_expiration import SecretExpiration
from app.models.vault import VaultBlob
from app.services.project_service import ProjectService

MANAGER_ROLES = ("owner", "admin")
EXPIRING_WITHIN = timedelta(days=7)
STALE_AFTER = timedelta(days=30)
# Actions that change secret material; everything else counts as "other" activity
CHANGE_ACTIONS = ("vault.pushed", "secret.rotated")


def _utc(value: Optional[datetime]) -> Optional[datetime]:
    """SQLite returns naive datetimes; Postgres returns aware ones."""
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=timezone.utc)


class OverviewService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_overview(self, user_id: UUID, now: Optional[datetime] = None) -> dict:
        now = now or datetime.now(timezone.utc)
        memberships = await ProjectService(self.db).list_user_projects_with_roles(user_id)
        project_ids = [project.id for project, _ in memberships]
        managed_ids = [project.id for project, role in memberships if role in MANAGER_ROLES]

        if not project_ids:
            return {
                "projects": [],
                "attention": {key: [] for key in (
                    "expired", "expiring", "pending_invites", "stale_credentials", "failing_integrations"
                )},
                "totals": {"projects": 0, "secrets": 0, "members": 0},
            }

        environments = (await self.db.execute(
            select(Environment)
            .where(Environment.project_id.in_(project_ids), Environment.archived == False)  # noqa: E712
            .order_by(Environment.is_default.desc(), Environment.name)
        )).scalars().all()

        blob_stats = {
            env_id: (count, _utc(updated_at))
            for env_id, count, updated_at in (await self.db.execute(
                select(VaultBlob.environment_id, func.count(VaultBlob.id), func.max(VaultBlob.updated_at))
                .where(VaultBlob.project_id.in_(project_ids))
                .group_by(VaultBlob.environment_id)
            )).all()
        }
        member_counts = dict((await self.db.execute(
            select(ProjectMember.project_id, func.count(ProjectMember.id))
            .where(ProjectMember.project_id.in_(project_ids))
            .group_by(ProjectMember.project_id)
        )).all())
        last_activity = {
            project_id: _utc(created_at)
            for project_id, created_at in (await self.db.execute(
                select(AuditLog.project_id, func.max(AuditLog.created_at))
                .where(AuditLog.project_id.in_(project_ids))
                .group_by(AuditLog.project_id)
            )).all()
        }

        envs_by_project: dict[UUID, list[dict]] = {}
        env_names: dict[UUID, str] = {}
        for env in environments:
            count, updated_at = blob_stats.get(env.id, (0, None))
            env_names[env.id] = env.name
            envs_by_project.setdefault(env.project_id, []).append({
                "id": env.id,
                "name": env.name,
                "is_default": bool(env.is_default),
                "secret_count": count,
                "version": env.secrets_version or 0,
                "updated_at": updated_at or _utc(env.updated_at),
            })

        projects = [
            {
                "id": project.id,
                "name": project.name,
                "slug": project.slug,
                "role": role,
                "member_count": member_counts.get(project.id, 0),
                "last_activity_at": last_activity.get(project.id),
                "environments": envs_by_project.get(project.id, []),
            }
            for project, role in memberships
        ]

        return {
            "projects": projects,
            "attention": {
                **await self._expirations(project_ids, env_names, now),
                "pending_invites": await self._pending_invites(managed_ids, now),
                "stale_credentials": await self._stale_credentials(managed_ids, now),
                "failing_integrations": await self._failing_integrations(project_ids),
            },
            "totals": {
                "projects": len(projects),
                "secrets": sum(env["secret_count"] for envs in envs_by_project.values() for env in envs),
                "members": sum(project["member_count"] for project in projects),
            },
        }

    async def _expirations(self, project_ids: list[UUID], env_names: dict[UUID, str], now: datetime) -> dict:
        rows = (await self.db.execute(
            select(SecretExpiration)
            .where(SecretExpiration.project_id.in_(project_ids), SecretExpiration.rotated_at.is_(None))
            .order_by(SecretExpiration.expires_at)
        )).scalars().all()
        expired, expiring = [], []
        for row in rows:
            if row.environment_id not in env_names:  # archived environment
                continue
            expires_at = _utc(row.expires_at)
            item = {
                "project_id": row.project_id,
                "environment_id": row.environment_id,
                "environment_name": env_names[row.environment_id],
                "secret_key": row.secret_key,
                "expires_at": expires_at,
            }
            if expires_at <= now:
                expired.append(item)
            elif expires_at <= now + EXPIRING_WITHIN:
                expiring.append(item)
        return {"expired": expired, "expiring": expiring}

    async def _pending_invites(self, managed_ids: list[UUID], now: datetime) -> list[dict]:
        if not managed_ids:
            return []
        rows = (await self.db.execute(
            select(ProjectInvite).where(
                ProjectInvite.project_id.in_(managed_ids),
                ProjectInvite.accepted_at.is_(None),
                ProjectInvite.revoked_at.is_(None),
            ).order_by(ProjectInvite.expires_at)
        )).scalars().all()
        return [
            {"project_id": r.project_id, "id": r.id, "email": r.email, "role": r.role,
             "expires_at": _utc(r.expires_at)}
            for r in rows if _utc(r.expires_at) > now
        ]

    async def _stale_credentials(self, managed_ids: list[UUID], now: datetime) -> list[dict]:
        if not managed_ids:
            return []
        items = []
        for kind, model in (("ci_token", CIToken), ("api_key", APIKey)):
            rows = (await self.db.execute(
                select(model).where(model.project_id.in_(managed_ids), model.revoked_at.is_(None))
            )).scalars().all()
            for row in rows:
                expires_at, last_used_at = _utc(row.expires_at), _utc(row.last_used_at)
                if expires_at is not None and expires_at <= now:
                    continue  # already unusable
                if expires_at is None:
                    reason = "no_expiry"
                elif last_used_at is None or last_used_at < now - STALE_AFTER:
                    reason = "unused"
                else:
                    continue
                items.append({
                    "project_id": row.project_id, "id": row.id, "kind": kind, "name": row.name,
                    "reason": reason, "last_used_at": last_used_at, "expires_at": expires_at,
                })
        return items

    async def _failing_integrations(self, project_ids: list[UUID]) -> list[dict]:
        rows = (await self.db.execute(
            select(Integration).where(Integration.project_id.in_(project_ids), Integration.status == "error")
        )).scalars().all()
        return [
            {"project_id": r.project_id, "id": r.id, "provider": r.provider, "name": r.name,
             "last_error": r.last_error}
            for r in rows
        ]

    async def get_secret_matrix(self, project_id: UUID) -> dict:
        """Key × environment presence from vault metadata (never ciphertext)."""
        environments = (await self.db.execute(
            select(Environment)
            .where(Environment.project_id == project_id, Environment.archived == False)  # noqa: E712
            .order_by(Environment.is_default.desc(), Environment.name)
        )).scalars().all()
        env_ids = [env.id for env in environments]

        rows = (await self.db.execute(
            select(VaultBlob.key_id, VaultBlob.environment_id, VaultBlob.version, VaultBlob.updated_at)
            .where(VaultBlob.project_id == project_id, VaultBlob.environment_id.in_(env_ids))
        )).all() if env_ids else []

        cells: dict[str, dict] = {}
        for key_id, env_id, version, updated_at in rows:
            cells.setdefault(key_id, {str(e): None for e in env_ids})[str(env_id)] = {
                "version": version,
                "updated_at": _utc(updated_at),
            }

        return {
            "environments": [
                {"id": env.id, "name": env.name, "is_default": bool(env.is_default)} for env in environments
            ],
            "keys": [{"key_id": key_id, "cells": cells[key_id]} for key_id in sorted(cells)],
        }

    async def get_activity_stats(self, user_id: UUID, days: int, now: Optional[datetime] = None) -> list[dict]:
        now = now or datetime.now(timezone.utc)
        today = now.date()
        start_day = today - timedelta(days=days - 1)
        memberships = await ProjectService(self.db).list_user_projects_with_roles(user_id)
        project_ids = [project.id for project, _ in memberships]

        buckets = {start_day + timedelta(days=i): {"changes": 0, "other": 0} for i in range(days)}
        if project_ids:
            day = func.date(AuditLog.created_at)
            rows = (await self.db.execute(
                select(day, AuditLog.action, func.count(AuditLog.id))
                .where(
                    AuditLog.project_id.in_(project_ids),
                    AuditLog.created_at >= datetime.combine(start_day, datetime.min.time(), timezone.utc),
                )
                .group_by(day, AuditLog.action)
            )).all()
            for raw_day, action, count in rows:
                bucket_day = raw_day if isinstance(raw_day, date) else date.fromisoformat(str(raw_day))
                if bucket_day in buckets:
                    buckets[bucket_day]["changes" if action in CHANGE_ACTIONS else "other"] += count

        return [{"date": d.isoformat(), **counts} for d, counts in sorted(buckets.items())]
