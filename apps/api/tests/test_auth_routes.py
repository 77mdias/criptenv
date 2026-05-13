from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import get_db
from app.middleware.auth import get_current_user
from app.routers.auth import router as auth_router
from app.services.auth_service import AuthService
from app.services.email_service import EmailService


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


def _make_email_service(enabled: bool):
    """Factory for mocked EmailService instances."""
    svc = object.__new__(EmailService)
    svc.enabled = enabled
    return svc


def test_forgot_password_exposes_dev_token_when_email_disabled(monkeypatch):
    """When RESEND_API_KEY is not set, the reset token is exposed for local development."""
    reset_record = SimpleNamespace(token="dev-reset-token-123", email="dev@example.com")

    async def fake_create_password_reset(self, email):
        return reset_record

    monkeypatch.setattr(AuthService, "create_password_reset", fake_create_password_reset)
    monkeypatch.setattr(EmailService, "__init__", lambda self: setattr(self, "enabled", False))

    with TestClient(make_app()) as client:
        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "dev@example.com"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["message"] == "If an account exists with this email, a reset link has been sent."
    assert payload["dev_token"] == "dev-reset-token-123"
    assert "dev_warning" in payload
    assert "RESEND_API_KEY is missing" in payload["dev_warning"]


def test_forgot_password_hides_token_when_email_enabled(monkeypatch):
    """When RESEND_API_KEY is set, the reset token is never exposed."""
    reset_record = SimpleNamespace(token="prod-reset-token-456", email="dev@example.com")

    async def fake_create_password_reset(self, email):
        return reset_record

    monkeypatch.setattr(AuthService, "create_password_reset", fake_create_password_reset)
    monkeypatch.setattr(EmailService, "__init__", lambda self: setattr(self, "enabled", True))
    monkeypatch.setattr(EmailService, "send_password_reset", lambda self, to, reset_url: {"id": "sent"})

    with TestClient(make_app()) as client:
        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "dev@example.com"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["message"] == "If an account exists with this email, a reset link has been sent."
    assert "dev_token" not in payload or payload["dev_token"] is None
    assert "dev_warning" not in payload or payload["dev_warning"] is None


def test_forgot_password_returns_generic_message_when_user_not_found(monkeypatch):
    """When user doesn't exist, return generic message without dev_token."""
    async def fake_create_password_reset(self, email):
        return None

    monkeypatch.setattr(AuthService, "create_password_reset", fake_create_password_reset)
    monkeypatch.setattr(EmailService, "__init__", lambda self: setattr(self, "enabled", False))

    with TestClient(make_app()) as client:
        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "nonexistent@example.com"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["message"] == "If an account exists with this email, a reset link has been sent."
    assert "dev_token" not in payload or payload["dev_token"] is None
