"""What the Max plan promises: auto-sync binding, deleting at the provider, deploy, CI sync.

Real SQLite DB and the real app (fixtures in conftest.py). Providers never make
an HTTP call here: sync tests swap the provider for a recording double.
"""
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import select, update

from app.middleware.auth import get_current_user
from app.models.environment import Environment
from app.models.integration import Integration
from app.models.member import ProjectMember
from app.models.project import Project
from app.models.user import User
from app.routers import integrations as integrations_router
from main import app

pytestmark = pytest.mark.asyncio

CONFIGS = {
    "vercel": {"api_token": "vercel-token-123", "project_id": "prj_1"},
    "render": {"api_token": "render-token-123", "service_id": "srv_1"},
    "cloudflare": {"api_token": "cf-token-12345", "account_id": "acc_1", "script_name": "worker"},
}
ALL_FEATURES = ["auto_sync", "ci_sync", "sync_redeploy"]


def _user(plan=None):
    uid = uuid4()
    return User(id=uid, email=f"{uid.hex[:8]}@example.com", name="Ana", password_hash="",
                kdf_salt="salt", email_verified=True, plan=plan)


def _env(project, name, archived=False):
    return Environment(id=uuid4(), project_id=project.id, name=name, archived=archived)


def _member(project, user, role="developer"):
    return ProjectMember(id=uuid4(), project_id=project.id, user_id=user.id, role=role)


def _as(user):
    """Act as this user, both where the route depends on get_current_user and where it calls it."""
    async def _current_user(request=None, db=None):
        return user

    app.dependency_overrides[get_current_user] = lambda: user
    integrations_router.get_current_user = _current_user


@pytest.fixture(autouse=True)
def _restore_router_auth():
    yield
    integrations_router.get_current_user = get_current_user


@pytest_asyncio.fixture
async def db(factory):
    """Run one statement or add rows in a committed session of its own."""
    async def _run(*rows, stmt=None):
        async with factory() as session:
            session.add_all(rows)
            result = await session.execute(stmt) if stmt is not None else None
            await session.commit()
            return result
    return _run


@pytest_asyncio.fixture
async def world(db):
    """A project with production and staging; `world(plan)` returns (owner, project, envs by name)."""
    async def _world(plan=None):
        owner = _user(plan)
        pid = uuid4()
        project = Project(id=pid, owner_id=owner.id, name=f"p-{pid.hex[:6]}", slug=f"p-{pid.hex[:6]}")
        envs = {name: _env(project, name) for name in ("production", "staging")}
        await db(owner, project, _member(project, owner, "owner"), *envs.values())
        _as(owner)
        return owner, project, {name: str(env.id) for name, env in envs.items()}
    return _world


async def _connect(client, project, provider="vercel"):
    r = await client.post(
        f"/api/v1/projects/{project.id}/integrations",
        json={"provider": provider, "name": f"{provider} conn", "config": CONFIGS[provider]},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _set_plan(db, user, plan):
    await db(stmt=update(User).where(User.id == user.id).values(plan=plan))


def _url(project, integration=None, suffix=""):
    base = f"/api/v1/projects/{project.id}/integrations"
    return f"{base}/{integration['id']}{suffix}" if integration else base


# ─── Settings: binding environments to targets, and the deploy option ────────


async def test_patch_binds_environment_to_target_on_a_max_project(client, world):
    _, project, envs = await world("max")
    conn = await _connect(client, project)
    assert conn["auto_sync_targets"] == {}

    r = await client.patch(_url(project, conn), json={"auto_sync_targets": {envs["staging"]: "preview"}})

    assert (r.status_code, r.json()["auto_sync_targets"]) == (200, {envs["staging"]: "preview"})
    listing = (await client.get(_url(project))).json()
    assert listing["integrations"][0]["auto_sync_targets"] == {envs["staging"]: "preview"}
    assert listing["features"] == ALL_FEATURES


@pytest.mark.parametrize("plan", [None, "pro"])
async def test_patch_turning_auto_sync_on_needs_max(client, world, plan):
    _, project, envs = await world(plan)
    conn = await _connect(client, project)

    r = await client.patch(_url(project, conn), json={"auto_sync_targets": {envs["production"]: "production"}})

    assert (r.status_code, r.json()) == (402, {"detail": "Plan feature required: auto_sync"})
    assert (await client.get(_url(project, conn))).json()["auto_sync_targets"] == {}


@pytest.mark.parametrize("plan", [None, "pro"])
async def test_patch_redeploy_on_needs_max(client, world, plan):
    _, project, _ = await world(plan)
    conn = await _connect(client, project)

    r = await client.patch(_url(project, conn), json={"redeploy": True})

    assert (r.status_code, r.json()) == (402, {"detail": "Plan feature required: sync_redeploy"})


async def test_patch_turning_things_off_never_checks_plan(client, world, db):
    owner, project, envs = await world("max")
    conn = await _connect(client, project)
    await client.patch(_url(project, conn), json={"auto_sync_targets": {envs["production"]: "production"}})
    await _set_plan(db, owner, None)

    r = await client.patch(_url(project, conn), json={"auto_sync_targets": {}, "redeploy": False})

    assert (r.status_code, r.json()["auto_sync_targets"], r.json()["redeploy"]) == (200, {}, False)


async def test_downgrade_keeps_the_binding_stored(client, world, db):
    owner, project, envs = await world("max")
    conn = await _connect(client, project)
    await client.patch(_url(project, conn), json={"auto_sync_targets": {envs["production"]: "production"}})
    await _set_plan(db, owner, None)

    listing = (await client.get(_url(project))).json()

    assert listing["features"] == []
    assert listing["integrations"][0]["auto_sync_targets"] == {envs["production"]: "production"}
    assert listing["integrations"][0]["redeploy"] is True


async def test_patch_changes_only_the_field_it_sends(client, world):
    _, project, envs = await world("max")
    conn = await _connect(client, project)
    await client.patch(_url(project, conn), json={"auto_sync_targets": {envs["production"]: "production"}})

    r = await client.patch(_url(project, conn), json={"redeploy": False})

    assert (r.json()["auto_sync_targets"], r.json()["redeploy"]) == ({envs["production"]: "production"}, False)


async def test_patch_rejects_environment_of_another_project(client, world, db):
    _, project, _ = await world("max")
    conn = await _connect(client, project)
    other = Project(id=uuid4(), owner_id=uuid4(), name="other", slug="other")
    foreign = _env(other, "production")
    await db(other, foreign)

    r = await client.patch(_url(project, conn), json={"auto_sync_targets": {str(foreign.id): "production"}})

    assert r.status_code == 422


async def test_patch_rejects_archived_environment_and_unknown_target(client, world, db):
    _, project, envs = await world("max")
    conn = await _connect(client, project)
    archived = _env(project, "old", archived=True)
    await db(archived)

    r1 = await client.patch(_url(project, conn), json={"auto_sync_targets": {str(archived.id): "production"}})
    r2 = await client.patch(_url(project, conn), json={"auto_sync_targets": {envs["production"]: "staging"}})

    assert (r1.status_code, r2.status_code) == (422, 422)
    assert "staging" in r2.json()["detail"]


async def test_render_binds_only_to_production(client, world):
    _, project, envs = await world("max")
    conn = await _connect(client, project, "render")

    ok = await client.patch(_url(project, conn), json={"auto_sync_targets": {envs["staging"]: "production"}})
    bad = await client.patch(_url(project, conn), json={"auto_sync_targets": {envs["staging"]: "preview"}})

    assert (ok.status_code, bad.status_code) == (200, 422)


async def test_patch_needs_admin_and_an_existing_integration(client, world, db):
    _, project, envs = await world("max")
    conn = await _connect(client, project)
    dev = _user()
    await db(dev, _member(project, dev, "developer"))

    missing = await client.patch(f"{_url(project)}/{uuid4()}", json={"redeploy": False})
    _as(dev)
    forbidden = await client.patch(_url(project, conn), json={"auto_sync_targets": {envs["production"]: "production"}})

    assert (missing.status_code, forbidden.status_code) == (404, 404)


async def test_patch_is_audited_without_environment_ids(client, world, factory):
    from app.models.audit import AuditLog

    _, project, envs = await world("max")
    conn = await _connect(client, project)
    await client.patch(_url(project, conn), json={"auto_sync_targets": {envs["production"]: "production"}})

    async with factory() as session:
        log = (await session.execute(select(AuditLog).where(AuditLog.action == "integration.updated"))).scalar_one()
    assert log.meta == {"auto_sync_environments": 1, "redeploy": True}
    assert log.resource_id is not None


@pytest.mark.parametrize("plan, expected", [("max", True), ("unlimited", True), ("pro", False), (None, False)])
async def test_new_connection_redeploys_by_default_only_with_the_feature(client, world, plan, expected):
    _, project, _ = await world(plan)
    assert (await _connect(client, project))["redeploy"] is expected
