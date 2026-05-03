from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import get_db
from app.middleware.auth import get_current_user
from app.routers.oauth import router as oauth_router
from app.services.oauth_service import OAuthService, OAuthUserInfo


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
    app.include_router(oauth_router)
    app.dependency_overrides[get_db] = _dummy_db
    return app


def test_oauth_init_unknown_provider():
    """Test that unknown provider returns 400."""
    with TestClient(make_app()) as client:
        response = client.get("/api/auth/oauth/invalid_provider")
    
    assert response.status_code == 400
    assert "Unknown OAuth provider" in response.json()["detail"]


def test_oauth_callback_missing_state():
    """Test that callback without state cookie returns 401."""
    with TestClient(make_app()) as client:
        response = client.get(
            "/api/auth/oauth/github/callback",
            params={"code": "test_code", "state": "test_state"},
        )
    
    assert response.status_code == 401
    assert "state missing" in response.json()["detail"].lower()


def test_oauth_callback_state_mismatch(monkeypatch):
    """Test that callback with mismatched state returns 401."""
    # Use the proper encode_state function
    encoded_state = OAuthService.encode_state("github", "expected_state")
    
    with TestClient(make_app()) as client:
        # Try callback with wrong state
        response = client.get(
            "/api/auth/oauth/github/callback",
            params={"code": "test_code", "state": "wrong_state"},
            cookies={"oauth_state": encoded_state},
        )
    
    assert response.status_code == 401


def test_oauth_list_accounts_unauthorized():
    """Test that listing accounts without auth returns error status."""
    with TestClient(make_app()) as client:
        response = client.get("/api/auth/oauth/accounts")
    
    # The endpoint requires auth, so it should return an error status
    # Without proper auth context, it may return 400, 401, 403, or 500
    assert response.status_code >= 400


def test_oauth_unlink_unknown_provider(monkeypatch):
    """Test that unlinking unknown provider returns 400."""
    app = make_app()
    app.dependency_overrides[get_current_user] = lambda: make_user()
    
    async def fake_unlink_oauth_account(self, user_id, provider):
        return False
    
    monkeypatch.setattr(OAuthService, "unlink_oauth_account", fake_unlink_oauth_account)
    
    with TestClient(app) as client:
        response = client.delete("/api/auth/oauth/invalid_provider")
    
    assert response.status_code == 400


def test_oauth_state_encoding():
    """Test OAuth state encode/decode functions."""
    provider = "github"
    state = "random_state_123"
    
    encoded = OAuthService.encode_state(provider, state)
    decoded_provider, decoded_state = OAuthService.decode_state(encoded)
    
    assert decoded_provider == provider
    assert decoded_state == state


def test_oauth_state_encoding_different_providers():
    """Test that different providers produce different encoded states."""
    state = "same_state"
    
    github_encoded = OAuthService.encode_state("github", state)
    google_encoded = OAuthService.encode_state("google", state)
    discord_encoded = OAuthService.encode_state("discord", state)
    
    # All should be different
    assert len(set([github_encoded, google_encoded, discord_encoded])) == 3


def test_oauth_callback_invalid_state_cookie():
    """Test that callback with invalid state cookie returns 401."""
    with TestClient(make_app()) as client:
        response = client.get(
            "/api/auth/oauth/github/callback",
            params={"code": "test_code", "state": "test_state"},
            cookies={"oauth_state": "invalid_base64!!!"},
        )
    
    assert response.status_code == 401
