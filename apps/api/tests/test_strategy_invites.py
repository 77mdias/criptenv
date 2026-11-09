import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.member import ProjectInvite
from app.strategies.exceptions import InvalidInviteTransition, InviteConflict, PermissionDenied
from app.strategies.invite_transitions import AcceptInviteStrategy, RevokeInviteStrategy


class FakeResult:
    def __init__(self, value=None):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeDb:
    def __init__(self, existing_member=None):
        self.existing_member = existing_member
        self.added = []
        self.flushed = False
        self.refreshed = []

    async def execute(self, query):
        return FakeResult(self.existing_member)

    def add(self, value):
        self.added.append(value)

    async def flush(self):
        self.flushed = True

    async def refresh(self, value):
        self.refreshed.append(value)


def make_invite(**overrides):
    values = {
        "id": uuid4(),
        "project_id": uuid4(),
        "email": "dev@example.com",
        "role": "developer",
        "invited_by": uuid4(),
        "token": "token",
        "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
    }
    values.update(overrides)
    return ProjectInvite(**values)


def run(coro):
    return asyncio.run(coro)


def test_accept_invite_creates_member_and_marks_accepted():
    db = FakeDb()
    user = SimpleNamespace(id=uuid4(), email="dev@example.com")
    invite = make_invite()

    result = run(AcceptInviteStrategy().execute(db, invite, invite.project_id, user))

    assert result is invite
    assert invite.accepted_at is not None
    assert db.flushed
    assert db.refreshed == [invite]
    assert len(db.added) == 1
    assert db.added[0].user_id == user.id
    assert db.added[0].role == "developer"


@pytest.mark.parametrize(
    ("invite_kwargs", "error_type", "message"),
    [
        ({"accepted_at": datetime.now(timezone.utc)}, InvalidInviteTransition, "Invite already accepted"),
        ({"revoked_at": datetime.now(timezone.utc)}, InvalidInviteTransition, "Invite has been revoked"),
        ({"expires_at": datetime.now(timezone.utc) - timedelta(days=1)}, InvalidInviteTransition, "Invite has expired"),
    ],
)
def test_accept_invite_rejects_invalid_states(invite_kwargs, error_type, message):
    db = FakeDb()
    user = SimpleNamespace(id=uuid4(), email="dev@example.com")
    invite = make_invite(**invite_kwargs)

    with pytest.raises(error_type, match=message):
        run(AcceptInviteStrategy().execute(db, invite, invite.project_id, user))


def test_accept_invite_rejects_different_email():
    db = FakeDb()
    user = SimpleNamespace(id=uuid4(), email="other@example.com")
    invite = make_invite()

    with pytest.raises(PermissionDenied, match="different email"):
        run(AcceptInviteStrategy().execute(db, invite, invite.project_id, user))


def test_accept_invite_rejects_existing_member():
    db = FakeDb(existing_member=object())
    user = SimpleNamespace(id=uuid4(), email="dev@example.com")
    invite = make_invite()

    with pytest.raises(InviteConflict, match="Already a member"):
        run(AcceptInviteStrategy().execute(db, invite, invite.project_id, user))


def test_revoke_invite_marks_revoked():
    db = FakeDb()
    user = SimpleNamespace(id=uuid4(), email="admin@example.com")
    invite = make_invite()

    result = run(RevokeInviteStrategy().execute(db, invite, invite.project_id, user))

    assert result is invite
    assert invite.revoked_at is not None
    assert db.flushed
    assert db.refreshed == [invite]


def test_revoke_invite_rejects_already_revoked():
    db = FakeDb()
    user = SimpleNamespace(id=uuid4(), email="admin@example.com")
    invite = make_invite(revoked_at=datetime.now(timezone.utc))

    with pytest.raises(InvalidInviteTransition, match="Invite already revoked"):
        run(RevokeInviteStrategy().execute(db, invite, invite.project_id, user))



# ─── Plan limit: accepting must not pass the owner's members limit ───────────

from app.services.auth_service import AuthService  # noqa: E402
from app.strategies import invite_transitions  # noqa: E402
from app.strategies.exceptions import PlanLimitReached  # noqa: E402


@pytest.fixture(autouse=True)
def members_check(monkeypatch):
    """FakeDb cannot count rows: stand in for PlanLimits.check_members and record how it is called."""
    calls = []

    async def check_members(self, project_id, adding=1):
        calls.append((project_id, adding))
        if check_members.over_limit:
            raise PlanLimitReached("members_per_project", 3)

    check_members.over_limit = False
    check_members.calls = calls
    monkeypatch.setattr(invite_transitions.PlanLimits, "check_members", check_members)
    return check_members


def test_accept_invite_checks_the_members_limit_without_adding_a_seat(members_check):
    db = FakeDb()
    user = SimpleNamespace(id=uuid4(), email="dev@example.com")
    invite = make_invite()

    run(AcceptInviteStrategy().execute(db, invite, invite.project_id, user))

    # adding=0: the pending invite already holds its seat.
    assert members_check.calls == [(invite.project_id, 0)]


def test_accept_invite_over_the_limit_leaves_the_invite_pending(members_check):
    members_check.over_limit = True
    db = FakeDb()
    user = SimpleNamespace(id=uuid4(), email="dev@example.com")
    invite = make_invite()

    with pytest.raises(PlanLimitReached):
        run(AcceptInviteStrategy().execute(db, invite, invite.project_id, user))

    assert invite.accepted_at is None
    assert db.added == []


def test_accept_by_token_lets_the_plan_limit_through(members_check, monkeypatch):
    """The e-mail link path: a full project is a 402, not "invalid invite"."""
    members_check.over_limit = True
    invite = make_invite()

    async def pending_invite(self, token):
        return invite

    monkeypatch.setattr(AuthService, "get_invite_by_token", pending_invite)
    user = SimpleNamespace(id=uuid4(), email="dev@example.com")

    with pytest.raises(PlanLimitReached):
        run(AuthService(FakeDb()).accept_invite_by_token("token", user))
    assert invite.accepted_at is None
