from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import get_db
from app.middleware.auth import get_current_user
from app.routers.auth import router as auth_router
from app.services.auth_service import AuthService


async def _dummy_db():
    yield object()


def make_user():
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=uuid4(),
        email="dev@example.com",
        name="Dev",
        kdf_salt="salt",
        avatar_url=None,
        email_verified=True,
        two_factor_enabled=False,
        created_at=now,
        updated_at=now,
        last_login_at=now,
    )


def make_session():
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=uuid4(),
        user_id=uuid4(),
        token="super-secret-session-token",
        expires_at=now + timedelta(days=30),
        created_at=now,
        updated_at=now,
        ip_address="127.0.0.1",
        user_agent="pytest",
    )


def make_app() -> FastAPI:
    app = FastAPI()
    app.include_router(auth_router)
    app.dependency_overrides[get_db] = _dummy_db
    return app


def test_signup_sets_cookie_without_returning_session_token(monkeypatch):
    async def fake_create_user(self, **kwargs):
        return make_user(), make_session()

    monkeypatch.setattr(AuthService, "create_user", fake_create_user)

    with TestClient(make_app()) as client:
        response = client.post(
            "/api/auth/signup",
            json={"email": "dev@example.com", "password": "password123", "name": "Dev"},
        )

    assert response.status_code == 201
    assert "session_token=" in response.headers["set-cookie"]
    payload = response.json()
    assert "session_token" not in payload
    assert "token" not in payload["session"]


def test_signin_sets_cookie_without_returning_session_token(monkeypatch):
    async def fake_authenticate_user(self, **kwargs):
        return make_user(), make_session()

    monkeypatch.setattr(AuthService, "authenticate_user", fake_authenticate_user)

    with TestClient(make_app()) as client:
        response = client.post(
            "/api/auth/signin",
            json={"email": "dev@example.com", "password": "password123"},
        )

    assert response.status_code == 200
    assert "session_token=" in response.headers["set-cookie"]
    payload = response.json()
    assert "session_token" not in payload
    assert "token" not in payload["session"]


def test_get_sessions_hides_session_tokens(monkeypatch):
    app = make_app()
    app.dependency_overrides[get_current_user] = lambda: make_user()

    async def fake_get_user_sessions(self, user_id):
        return [make_session()]

    monkeypatch.setattr(AuthService, "get_user_sessions", fake_get_user_sessions)

    with TestClient(app) as client:
        response = client.get("/api/auth/sessions")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert "token" not in payload[0]
