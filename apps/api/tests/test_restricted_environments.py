"""Restricted environments: an extra environment only the project's owner and admins can reach.

For anyone else it does not exist: absent from lists, 404 when asked for.
Spec: docs/superpowers/specs/2026-11-10-restricted-environments-design.md
"""
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import func, select

from app.middleware.auth import AuthContext, get_current_auth_context, get_current_user, get_current_user_or_api_key
from app.models.environment import Environment
from app.models.member import ProjectMember
from app.models.project import Project
from app.models.user import User
from app.services.environment_access import credential_reaches, sees_restricted
from app.services.plan_limits import PlanLimits
from app.strategies.exceptions import PlanLimitReached
from main import app

pytestmark = pytest.mark.asyncio

SEEDED = ("production", "staging", "development")


def _user(plan=None):
    uid = uuid4()
    return User(id=uid, email=f"{uid.hex[:8]}@example.com", name="Ana", password_hash="",
                kdf_salt="salt", email_verified=True, plan=plan)


def _env(project, name, **fields):
    return Environment(id=uuid4(), project_id=project.id, name=name, **fields)


def _member(project, user, role):
    return ProjectMember(id=uuid4(), project_id=project.id, user_id=user.id, role=role)


def _as(user):
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_current_user_or_api_key] = lambda: user
    app.dependency_overrides[get_current_auth_context] = lambda: AuthContext(user=user, auth_type="session")


@pytest.fixture(autouse=True)
def _drop_overrides():
    yield
    app.dependency_overrides.pop(get_current_user_or_api_key, None)
    app.dependency_overrides.pop(get_current_auth_context, None)


@pytest_asyncio.fixture
async def seed(factory):
    async def _seed(*rows):
        async with factory() as db:
            db.add_all(rows)
            await db.commit()
    return _seed


@pytest_asyncio.fixture
async def world(seed):
    """Ana owns a project on Max with the three seeded environments plus a restricted `db-admin`;
    Bia is an admin and Caio a developer of it."""
    ana, bia, caio = _user(plan="max"), _user(), _user()
    pid = uuid4()
    project = Project(id=pid, owner_id=ana.id, name="App", slug=f"app-{pid.hex[:6]}")
    seeded = [_env(project, name, is_default=(name == "production")) for name in SEEDED]
    secret = _env(project, "db-admin", restricted=True)
    await seed(
        ana, bia, caio, project, *seeded, secret,
        _member(project, ana, "owner"), _member(project, bia, "admin"), _member(project, caio, "developer"),
    )

    class World:
        pass

    w = World()
    w.ana, w.bia, w.caio, w.project, w.secret = ana, bia, caio, project, secret
    w.envs = {env.name: env for env in seeded}
    w.url = f"/api/v1/projects/{pid}/environments"
    return w


# ─── The rule ────────────────────────────────────────────────────────────────


async def test_sees_restricted_only_owner_and_admin():
    assert sees_restricted("owner") and sees_restricted("admin")
    assert not sees_restricted("developer") and not sees_restricted("viewer") and not sees_restricted(None)


async def test_credential_reaches():
    project = Project(id=uuid4())
    open_env, restricted = _env(project, "staging", restricted=False), _env(project, "db-admin", restricted=True)
    assert credential_reaches(open_env, None) and credential_reaches(open_env, "staging")
    assert not credential_reaches(open_env, "production")
    assert credential_reaches(restricted, "db-admin")
    assert not credential_reaches(restricted, None) and not credential_reaches(restricted, "production")


# ─── Creating, seeing, changing ──────────────────────────────────────────────


async def test_create_restricted_environment_and_admin_sees_it(client, world):
    _as(world.bia)

    created = await client.post(world.url, json={"name": "backup", "restricted": True})

    assert (created.status_code, created.json()["restricted"]) == (201, True)
    names = {env["name"]: env["restricted"] for env in (await client.get(world.url)).json()["environments"]}
    assert names == {"production": False, "staging": False, "development": False, "db-admin": True, "backup": True}


async def test_developer_does_not_see_a_restricted_environment(client, world):
    _as(world.caio)

    listed = (await client.get(world.url)).json()

    assert sorted(env["name"] for env in listed["environments"]) == sorted(SEEDED)
    assert listed["total"] == 3
    assert (await client.get(f"{world.url}/{world.secret.id}")).status_code == 404
    assert (await client.get(f"{world.url}/{world.envs['staging'].id}")).status_code == 200


@pytest.mark.parametrize("name", SEEDED)
async def test_seeded_environments_cannot_be_restricted(client, world, name):
    _as(world.ana)

    response = await client.patch(f"{world.url}/{world.envs[name].id}", json={"restricted": True})

    assert response.status_code == 422


async def test_seeded_names_cannot_be_created_restricted(client, seed):
    ana = _user(plan="max")
    pid = uuid4()
    project = Project(id=pid, owner_id=ana.id, name="App", slug=f"app-{pid.hex[:6]}")
    await seed(ana, project, _member(project, ana, "owner"))
    _as(ana)

    response = await client.post(f"/api/v1/projects/{pid}/environments", json={"name": "staging", "restricted": True})

    assert response.status_code == 422


async def test_default_environment_cannot_be_restricted(client, world, seed):
    default_extra = _env(world.project, "main", is_default=True)
    await seed(default_extra)
    _as(world.ana)

    patched = await client.patch(f"{world.url}/{default_extra.id}", json={"restricted": True})
    created = await client.post(world.url, json={"name": "other", "is_default": True, "restricted": True})

    assert (patched.status_code, created.status_code) == (422, 422)


async def test_restricted_environment_cannot_become_default(client, world):
    _as(world.ana)

    response = await client.patch(f"{world.url}/{world.secret.id}", json={"is_default": True})

    assert response.status_code == 422


async def test_admin_can_open_a_restricted_environment_again(client, world):
    _as(world.bia)
    opened = await client.patch(f"{world.url}/{world.secret.id}", json={"restricted": False})
    assert (opened.status_code, opened.json()["restricted"]) == (200, False)

    _as(world.caio)
    assert "db-admin" in [env["name"] for env in (await client.get(world.url)).json()["environments"]]


async def test_developer_cannot_change_the_restriction(client, world):
    _as(world.caio)

    response = await client.patch(f"{world.url}/{world.envs['staging'].id}", json={"display_name": "x"})

    assert response.status_code == 404


# ─── Limits: 3, 5 and 7 ──────────────────────────────────────────────────────


async def _project_with(db, plan, total):
    """A project with `total` environments: the seeded three first, then restricted extras."""
    owner = _user(plan=plan)
    pid = uuid4()
    project = Project(id=pid, owner_id=owner.id, name="App", slug=f"app-{pid.hex[:6]}")
    names = [*SEEDED, *[f"extra-{i}" for i in range(20)]][:total]
    db.add_all([owner, project, *[_env(project, name, restricted=name not in SEEDED) for name in names]])
    await db.flush()
    return owner, project


@pytest.mark.parametrize("plan,allowed", [(None, 3), ("pro", 5), ("max", 7)])
async def test_environment_limit_per_plan(db_session, plan, allowed):
    _, below = await _project_with(db_session, plan, allowed - 1)
    await PlanLimits(db_session).check_environments(below.id)

    _, full = await _project_with(db_session, plan, allowed)
    with pytest.raises(PlanLimitReached) as exc:
        await PlanLimits(db_session).check_environments(full.id)
    assert (exc.value.key, exc.value.limit) == ("environments_per_project", allowed)


async def test_unlimited_has_no_environment_limit(db_session):
    _, project = await _project_with(db_session, "unlimited", 23)
    await PlanLimits(db_session).check_environments(project.id)


async def test_back_on_free_with_5_keeps_them_and_refuses_the_sixth(db_session):
    owner, project = await _project_with(db_session, "pro", 5)
    owner.plan = None
    await db_session.flush()

    with pytest.raises(PlanLimitReached):
        await PlanLimits(db_session).check_environments(project.id)

    kept = await db_session.scalar(
        select(func.count()).select_from(Environment).where(Environment.project_id == project.id)
    )
    still_restricted = await db_session.scalar(
        select(func.count()).select_from(Environment)
        .where(Environment.project_id == project.id, Environment.restricted.is_(True))
    )
    assert (kept, still_restricted) == (5, 2)
