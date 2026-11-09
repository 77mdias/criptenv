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
from app.services.plan_limits import PlanLimits
from app.strategies.exceptions import PlanLimitReached

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
