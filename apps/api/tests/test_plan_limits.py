"""Plan limits: what counts toward each limit, whose plan applies, and the 402 on create.

Real SQLite DB (fixtures in conftest.py): the limits are counts of rows.
"""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.models.audit import AuditLog
from app.models.environment import Environment
from app.models.integration import Integration
from app.models.member import ProjectInvite, ProjectMember
from app.models.project import Project
from app.models.user import User
from app.plans import AUTO_SYNC, CI_SYNC, SYNC_REDEPLOY
from app.services.plan_limits import PlanLimits
from app.strategies.exceptions import PlanFeatureRequired, PlanLimitReached

pytestmark = pytest.mark.asyncio


def _user(plan=None):
    uid = uuid4()
    return User(id=uid, email=f"{uid.hex[:8]}@example.com", name="Ana", password_hash="",
                kdf_salt="salt", email_verified=True, plan=plan)


def _project(owner, archived=False):
    """A project with its owner's membership, as ProjectService.create_project leaves it (no environments)."""
    pid = uuid4()
    project = Project(id=pid, owner_id=owner.id, name=f"p-{pid.hex[:6]}", slug=f"p-{pid.hex[:6]}", archived=archived)
    return project, ProjectMember(id=uuid4(), project_id=pid, user_id=owner.id, role="owner")


def _env(project, name=None, archived=False):
    return Environment(id=uuid4(), project_id=project.id, name=name or f"e-{uuid4().hex[:6]}", archived=archived)


def _member(project, user, role="developer"):
    return ProjectMember(id=uuid4(), project_id=project.id, user_id=user.id, role=role)


def _invite(project, *, expires_in=timedelta(days=7), revoked=False, accepted=False):
    now = datetime.now(timezone.utc)
    return ProjectInvite(
        id=uuid4(), project_id=project.id, email=f"{uuid4().hex[:8]}@example.com", role="developer",
        token=uuid4().hex, expires_at=now + expires_in,
        revoked_at=now if revoked else None, accepted_at=now if accepted else None,
    )


def _integration(project):
    return Integration(id=uuid4(), project_id=project.id, provider="vercel", name="v", config={})


async def _save(db, *rows):
    flat = [r for row in rows for r in (row if isinstance(row, tuple) else (row,))]
    db.add_all(flat)
    await db.flush()


def _raised(exc):
    return exc.value.status_code, exc.value.key, exc.value.limit


# ─── PlanLimits: what counts ────────────────────────────────────────────────


async def test_projects_limit_counts_owned_projects_including_archived(db_session):
    ana = _user()
    await _save(db_session, ana, _project(ana), _project(ana), _project(ana, archived=True))
    with pytest.raises(PlanLimitReached) as exc:
        await PlanLimits(db_session).check_projects(ana)
    assert _raised(exc) == (402, "projects", 3)
    assert exc.value.detail == "Plan limit reached: projects (3)"


async def test_projects_of_other_owners_do_not_count(db_session):
    ana, bia = _user(), _user()
    projects = [_project(bia) for _ in range(3)]
    await _save(db_session, ana, bia, *projects, *[_member(p, ana) for p, _ in projects])
    await PlanLimits(db_session).check_projects(ana)


async def test_archived_environments_do_not_count(db_session):
    ana = _user()
    project, owner = _project(ana)
    await _save(db_session, ana, project, owner, _env(project), _env(project), _env(project, archived=True))
    limits = PlanLimits(db_session)
    await limits.check_environments(project.id)
    await _save(db_session, _env(project))
    with pytest.raises(PlanLimitReached) as exc:
        await limits.check_environments(project.id)
    assert _raised(exc) == (402, "environments_per_project", 3)


async def test_members_count_owner_and_pending_invites(db_session):
    ana, bia = _user(), _user()
    project, owner = _project(ana)
    await _save(db_session, ana, bia, project, owner, _member(project, bia), _invite(project))
    limits = PlanLimits(db_session)
    with pytest.raises(PlanLimitReached) as exc:
        await limits.check_members(project.id)
    assert _raised(exc) == (402, "members_per_project", 3)
    # Accepting that pending invite adds nobody new to the count.
    await limits.check_members(project.id, adding=0)


async def test_expired_revoked_and_accepted_invites_do_not_count(db_session):
    ana, bia = _user(), _user()
    project, owner = _project(ana)
    await _save(
        db_session, ana, bia, project, owner, _member(project, bia),
        _invite(project, expires_in=timedelta(days=-1)), _invite(project, revoked=True), _invite(project, accepted=True),
    )
    await PlanLimits(db_session).check_members(project.id)


async def test_per_project_limits_follow_the_owner_plan(db_session):
    ana = _user(plan="pro")
    project, owner = _project(ana)
    others = [_user() for _ in range(9)]
    await _save(
        db_session, ana, project, owner, *others, *[_member(project, u) for u in others],
        *[_env(project) for _ in range(3)], _integration(project),
    )
    limits = PlanLimits(db_session)
    await limits.check_environments(project.id)
    await limits.check_integrations(project.id)
    with pytest.raises(PlanLimitReached) as exc:
        await limits.check_members(project.id)
    assert _raised(exc) == (402, "members_per_project", 10)


async def test_second_integration_is_over_the_free_limit(db_session):
    ana = _user()
    project, owner = _project(ana)
    await _save(db_session, ana, project, owner)
    limits = PlanLimits(db_session)
    await limits.check_integrations(project.id)
    await _save(db_session, _integration(project))
    with pytest.raises(PlanLimitReached) as exc:
        await limits.check_integrations(project.id)
    assert _raised(exc) == (402, "integrations_per_project", 1)


async def test_feature_follows_the_owner_plan_not_the_actor(db_session):
    owner, member = _user(plan="max"), _user()  # the member is on Free
    project, membership = _project(owner)
    await _save(db_session, owner, member, project, membership, _member(project, member))
    limits = PlanLimits(db_session)
    assert await limits.has_feature(project.id, AUTO_SYNC) is True
    await limits.require_feature(project.id, CI_SYNC)


@pytest.mark.parametrize("plan", [None, "free", "pro"])
async def test_feature_missing_is_402(db_session, plan):
    ana = _user(plan=plan)
    project, owner = _project(ana)
    await _save(db_session, ana, project, owner)
    limits = PlanLimits(db_session)
    assert await limits.has_feature(project.id, SYNC_REDEPLOY) is False
    with pytest.raises(PlanFeatureRequired) as exc:
        await limits.require_feature(project.id, SYNC_REDEPLOY)
    assert (exc.value.status_code, exc.value.feature) == (402, "sync_redeploy")
    assert exc.value.detail == "Plan feature required: sync_redeploy"


async def test_unlimited_has_every_sync_feature(db_session):
    ana = _user(plan="unlimited")
    project, owner = _project(ana)
    await _save(db_session, ana, project, owner)
    limits = PlanLimits(db_session)
    for feature in (AUTO_SYNC, SYNC_REDEPLOY, CI_SYNC):
        await limits.require_feature(project.id, feature)


async def test_new_integration_has_no_binding_and_no_redeploy(db_session):
    ana = _user()
    project, owner = _project(ana)
    integration = _integration(project)
    await _save(db_session, ana, project, owner, integration)
    await db_session.refresh(integration)
    assert (integration.auto_sync_targets, integration.redeploy, integration.deploy_due_at) == ({}, False, None)


async def test_unlimited_plan_never_raises(db_session):
    ana = _user(plan="unlimited")
    projects = [_project(ana) for _ in range(5)]
    first = projects[0][0]
    await _save(db_session, ana, *projects, *[_env(first) for _ in range(6)], _integration(first), _integration(first))
    limits = PlanLimits(db_session)
    await limits.check_projects(ana)
    await limits.check_environments(first.id)
    await limits.check_members(first.id)
    await limits.check_integrations(first.id)
    assert await limits.audit_since(first.id) is None


@pytest.mark.parametrize("plan,days", [(None, 7), ("pro", 30), ("max", 90)])
async def test_audit_since_is_the_owner_plan_window(db_session, plan, days):
    ana = _user(plan=plan)
    project, owner = _project(ana)
    await _save(db_session, ana, project, owner)
    since = await PlanLimits(db_session).audit_since(project.id)
    expected = datetime.now(timezone.utc) - timedelta(days=days)
    assert abs((since - expected).total_seconds()) < 5


async def test_usage(db_session):
    ana, bia = _user(), _user()
    project, owner = _project(ana)
    other = _project(ana)
    await _save(
        db_session, ana, bia, project, owner, other, _member(project, bia),
        *[_env(project) for _ in range(3)], _env(project, archived=True), _integration(project),
        _invite(project, revoked=True),
    )
    limits = PlanLimits(db_session)
    assert await limits.user_usage(ana.id) == {"projects": 2}
    assert await limits.user_usage(bia.id) == {"projects": 0}
    assert await limits.project_usage(project.id) == {
        "environments_per_project": 3, "members_per_project": 2, "integrations_per_project": 1,
    }


# ─── Routes: creating is blocked at the limit, nothing else is ───────────────

import pytest_asyncio  # noqa: E402
from sqlalchemy import func, select  # noqa: E402

from app.middleware.auth import (  # noqa: E402
    AuthContext,
    get_current_auth_context,
    get_current_user,
    get_current_user_or_api_key,
)
from app.routers import invites as invites_router  # noqa: E402
from main import app  # noqa: E402

_PROJECT_BODY = {
    "vault_config": {"salt": "s", "proof_salt": "p", "verifier_iv": "i",
                     "verifier_ciphertext": "c", "verifier_auth_tag": "t"},
    "vault_proof": "proof",
}
_DEFAULT_ENVS = ("production", "staging", "development")


@pytest_asyncio.fixture
async def seed(factory):
    async def _seed(*rows):
        async with factory() as db:
            await _save(db, *rows)
            await db.commit()
    return _seed


@pytest_asyncio.fixture
async def count(factory):
    async def _count(model, *where):
        async with factory() as db:
            return await db.scalar(select(func.count()).select_from(model).where(*where))
    return _count


@pytest.fixture(autouse=True)
def _drop_api_key_override():
    yield
    app.dependency_overrides.pop(get_current_user_or_api_key, None)
    app.dependency_overrides.pop(get_current_auth_context, None)


def _as(user):
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_current_user_or_api_key] = lambda: user
    app.dependency_overrides[get_current_auth_context] = lambda: AuthContext(user=user, auth_type="session")


def _project_with_envs(owner):
    project, membership = _project(owner)
    return project, (project, membership, *[_env(project, name) for name in _DEFAULT_ENVS])


async def test_fourth_project_is_402_on_free(client, seed):
    ana = _user()
    await seed(ana)
    _as(ana)
    for n in range(3):
        assert (await client.post("/api/v1/projects", json={"name": f"app {n}", **_PROJECT_BODY})).status_code == 201
    r = await client.post("/api/v1/projects", json={"name": "app 3", **_PROJECT_BODY})
    assert r.status_code == 402
    assert r.json() == {"detail": "Plan limit reached: projects (3)"}


async def test_over_limit_account_keeps_read_edit_delete(client, seed):
    ana = _user()
    projects = [_project(ana) for _ in range(4)]
    await seed(ana, *projects)
    _as(ana)
    ids = [str(p.id) for p, _ in projects]

    assert (await client.get("/api/v1/projects")).json()["total"] == 4
    assert (await client.get(f"/api/v1/projects/{ids[0]}")).status_code == 200
    assert (await client.patch(f"/api/v1/projects/{ids[0]}", json={"description": "still mine"})).status_code == 200
    assert (await client.delete(f"/api/v1/projects/{ids[3]}")).status_code == 204
    # Back at the limit, not under it.
    assert (await client.post("/api/v1/projects", json={"name": "new", **_PROJECT_BODY})).status_code == 402
    assert (await client.delete(f"/api/v1/projects/{ids[2]}")).status_code == 204
    assert (await client.post("/api/v1/projects", json={"name": "new", **_PROJECT_BODY})).status_code == 201


async def test_fourth_environment_is_402_and_retry_of_existing_name_is_409(client, seed):
    ana = _user()
    project, rows = _project_with_envs(ana)
    await seed(ana, rows)
    _as(ana)
    url = f"/api/v1/projects/{project.id}/environments"
    r = await client.post(url, json={"name": "qa"})
    assert (r.status_code, r.json()) == (402, {"detail": "Plan limit reached: environments_per_project (3)"})
    # A retry of a create that already happened is a duplicate, not a limit.
    assert (await client.post(url, json={"name": "staging"})).status_code == 409


async def test_archiving_an_environment_frees_a_slot(client, seed):
    ana = _user()
    project, rows = _project_with_envs(ana)
    await seed(ana, rows)
    _as(ana)
    url = f"/api/v1/projects/{project.id}/environments"
    development = rows[-1]
    assert (await client.delete(f"{url}/{development.id}")).status_code == 204
    assert (await client.post(url, json={"name": "qa"})).status_code == 201


async def test_invite_and_add_member_share_the_members_limit(client, seed, monkeypatch):
    monkeypatch.setattr(invites_router.EmailService, "send_project_invite", lambda self, **kwargs: None)
    ana, bia, carla = _user(), _user(), _user()
    project, rows = _project_with_envs(ana)
    pending = _invite(project)
    await seed(ana, bia, carla, rows, _member(project, bia), pending)
    _as(ana)
    base = f"/api/v1/projects/{project.id}"

    r = await client.post(f"{base}/invites", json={"email": "new@example.com", "role": "developer"})
    assert (r.status_code, r.json()) == (402, {"detail": "Plan limit reached: members_per_project (3)"})
    r = await client.post(f"{base}/members", json={"user_id": str(carla.id), "role": "developer"})
    assert r.status_code == 402
    # Re-sending the invite that is already pending stays a duplicate.
    r = await client.post(f"{base}/invites", json={"email": pending.email, "role": "developer"})
    assert r.status_code == 409


async def test_accept_invite_over_limit_is_402_and_invite_stays_pending(client, seed, count):
    ana, bia, carla, dani = _user(), _user(), _user(), _user()
    project, rows = _project_with_envs(ana)
    invite = _invite(project)
    invite.email = dani.email
    # 3 members plus a pending invite: where an owner lands after going back to free.
    await seed(ana, bia, carla, dani, rows, _member(project, bia), _member(project, carla), invite)
    _as(dani)

    r = await client.post(f"/api/v1/projects/{project.id}/invites/{invite.id}/accept")
    assert r.status_code == 402
    assert await count(ProjectInvite, ProjectInvite.id == invite.id, ProjectInvite.accepted_at.is_(None)) == 1
    assert await count(ProjectMember, ProjectMember.user_id == dani.id) == 0


@pytest.mark.parametrize("plan,second", [(None, 402), ("pro", 201)])
async def test_second_integration_follows_the_owner_plan(client, seed, plan, second):
    ana = _user(plan=plan)
    project, rows = _project_with_envs(ana)
    await seed(ana, rows)
    _as(ana)
    url = f"/api/v1/projects/{project.id}/integrations"
    body = {"provider": "vercel", "name": "Production", "config": {"api_token": "tok", "project_id": "prj"}}
    assert (await client.post(url, json=body)).status_code == 201
    assert (await client.post(url, json={**body, "name": "Preview"})).status_code == second


async def test_member_of_max_owner_is_not_limited_by_own_free_plan(client, seed):
    ana, bia = _user(plan="max"), _user()
    project, rows = _project_with_envs(ana)
    await seed(ana, bia, rows, _env(project, "qa"), _env(project, "demo"), _member(project, bia, role="admin"))
    _as(bia)
    r = await client.post(f"/api/v1/projects/{project.id}/environments", json={"name": "sandbox"})
    assert r.status_code == 201


# ─── Audit history: the plan's window hides older rows, it never deletes them ─


def _log(project, days_ago):
    return AuditLog(id=uuid4(), project_id=project.id, user_id=project.owner_id, action="secret.updated",
                    resource_type="secret", created_at=datetime.now(timezone.utc) - timedelta(days=days_ago))


async def test_audit_list_hides_rows_outside_the_plan_window_without_deleting(client, seed, count, factory):
    ana = _user()
    project, rows = _project_with_envs(ana)
    await seed(ana, rows, *[_log(project, days) for days in (1, 6, 8, 40)])
    _as(ana)
    url = f"/api/v1/projects/{project.id}/audit"

    async def set_plan(plan):
        async with factory() as db:
            (await db.get(User, ana.id)).plan = plan
            await db.commit()

    body = (await client.get(url)).json()
    assert (body["total"], len(body["logs"])) == (2, 2)
    # `total` counts the window, so the last page is never empty.
    page2 = (await client.get(url, params={"page": 2, "per_page": 1})).json()
    assert (page2["total"], len(page2["logs"])) == (2, 1)

    await set_plan("pro")
    assert (await client.get(url)).json()["total"] == 3
    await set_plan("max")
    assert (await client.get(url)).json()["total"] == 4
    await set_plan("unlimited")
    assert (await client.get(url)).json()["total"] == 4
    await set_plan(None)
    assert (await client.get(url)).json()["total"] == 2
    assert await count(AuditLog, AuditLog.project_id == project.id) == 4


# ─── Limits and usage for the web ────────────────────────────────────────────


async def test_me_plan_reports_owned_projects(client, seed):
    ana, bia = _user(), _user()
    theirs = _project(bia)
    await seed(ana, bia, _project(ana), _project(ana), theirs, _member(theirs[0], ana))
    _as(ana)
    body = (await client.get("/api/v1/me/plan")).json()
    assert (body["id"], body["limits"]["projects"], body["usage"]) == ("free", 3, {"projects": 2})


async def test_project_plan_is_the_owner_plan_with_project_usage(client, seed):
    ana, bia = _user(plan="max"), _user()
    project, rows = _project_with_envs(ana)
    await seed(ana, bia, rows, _member(project, bia, role="viewer"))
    _as(bia)
    r = await client.get(f"/api/v1/projects/{project.id}/plan")
    assert r.status_code == 200
    body = r.json()
    assert (body["id"], body["limits"]["members_per_project"], body["limits"]["audit_retention_days"]) == ("max", 25, 90)
    assert body["usage"] == {"environments_per_project": 3, "members_per_project": 2, "integrations_per_project": 0}


async def test_project_plan_is_404_for_non_members(client, seed):
    ana, bia = _user(), _user()
    project, rows = _project_with_envs(ana)
    await seed(ana, bia, rows)
    _as(bia)
    r = await client.get(f"/api/v1/projects/{project.id}/plan")
    assert (r.status_code, r.json()) == (404, {"detail": "Project not found"})


async def test_accept_by_emailed_token_over_limit_is_402_and_invite_stays_pending(client, seed, count):
    ana, bia, carla, dani = _user(), _user(), _user(), _user()
    project, rows = _project_with_envs(ana)
    invite = _invite(project)
    invite.email = dani.email
    await seed(ana, bia, carla, dani, rows, _member(project, bia), _member(project, carla), invite)
    _as(dani)

    r = await client.post("/api/auth/invites/accept", params={"token": invite.token})
    assert (r.status_code, r.json()) == (402, {"detail": "Plan limit reached: members_per_project (3)"})
    assert await count(ProjectInvite, ProjectInvite.id == invite.id, ProjectInvite.accepted_at.is_(None)) == 1
    assert await count(ProjectMember, ProjectMember.user_id == dani.id) == 0
