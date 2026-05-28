"""Tests for notification routes."""
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import get_db
from app.middleware.auth import get_current_user
from app.routers.notifications import router as notifications_router


def make_user():
    return SimpleNamespace(
        id=uuid4(),
        email="dev@example.com",
        name="Dev",
        kdf_salt="salt",
        avatar_url=None,
        email_verified=True,
        two_factor_enabled=False,
        created_at=datetime.now(timezone.utc),
    )


async def _dummy_db():
    yield object()


def make_app() -> FastAPI:
    app = FastAPI()
    app.include_router(notifications_router)
    app.dependency_overrides[get_db] = _dummy_db
    return app


def test_list_notifications(monkeypatch):
    user = make_user()
    app = make_app()
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app)

    fake_notification = SimpleNamespace(
        id=uuid4(),
        user_id=user.id,
        type="invite",
        title="Convite para Projeto X",
        message="Alguém convidou você",
        read_at=None,
        action_url="/invites/accept?token=abc",
        meta={"project_id": str(uuid4())},
        created_at=datetime.now(timezone.utc),
    )

    async def fake_list(*args, **kwargs):
        return [fake_notification], 1

    async def fake_count(*args, **kwargs):
        return 1

    monkeypatch.setattr(
        "app.routers.notifications.NotificationService.list_user_notifications",
        fake_list,
    )
    monkeypatch.setattr(
        "app.routers.notifications.NotificationService.get_unread_count",
        fake_count,
    )

    response = client.get("/api/v1/notifications")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["unread_count"] == 1
    assert len(data["notifications"]) == 1
    assert data["notifications"][0]["title"] == "Convite para Projeto X"


def test_get_unread_count(monkeypatch):
    user = make_user()
    app = make_app()
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app)

    async def fake_count(*args, **kwargs):
        return 5

    monkeypatch.setattr(
        "app.routers.notifications.NotificationService.get_unread_count",
        fake_count,
    )

    response = client.get("/api/v1/notifications/unread-count")
    assert response.status_code == 200
    data = response.json()
    assert data["unread_count"] == 5


def test_mark_notification_read(monkeypatch):
    user = make_user()
    nid = uuid4()
    app = make_app()
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app)

    async def fake_mark(*args, **kwargs):
        return SimpleNamespace(id=nid)

    monkeypatch.setattr(
        "app.routers.notifications.NotificationService.mark_as_read",
        fake_mark,
    )

    response = client.patch(f"/api/v1/notifications/{nid}/read")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["id"] == str(nid)


def test_mark_notification_read_not_found(monkeypatch):
    user = make_user()
    nid = uuid4()
    app = make_app()
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app)

    async def fake_mark(*args, **kwargs):
        return None

    monkeypatch.setattr(
        "app.routers.notifications.NotificationService.mark_as_read",
        fake_mark,
    )

    response = client.patch(f"/api/v1/notifications/{nid}/read")
    assert response.status_code == 404


def test_mark_all_read(monkeypatch):
    user = make_user()
    app = make_app()
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app)

    async def fake_mark_all(*args, **kwargs):
        return 3

    monkeypatch.setattr(
        "app.routers.notifications.NotificationService.mark_all_as_read",
        fake_mark_all,
    )

    response = client.patch("/api/v1/notifications/read-all")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["marked_count"] == 3
