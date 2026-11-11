"""GET /api/v1/me/audit (UX.5a): audit events across every project the user belongs to.

Real SQLite DB: membership, restricted environments and each project's plan window
decide what shows up, so none of it is mocked.
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
from app.models.audit import AuditLog
from app.models.environment import Environment
from app.models.member import ProjectMember
from app.models.project import Project
from app.models.user import User


@compiles(CITEXT, "sqlite")
def _compile_citext_sqlite(element, compiler, **kw):
    return "TEXT"


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(element, compiler, **kw):
    return "JSON"


NOW = datetime.now(timezone.utc)


def _user(name, plan=None):
    return User(id=uuid4(), email=f"{name}@example.com", name=name.title(), plan=plan,
                password_hash="", kdf_salt="salt", email_verified=True)


def _log(name, user, project, action, *, ago, resource_id=None, meta=None):
    return name, AuditLog(
        id=uuid4(), user_id=user.id if user else None, project_id=project.id, action=action,
        resource_type=action.split(".")[0], resource_id=resource_id, meta=meta or {},
        created_at=NOW - ago,
    )


@pytest_asyncio.fixture
async def world():
    """ana (Max) owns `api`, which has a restricted `ops` environment; dan is a developer there.
    bo (Free: 7 days of history) owns `web`, where ana is a viewer. cy's project is private."""
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    ana, bo, cy, dan = _user("ana", "max"), _user("bo", "free"), _user("cy", "max"), _user("dan")
    api = Project(id=uuid4(), owner_id=ana.id, name="api", slug="api", settings={})
    web = Project(id=uuid4(), owner_id=bo.id, name="web", slug="web", settings={})
    private = Project(id=uuid4(), owner_id=cy.id, name="private", slug="private", settings={})
    prod = Environment(id=uuid4(), project_id=api.id, name="production", is_default=True)
    ops = Environment(id=uuid4(), project_id=api.id, name="ops", restricted=True)

    logs = dict([
        _log("pushed_prod", ana, api, "vault.pushed", ago=timedelta(days=1), resource_id=prod.id),
        _log("pushed_ops", ana, api, "vault.pushed", ago=timedelta(hours=2), resource_id=ops.id),
        _log("ci_rotated", None, api, "secret.rotated", ago=timedelta(days=3), resource_id=prod.id,
             meta={"auth_type": "ci_session"}),
        _log("dan_added", dan, api, "member.added", ago=timedelta(days=10), meta={"auth_type": "session"}),
        _log("web_updated", bo, web, "project.updated", ago=timedelta(days=1, hours=1)),
        _log("web_created", bo, web, "project.created", ago=timedelta(days=8)),  # outside Free's window
        _log("private_pushed", cy, private, "vault.pushed", ago=timedelta(minutes=5)),
    ])

    async with factory() as db:
        db.add_all([ana, bo, cy, dan, api, web, private, prod, ops])
        db.add_all([
            ProjectMember(id=uuid4(), project_id=api.id, user_id=ana.id, role="owner"),
            ProjectMember(id=uuid4(), project_id=api.id, user_id=dan.id, role="developer"),
            ProjectMember(id=uuid4(), project_id=web.id, user_id=bo.id, role="owner"),
            ProjectMember(id=uuid4(), project_id=web.id, user_id=ana.id, role="viewer"),
            ProjectMember(id=uuid4(), project_id=private.id, user_id=cy.id, role="owner"),
        ])
        db.add_all(logs.values())
        await db.commit()

    ids = {str(log.id): name for name, log in logs.items()}
    yield factory, {"ana": ana, "bo": bo, "cy": cy, "dan": dan, "api": api, "web": web,
                    "private": private}, ids
    await engine.dispose()


async def _get(factory, user, path, params=None):
    async def _get_db():
        async with factory() as db:
            yield db

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_user] = lambda: MagicMock(id=user.id)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(path, params=params, headers={"Authorization": "Bearer test"})
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
    assert response.status_code == 200, response.text
    return response.json()


async def _names(factory, user, ids, **params):
    data = await _get(factory, user, "/api/v1/me/audit", params)
    return [ids[log["id"]] for log in data["logs"]]


@pytest.mark.asyncio
async def test_me_audit_lists_only_member_projects_newest_first(world):
    factory, w, ids = world
    assert await _names(factory, w["ana"], ids) == [
        "pushed_ops", "pushed_prod", "web_updated", "ci_rotated", "dan_added",
    ]
    assert await _names(factory, w["cy"], ids) == ["private_pushed"]


@pytest.mark.asyncio
async def test_me_audit_hides_restricted_environment_from_developer(world):
    factory, w, ids = world
    assert await _names(factory, w["dan"], ids) == ["pushed_prod", "ci_rotated", "dan_added"]


@pytest.mark.asyncio
async def test_me_audit_respects_plan_window_per_project(world):
    factory, w, ids = world
    # bo is on Free (7 days): the 8-day-old event is gone; ana's Max project keeps the 10-day one.
    assert await _names(factory, w["bo"], ids) == ["web_updated"]
    assert "dan_added" in await _names(factory, w["ana"], ids)


@pytest.mark.asyncio
async def test_me_audit_filters(world):
    factory, w, ids = world
    ana = w["ana"]
    assert await _names(factory, ana, ids, project_id=str(w["web"].id)) == ["web_updated"]
    assert await _names(factory, ana, ids, action="vault.pushed") == ["pushed_ops", "pushed_prod"]
    assert await _names(factory, ana, ids, auth_type="ci_session") == ["ci_rotated"]
    # A log without auth_type in its metadata is a session action.
    assert await _names(factory, ana, ids, auth_type="session") == [
        "pushed_ops", "pushed_prod", "web_updated", "dan_added",
    ]
    assert await _names(factory, ana, ids, actor_id=str(w["dan"].id)) == ["dan_added"]
    cutoff = (NOW - timedelta(days=2)).isoformat()
    assert await _names(factory, ana, ids, **{"from": cutoff}) == ["pushed_ops", "pushed_prod", "web_updated"]
    assert await _names(factory, ana, ids, to=cutoff) == ["ci_rotated", "dan_added"]


@pytest.mark.asyncio
async def test_me_audit_project_filter_never_reaches_another_users_project(world):
    factory, w, ids = world
    data = await _get(factory, w["ana"], "/api/v1/me/audit", {"project_id": str(w["private"].id)})
    assert data["logs"] == [] and data["total"] == 0


@pytest.mark.asyncio
async def test_me_audit_paginates_and_resolves_actors(world):
    factory, w, ids = world
    data = await _get(factory, w["ana"], "/api/v1/me/audit", {"page": 2, "per_page": 2})
    assert (data["total"], data["page"], data["per_page"]) == (5, 2, 2)
    assert [ids[log["id"]] for log in data["logs"]] == ["web_updated", "ci_rotated"]
    web_updated, ci_rotated = data["logs"]
    assert web_updated["actor"]["name"] == "Bo" and web_updated["auth_type"] == "session"
    assert ci_rotated["actor"] is None and ci_rotated["auth_type"] == "ci_session"


@pytest.mark.asyncio
async def test_dashboard_aggregates_follow_the_same_rules_as_me_audit(world):
    """The 30-day chart and `last_activity_at` must not reveal a push to a restricted environment
    (or anything outside the plan window) that /me/audit hides."""
    factory, w, _ = world
    days = await _get(factory, w["dan"], "/api/v1/me/activity-stats", {"days": 30})
    assert sum(d["changes"] + d["other"] for d in days) == 3  # pushed_ops is left out

    overview = await _get(factory, w["dan"], "/api/v1/me/overview")
    api = next(p for p in overview["projects"] if p["name"] == "api")
    # newest visible event is pushed_prod (1 day ago), not pushed_ops (2 hours ago)
    assert datetime.fromisoformat(api["last_activity_at"]) < NOW - timedelta(hours=12)

    bo_days = await _get(factory, w["bo"], "/api/v1/me/activity-stats", {"days": 30})
    assert sum(d["changes"] + d["other"] for d in bo_days) == 1  # web_created is outside Free's window


@pytest.mark.asyncio
async def test_me_audit_rejects_unknown_auth_type(world):
    factory, w, _ = world

    async def _get_db():
        async with factory() as db:
            yield db

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_user] = lambda: MagicMock(id=w["ana"].id)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/me/audit", params={"auth_type": "root"})
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 422
