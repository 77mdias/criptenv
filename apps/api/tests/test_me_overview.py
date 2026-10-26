"""GET /api/v1/me/overview and /me/activity-stats (UX.2).

Real SQLite DB: aggregation, cross-user isolation and role filtering are the
point of these endpoints, so they are not mocked.
"""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
import pytest_asyncio

pytest.importorskip("aiosqlite")

from httpx import ASGITransport, AsyncClient
from sqlalchemy.dialects.postgresql import CITEXT, JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import app
from app.database import Base, get_db
from app.middleware.auth import get_current_user
from app.models.api_key import APIKey
from app.models.audit import AuditLog
from app.models.environment import Environment
from app.models.integration import Integration
from app.models.member import CIToken, ProjectInvite, ProjectMember
from app.models.project import Project
from app.models.secret_expiration import SecretExpiration
from app.models.user import User
from app.models.vault import VaultBlob


@compiles(CITEXT, "sqlite")
def _compile_citext_sqlite(element, compiler, **kw):
    return "TEXT"


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(element, compiler, **kw):
    return "JSON"


NOW = datetime.now(timezone.utc)


def _user(name):
    return User(id=uuid4(), email=f"{name}@example.com", name=name.title(),
                password_hash="", kdf_salt="salt", email_verified=True)


def _blob(project, env, key):
    return VaultBlob(id=uuid4(), project_id=project.id, environment_id=env.id, key_id=key,
                     iv="iv", ciphertext="ct", auth_tag="tag", version=1, checksum="c" * 64)


@pytest_asyncio.fixture
async def world():
    """ana owns `api` (2 envs, 3 secrets) and is viewer on bo's `web`; bo owns `web`.
    cy has a private project that nobody else may see."""
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    ana, bo, cy = _user("ana"), _user("bo"), _user("cy")
    api = Project(id=uuid4(), owner_id=ana.id, name="api", slug="api", settings={})
    web = Project(id=uuid4(), owner_id=bo.id, name="web", slug="web", settings={})
    secret_project = Project(id=uuid4(), owner_id=cy.id, name="private", slug="private", settings={})
    api_prod = Environment(id=uuid4(), project_id=api.id, name="production", is_default=True, secrets_version=3)
    api_dev = Environment(id=uuid4(), project_id=api.id, name="development", secrets_version=1)
    web_prod = Environment(id=uuid4(), project_id=web.id, name="production", is_default=True)
    private_env = Environment(id=uuid4(), project_id=secret_project.id, name="production")

    async with factory() as db:
        db.add_all([ana, bo, cy, api, web, secret_project, api_prod, api_dev, web_prod, private_env])
        db.add_all([
            ProjectMember(id=uuid4(), project_id=api.id, user_id=ana.id, role="owner"),
            ProjectMember(id=uuid4(), project_id=web.id, user_id=bo.id, role="owner"),
            ProjectMember(id=uuid4(), project_id=web.id, user_id=ana.id, role="viewer"),
            ProjectMember(id=uuid4(), project_id=secret_project.id, user_id=cy.id, role="owner"),
            _blob(api, api_prod, "DATABASE_URL"), _blob(api, api_prod, "API_KEY"),
            _blob(api, api_dev, "DATABASE_URL"), _blob(secret_project, private_env, "LEAK"),
            # attention on `api` (ana manages it)
            SecretExpiration(id=uuid4(), project_id=api.id, environment_id=api_prod.id,
                             secret_key="API_KEY", expires_at=NOW - timedelta(days=1)),
            SecretExpiration(id=uuid4(), project_id=api.id, environment_id=api_prod.id,
                             secret_key="DATABASE_URL", expires_at=NOW + timedelta(days=3)),
            SecretExpiration(id=uuid4(), project_id=api.id, environment_id=api_dev.id,
                             secret_key="DATABASE_URL", expires_at=NOW + timedelta(days=60)),
            ProjectInvite(id=uuid4(), project_id=api.id, email="new@x.com", role="developer",
                          token="t1", expires_at=NOW + timedelta(days=5)),
            CIToken(id=uuid4(), project_id=api.id, name="deploy", token_hash="h1",
                    scopes=["read:secrets"], expires_at=None, last_used_at=NOW),
            CIToken(id=uuid4(), project_id=api.id, name="fresh", token_hash="h2",
                    scopes=["read:secrets"], expires_at=NOW + timedelta(days=30), last_used_at=NOW),
            APIKey(id=uuid4(), user_id=ana.id, project_id=api.id, name="old", prefix="cek_live_",
                   key_hash="k1", scopes=["read:secrets"], expires_at=NOW + timedelta(days=90),
                   last_used_at=NOW - timedelta(days=45)),
            Integration(id=uuid4(), project_id=api.id, provider="vercel", name="vercel-prod",
                        config={}, status="error", last_error="401 from provider"),
            # `web`: ana is only a viewer → its credentials must not leak to her
            CIToken(id=uuid4(), project_id=web.id, name="web-ci", token_hash="h3",
                    scopes=["read:secrets"], expires_at=None),
            # cy's private project
            CIToken(id=uuid4(), project_id=secret_project.id, name="cy-ci", token_hash="h4",
                    scopes=["read:secrets"], expires_at=None),
            AuditLog(id=uuid4(), user_id=ana.id, project_id=api.id, action="vault.pushed",
                     resource_type="vault", meta={}, created_at=NOW - timedelta(days=1)),
            AuditLog(id=uuid4(), user_id=ana.id, project_id=api.id, action="secret.rotated",
                     resource_type="secret", meta={}, created_at=NOW - timedelta(days=1)),
            AuditLog(id=uuid4(), user_id=ana.id, project_id=api.id, action="member.added",
                     resource_type="member", meta={}, created_at=NOW),
            AuditLog(id=uuid4(), user_id=cy.id, project_id=secret_project.id, action="vault.pushed",
                     resource_type="vault", meta={}, created_at=NOW),
        ])
        await db.commit()

    yield factory, {"ana": ana, "bo": bo, "cy": cy, "api": api, "web": web}
    await engine.dispose()


async def _get(factory, user, path):
    async def _get_db():
        async with factory() as db:
            yield db

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_user] = lambda: MagicMock(id=user.id)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(path, headers={"Authorization": "Bearer test"})
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.asyncio
async def test_overview_aggregates_projects_and_totals(world):
    factory, w = world
    data = await _get(factory, w["ana"], "/api/v1/me/overview")

    by_name = {p["name"]: p for p in data["projects"]}
    assert set(by_name) == {"api", "web"}
    assert by_name["api"]["role"] == "owner" and by_name["web"]["role"] == "viewer"
    envs = {e["name"]: e for e in by_name["api"]["environments"]}
    assert envs["production"]["secret_count"] == 2 and envs["development"]["secret_count"] == 1
    assert by_name["api"]["member_count"] == 1 and by_name["web"]["member_count"] == 2
    assert by_name["api"]["last_activity_at"] is not None
    assert data["totals"] == {"projects": 2, "secrets": 3, "members": 3}


@pytest.mark.asyncio
async def test_overview_attention_items(world):
    factory, w = world
    attention = (await _get(factory, w["ana"], "/api/v1/me/overview"))["attention"]

    assert [e["secret_key"] for e in attention["expired"]] == ["API_KEY"]
    assert [e["secret_key"] for e in attention["expiring"]] == ["DATABASE_URL"]  # 60-day one excluded
    assert [i["email"] for i in attention["pending_invites"]] == ["new@x.com"]
    stale = {(c["kind"], c["name"]): c["reason"] for c in attention["stale_credentials"]}
    assert stale == {("ci_token", "deploy"): "no_expiry", ("api_key", "old"): "unused"}
    assert [i["name"] for i in attention["failing_integrations"]] == ["vercel-prod"]
    assert attention["failing_integrations"][0]["last_error"] == "401 from provider"


@pytest.mark.asyncio
async def test_overview_never_leaks_other_users_data(world):
    factory, w = world
    data = await _get(factory, w["ana"], "/api/v1/me/overview")
    flat = str(data)
    # cy's project and bo's credentials (ana is only a viewer on `web`)
    assert "private" not in flat and "cy-ci" not in flat and "LEAK" not in flat
    assert "web-ci" not in flat

    bo_data = await _get(factory, w["bo"], "/api/v1/me/overview")
    assert [p["name"] for p in bo_data["projects"]] == ["web"]
    assert [c["name"] for c in bo_data["attention"]["stale_credentials"]] == ["web-ci"]
    assert bo_data["attention"]["expired"] == [] and bo_data["attention"]["failing_integrations"] == []


@pytest.mark.asyncio
async def test_activity_stats_buckets_by_day_with_zero_fill(world):
    factory, w = world
    days = await _get(factory, w["ana"], "/api/v1/me/activity-stats?days=7")

    assert len(days) == 7
    assert days[-1]["date"] == NOW.date().isoformat()
    by_date = {d["date"]: d for d in days}
    yesterday = by_date[(NOW - timedelta(days=1)).date().isoformat()]
    assert yesterday == {"date": yesterday["date"], "changes": 2, "other": 0}
    assert by_date[NOW.date().isoformat()] == {"date": NOW.date().isoformat(), "changes": 0, "other": 1}
    # cy's push today is not counted for ana
    assert sum(d["changes"] + d["other"] for d in days) == 3
