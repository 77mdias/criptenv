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

