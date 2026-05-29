"""Tests for invite-triggered in-app notifications."""
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.routers import invites as invites_router
from app.routers.invites import create_invite, revoke_invite
from app.models.member import ProjectInvite
from app.schemas.member import InviteCreate


class _ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class _FakeDb:
    def __init__(self, invited_user):
        self.invited_user = invited_user
        self.added = []
        self.statements = []

    def add(self, value):
        self.added.append(value)

    async def flush(self):
        return None

    async def refresh(self, value):
        if getattr(value, "created_at", None) is None:
            value.created_at = datetime.now(timezone.utc)

    async def execute(self, statement):
        self.statements.append(statement)
        if len(self.statements) == 1:
            return _ScalarResult(None)

        compiled = str(
            statement.compile(compile_kwargs={"literal_binds": True})
        ).lower()
        if "lower(users.email)" in compiled and "teammate@example.com" in compiled:
            return _ScalarResult(self.invited_user)

        return _ScalarResult(None)


class _InviteDb:
    def __init__(self, invite):
        self.invite = invite
        self.deleted = []

    async def execute(self, statement):
        return _ScalarResult(self.invite)

    async def delete(self, value):
        self.deleted.append(value)

    async def flush(self):
        return None


def _request():
    return SimpleNamespace(
        client=SimpleNamespace(host="127.0.0.1"),
        headers={"User-Agent": "pytest"},
    )


def _user(email="owner@example.com"):
    return SimpleNamespace(id=uuid4(), email=email, name="Owner")


@pytest.mark.asyncio
async def test_create_invite_creates_notification_for_existing_user_with_normalized_email(monkeypatch):
    project_id = uuid4()
    invited_user = _user("teammate@example.com")
    db = _FakeDb(invited_user)
    notifications = []
    sent_emails = []

    async def fake_check_access(self, user_id, pid, role=None):
        return SimpleNamespace(role="admin")

    async def fake_get_project(self, pid):
        return SimpleNamespace(id=pid, name="Core API")

    async def fake_log(self, **kwargs):
        return None

    def fake_send_project_invite(self, **kwargs):
        sent_emails.append(kwargs)

    async def fake_create_notification(self, **kwargs):
        notifications.append(kwargs)

    monkeypatch.setattr(invites_router.ProjectService, "check_user_access", fake_check_access)
    monkeypatch.setattr(invites_router.ProjectService, "get_project", fake_get_project)
    monkeypatch.setattr(invites_router.AuditService, "log", fake_log)
    monkeypatch.setattr(invites_router.EmailService, "send_project_invite", fake_send_project_invite)
    monkeypatch.setattr(
        invites_router.NotificationService,
        "create_notification",
        fake_create_notification,
    )

    response = await create_invite(
        project_id=str(project_id),
        request=_request(),
        payload=InviteCreate(email="TEAMMATE@EXAMPLE.COM", role="developer"),
        current_user=_user(),
        db=db,
    )

    assert response.email == "teammate@example.com"
    assert sent_emails[0]["to"] == "teammate@example.com"
    assert notifications == [
        {
            "user_id": invited_user.id,
            "type": "invite",
            "title": "Convite para Core API",
            "message": "Owner convidou você para participar do projeto 'Core API' como developer.",
            "action_url": f"/invites/accept?token={response.token}",
            "meta": {
                "project_id": str(project_id),
                "project_name": "Core API",
                "invited_by": str(db.added[0].invited_by),
                "invited_by_name": "Owner",
                "role": "developer",
                "invite_id": str(response.id),
            },
        }
    ]


@pytest.mark.asyncio
async def test_create_invite_without_existing_user_does_not_create_notification(monkeypatch):
    project_id = uuid4()
    db = _FakeDb(invited_user=None)
    notifications = []

    async def fake_check_access(self, user_id, pid, role=None):
        return SimpleNamespace(role="admin")

    async def fake_get_project(self, pid):
        return SimpleNamespace(id=pid, name="Core API")

    async def fake_log(self, **kwargs):
        return None

    def fake_send_project_invite(self, **kwargs):
        return None

    async def fake_create_notification(self, **kwargs):
        notifications.append(kwargs)

    monkeypatch.setattr(invites_router.ProjectService, "check_user_access", fake_check_access)
    monkeypatch.setattr(invites_router.ProjectService, "get_project", fake_get_project)
    monkeypatch.setattr(invites_router.AuditService, "log", fake_log)
    monkeypatch.setattr(invites_router.EmailService, "send_project_invite", fake_send_project_invite)
    monkeypatch.setattr(
        invites_router.NotificationService,
        "create_notification",
        fake_create_notification,
    )

    await create_invite(
        project_id=str(project_id),
        request=_request(),
        payload=InviteCreate(email="new-user@example.com", role="viewer"),
        current_user=_user(),
        db=db,
    )

    assert notifications == []


@pytest.mark.asyncio
async def test_developer_can_invite_developer_or_viewer(monkeypatch):
    project_id = uuid4()
    db = _FakeDb(invited_user=None)

    async def fake_check_access(self, user_id, pid, role=None):
        assert role == "developer"
        return SimpleNamespace(role="developer")

    async def fake_get_project(self, pid):
        return SimpleNamespace(id=pid, name="Core API")

    async def fake_log(self, **kwargs):
        return None

    monkeypatch.setattr(invites_router.ProjectService, "check_user_access", fake_check_access)
    monkeypatch.setattr(invites_router.ProjectService, "get_project", fake_get_project)
    monkeypatch.setattr(invites_router.AuditService, "log", fake_log)
    monkeypatch.setattr(invites_router.EmailService, "send_project_invite", lambda self, **kwargs: None)
    monkeypatch.setattr(invites_router.NotificationService, "create_notification", lambda self, **kwargs: None)

    response = await create_invite(
        project_id=str(project_id),
        request=_request(),
        payload=InviteCreate(email="viewer@example.com", role="viewer"),
        current_user=_user(),
        db=db,
    )

    assert response.role == "viewer"


@pytest.mark.asyncio
async def test_developer_cannot_invite_admin(monkeypatch):
    project_id = uuid4()
    db = _FakeDb(invited_user=None)

    async def fake_check_access(self, user_id, pid, role=None):
        return SimpleNamespace(role="developer")

    monkeypatch.setattr(invites_router.ProjectService, "check_user_access", fake_check_access)

    with pytest.raises(invites_router.HTTPException) as exc:
        await create_invite(
            project_id=str(project_id),
            request=_request(),
            payload=InviteCreate(email="admin@example.com", role="admin"),
            current_user=_user(),
            db=db,
        )

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_developer_can_revoke_own_pending_invite_with_hard_delete(monkeypatch):
    project_id = uuid4()
    actor = _user()
    invite = ProjectInvite(
        id=uuid4(),
        project_id=project_id,
        email="dev@example.com",
        role="developer",
        invited_by=actor.id,
        token="token",
        expires_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    db = _InviteDb(invite)
    deleted_notifications = []

    async def fake_check_access(self, user_id, pid, role=None):
        assert role == "developer"
        return SimpleNamespace(role="developer")

    async def fake_log(self, **kwargs):
        return None

    async def fake_delete_notifications(self, invite_id):
        deleted_notifications.append(str(invite_id))
        return 1

    monkeypatch.setattr(invites_router.ProjectService, "check_user_access", fake_check_access)
    monkeypatch.setattr(invites_router.AuditService, "log", fake_log)
    monkeypatch.setattr(
        invites_router.NotificationService,
        "delete_invite_notifications",
        fake_delete_notifications,
    )

    response = await revoke_invite(
        project_id=str(project_id),
        invite_id=str(invite.id),
        request=_request(),
        current_user=actor,
        db=db,
    )

    assert response.id == invite.id
    assert db.deleted == [invite]
    assert deleted_notifications == [str(invite.id)]


@pytest.mark.asyncio
async def test_developer_cannot_revoke_other_users_invite(monkeypatch):
    project_id = uuid4()
    actor = _user()
    invite = ProjectInvite(
        id=uuid4(),
        project_id=project_id,
        email="dev@example.com",
        role="developer",
        invited_by=uuid4(),
        token="token",
        expires_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    db = _InviteDb(invite)

    async def fake_check_access(self, user_id, pid, role=None):
        return SimpleNamespace(role="developer")

    monkeypatch.setattr(invites_router.ProjectService, "check_user_access", fake_check_access)

    with pytest.raises(invites_router.HTTPException) as exc:
        await revoke_invite(
            project_id=str(project_id),
            invite_id=str(invite.id),
            request=_request(),
            current_user=actor,
            db=db,
        )

    assert exc.value.status_code == 404
    assert db.deleted == []
