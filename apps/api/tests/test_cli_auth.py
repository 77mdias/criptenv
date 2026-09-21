"""Tests for CLI authentication endpoints."""

import asyncio
import base64
import hashlib
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from app.database import get_db
from app.middleware.auth import get_current_user
from app.routers.cli_auth import _CLIAuthStore, _DeviceFlowStore
from app.routers.cli_auth import router as cli_auth_router
from app.services.auth_service import AuthService


# ─── PKCE helpers ────────────────────────────────────────────────────────────

# 49 chars — within the RFC 7636 §4.1 range of 43..128.
CODE_VERIFIER = "verifier-" + "a" * 40
LOOPBACK_CALLBACK = "http://127.0.0.1:57341/callback"


def code_challenge_for(verifier: str = CODE_VERIFIER) -> str:
    """Compute the S256 PKCE challenge for a verifier."""
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def initiate_payload(
    callback_url: str = LOOPBACK_CALLBACK,
    verifier: str = CODE_VERIFIER,
) -> dict:
    """Build a valid /initiate body including the PKCE challenge."""
    return {
        "callback_url": callback_url,
        "code_challenge": code_challenge_for(verifier),
    }


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


def make_app() -> FastAPI:
    app = FastAPI()
    app.include_router(cli_auth_router)
    app.dependency_overrides[get_db] = _dummy_db
    return app


def make_auth_app(user=None):
    app = FastAPI()
    app.include_router(cli_auth_router)
    app.dependency_overrides[get_db] = _dummy_db
    app.dependency_overrides[get_current_user] = lambda: (user or make_user())
    return app


class FakeRedis:
    def __init__(self):
        self.values = {}
        self.ttls = {}
        self.deleted = []

    async def get(self, key):
        return self.values.get(key)

    async def setex(self, key, ttl, value):
        self.values[key] = value
        self.ttls[key] = ttl

    async def delete(self, *keys):
        self.deleted.extend(keys)
        for key in keys:
            self.values.pop(key, None)
            self.ttls.pop(key, None)


class TestCLIAuthRedisStore:
    def test_cli_auth_store_uses_redis_keys_and_ttl(self):
        async def run_test():
            redis = FakeRedis()
            store = _CLIAuthStore(default_ttl_seconds=300, redis_client=redis)

            auth_code = await store.create(
                "state-123", "http://127.0.0.1:57341/callback", code_challenge_for()
            )

            assert "cli_auth:state:state-123" in redis.values
            assert f"cli_auth:code:{auth_code}" in redis.values
            assert redis.ttls["cli_auth:state:state-123"] == 300
            assert redis.ttls[f"cli_auth:code:{auth_code}"] == 300

            authorized_entry = await store.authorize("state-123", "usr_123")
            entry = await store.get_by_code(auth_code)

            assert authorized_entry["auth_code"] == auth_code
            assert authorized_entry["callback_url"] == "http://127.0.0.1:57341/callback"
            assert entry["authorized"] is True
            assert entry["user_id"] == "usr_123"
            assert entry["code_challenge"] == code_challenge_for()

            await store.delete(auth_code)

            assert "cli_auth:state:state-123" in redis.deleted
            assert f"cli_auth:code:{auth_code}" in redis.deleted

        asyncio.run(run_test())

    def test_device_flow_store_uses_redis_key_and_ttl(self):
        async def run_test():
            redis = FakeRedis()
            store = _DeviceFlowStore(default_ttl_seconds=600, redis_client=redis)

            device_code, user_code, verification_uri = await store.create()

            assert user_code
            assert verification_uri.endswith(f"/cli-auth?device_code={device_code}")
            assert f"cli_auth:device:{device_code}" in redis.values
            assert redis.ttls[f"cli_auth:device:{device_code}"] == 600

            assert await store.authorize(device_code, "usr_123") is True
            entry = await store.poll(device_code)

            assert entry["authorized"] is True
            assert entry["user_id"] == "usr_123"

        asyncio.run(run_test())

# ─── Browser Redirect Flow ───────────────────────────────────────────────────

class TestCLIInitiate:
    """Tests for POST /api/auth/cli/initiate"""

    def test_cli_initiate_success(self):
        with TestClient(make_app()) as client:
            response = client.post(
                "/api/auth/cli/initiate",
                json=initiate_payload(),
            )
        assert response.status_code == 200
        data = response.json()
        assert "auth_url" in data
        assert "state" in data
        assert "expires_in" in data
        assert data["expires_in"] == 300
        assert "/cli-auth?" in data["auth_url"]
        # The callback registered by the CLI is carried in the auth URL.
        assert "127.0.0.1%3A57341" in data["auth_url"]

    def test_cli_initiate_missing_callback(self):
        with TestClient(make_app()) as client:
            response = client.post("/api/auth/cli/initiate", json={})
        assert response.status_code == 422

    def test_cli_initiate_requires_code_challenge(self):
        """PKCE is mandatory: no challenge means no authorization request."""
        with TestClient(make_app()) as client:
            response = client.post(
                "/api/auth/cli/initiate",
                json={"callback_url": LOOPBACK_CALLBACK},
            )
        assert response.status_code == 422

    @pytest.mark.parametrize(
        "callback_url",
        [
            "https://attacker.example/collect",
            "http://attacker.example/collect",
            "http://10.0.0.5:8080/callback",
            "http://192.168.1.10:8080/callback",
            "http://127.0.0.1.evil.example:8080/callback",
            # userinfo trick: urlparse hostname is attacker.example
            "http://127.0.0.1@attacker.example:8080/callback",
            # non-http schemes
            "ftp://127.0.0.1:8080/callback",
        ],
    )
    def test_cli_initiate_rejects_non_loopback_callback(self, callback_url):
        """A callback that is not loopback must never be registered."""
        with TestClient(make_app()) as client:
            response = client.post(
                "/api/auth/cli/initiate",
                json=initiate_payload(callback_url=callback_url),
            )
        assert response.status_code == 400
        assert "callback_url" in response.json()["detail"]

    def test_cli_initiate_requires_explicit_port(self):
        with TestClient(make_app()) as client:
            response = client.post(
                "/api/auth/cli/initiate",
                json=initiate_payload(callback_url="http://127.0.0.1/callback"),
            )
        assert response.status_code == 400
        assert "port" in response.json()["detail"].lower()

    def test_cli_initiate_accepts_localhost_and_ipv6_loopback(self):
        for callback in ("http://localhost:57341/callback", "http://[::1]:57341/callback"):
            with TestClient(make_app()) as client:
                response = client.post(
                    "/api/auth/cli/initiate",
                    json=initiate_payload(callback_url=callback),
                )
            assert response.status_code == 200, callback


class TestCLIAuthorize:
    """Tests for POST /api/auth/cli/authorize"""

    def test_cli_authorize_requires_auth(self):
        with TestClient(make_app()) as client:
            response = client.post(
                "/api/auth/cli/authorize",
                json={"state": "test_state"},
            )
        assert response.status_code == 401

    def test_cli_authorize_invalid_state(self):
        with TestClient(make_auth_app()) as client:
            response = client.post(
                "/api/auth/cli/authorize",
                json={"state": "invalid_state"},
            )
        assert response.status_code == 400
        assert "Invalid or expired state" in response.json()["detail"]

    def test_cli_authorize_success(self):
        with TestClient(make_auth_app()) as client:
            # First initiate
            init_resp = client.post(
                "/api/auth/cli/initiate",
                json=initiate_payload(),
            )
            assert init_resp.status_code == 200
            state = init_resp.json()["state"]

            # Then authorize
            auth_resp = client.post(
                "/api/auth/cli/authorize",
                json={"state": state},
            )
        assert auth_resp.status_code == 200
        data = auth_resp.json()
        assert "auth_code" in data

    def test_cli_authorize_returns_server_registered_callback(self):
        """The client must be told the registered loopback callback.

        This lets the web page redirect to a server-validated URL instead of
        trusting the attacker-controllable `callback` query parameter.
        """
        with TestClient(make_auth_app()) as client:
            init_resp = client.post(
                "/api/auth/cli/initiate",
                json=initiate_payload(),
            )
            state = init_resp.json()["state"]

            auth_resp = client.post(
                "/api/auth/cli/authorize",
                json={"state": state},
            )

        assert auth_resp.status_code == 200
        assert auth_resp.json()["callback_url"] == LOOPBACK_CALLBACK


class TestCLIToken:
    """Tests for POST /api/auth/cli/token"""

    def test_cli_token_invalid_code(self):
        with TestClient(make_app()) as client:
            response = client.post(
                "/api/auth/cli/token",
                json={"auth_code": "invalid_code", "code_verifier": CODE_VERIFIER},
            )
        assert response.status_code == 400
        assert "Invalid or expired auth code" in response.json()["detail"]

    def test_cli_token_requires_code_verifier(self):
        with TestClient(make_app()) as client:
            response = client.post(
                "/api/auth/cli/token",
                json={"auth_code": "some_code"},
            )
        assert response.status_code == 422

    def test_cli_token_success(self, monkeypatch):
        user = make_user()

        async def fake_get_user_by_id(self, user_id):
            return user

        async def fake_create_session(self, **kwargs):
            now = datetime.now(timezone.utc)
            return SimpleNamespace(
                id=uuid4(),
                user_id=user.id,
                token="cli-session-token-xxx-yyyy-zzzz-aaaa-bbbb-cccc",
                expires_at=now + timedelta(days=30),
                created_at=now,
                ip_address="127.0.0.1",
                user_agent="pytest",
            )

        monkeypatch.setattr(AuthService, "get_user_by_id", fake_get_user_by_id)
        monkeypatch.setattr(AuthService, "create_session", fake_create_session)

        with TestClient(make_auth_app(user)) as client:
            # Initiate
            init_resp = client.post(
                "/api/auth/cli/initiate",
                json=initiate_payload(),
            )
            state = init_resp.json()["state"]

            # Authorize
            auth_resp = client.post(
                "/api/auth/cli/authorize",
                json={"state": state},
            )
            auth_code = auth_resp.json()["auth_code"]

            # Exchange for token
            token_resp = client.post(
                "/api/auth/cli/token",
                json={"auth_code": auth_code, "code_verifier": CODE_VERIFIER},
            )

        assert token_resp.status_code == 200
        data = token_resp.json()
        assert "token" in data
        assert len(data["token"]) >= 32
        assert "user" in data
        assert data["user"]["email"] == user.email

    def test_cli_token_rejects_wrong_code_verifier(self, monkeypatch):
        """A stolen auth_code alone must not yield a session (PKCE)."""
        user = make_user()
        created_sessions = []

        async def fake_get_user_by_id(self, user_id):
            return user

        async def fake_create_session(self, **kwargs):
            created_sessions.append(kwargs)
            now = datetime.now(timezone.utc)
            return SimpleNamespace(
                id=uuid4(),
                user_id=user.id,
                token="cli-session-token-xxx-yyyy-zzzz-aaaa-bbbb-cccc",
                expires_at=now + timedelta(days=30),
                created_at=now,
                ip_address="127.0.0.1",
                user_agent="pytest",
            )

        monkeypatch.setattr(AuthService, "get_user_by_id", fake_get_user_by_id)
        monkeypatch.setattr(AuthService, "create_session", fake_create_session)

        with TestClient(make_auth_app(user)) as client:
            init_resp = client.post("/api/auth/cli/initiate", json=initiate_payload())
            state = init_resp.json()["state"]
            auth_resp = client.post("/api/auth/cli/authorize", json={"state": state})
            auth_code = auth_resp.json()["auth_code"]

            # Attacker replays the intercepted code with a verifier of their own.
            stolen = client.post(
                "/api/auth/cli/token",
                json={"auth_code": auth_code, "code_verifier": "x" * 49},
            )

            # A failed exchange must not consume the code: the legit CLI can retry.
            assert stolen.status_code == 400
            assert "Invalid code verifier" in stolen.json()["detail"]
            assert created_sessions == []

            retry = client.post(
                "/api/auth/cli/token",
                json={"auth_code": auth_code, "code_verifier": CODE_VERIFIER},
            )

        assert retry.status_code == 200
        assert "token" in retry.json()
        assert len(created_sessions) == 1

    def test_cli_token_is_single_use(self, monkeypatch):
        """The auth code cannot be exchanged twice."""
        user = make_user()

        async def fake_get_user_by_id(self, user_id):
            return user

        async def fake_create_session(self, **kwargs):
            now = datetime.now(timezone.utc)
            return SimpleNamespace(
                id=uuid4(),
                user_id=user.id,
                token="cli-session-token-xxx-yyyy-zzzz-aaaa-bbbb-cccc",
                expires_at=now + timedelta(days=30),
                created_at=now,
                ip_address="127.0.0.1",
                user_agent="pytest",
            )

        monkeypatch.setattr(AuthService, "get_user_by_id", fake_get_user_by_id)
        monkeypatch.setattr(AuthService, "create_session", fake_create_session)

        with TestClient(make_auth_app(user)) as client:
            init_resp = client.post("/api/auth/cli/initiate", json=initiate_payload())
            state = init_resp.json()["state"]
            auth_resp = client.post("/api/auth/cli/authorize", json={"state": state})
            auth_code = auth_resp.json()["auth_code"]

            first = client.post(
                "/api/auth/cli/token",
                json={"auth_code": auth_code, "code_verifier": CODE_VERIFIER},
            )
            second = client.post(
                "/api/auth/cli/token",
                json={"auth_code": auth_code, "code_verifier": CODE_VERIFIER},
            )

        assert first.status_code == 200
        assert second.status_code == 400


# ─── Device Authorization Grant ──────────────────────────────────────────────

class TestDeviceCode:
    """Tests for POST /api/auth/cli/device/code"""

    def test_device_code_success(self):
        with TestClient(make_app()) as client:
            response = client.post("/api/auth/cli/device/code", json={})
        assert response.status_code == 200
        data = response.json()
        assert "device_code" in data
        assert "user_code" in data
        assert "verification_uri" in data
        assert "expires_in" in data
        assert "interval" in data
        assert len(data["user_code"].split("-")) == 3


class TestDevicePoll:
    """Tests for POST /api/auth/cli/device/poll"""

    def test_device_poll_pending(self):
        with TestClient(make_app()) as client:
            # Create device code
            code_resp = client.post("/api/auth/cli/device/code", json={})
            device_code = code_resp.json()["device_code"]

            # Poll immediately — should be pending
            poll_resp = client.post(
                "/api/auth/cli/device/poll",
                json={"device_code": device_code},
            )
        assert poll_resp.status_code == 200
        assert poll_resp.json()["status"] == "pending"

    def test_device_poll_expired(self):
        with TestClient(make_app()) as client:
            response = client.post(
                "/api/auth/cli/device/poll",
                json={"device_code": "invalid_code"},
            )
        assert response.status_code == 200
        assert response.json()["status"] == "expired"

    def test_device_poll_authorized(self, monkeypatch):
        user = make_user()

        async def fake_get_user_by_id(self, user_id):
            return user

        async def fake_create_session(self, **kwargs):
            now = datetime.now(timezone.utc)
            return SimpleNamespace(
                id=uuid4(),
                user_id=user.id,
                token="cli-device-token-xxx-yyyy-zzzz-aaaa-bbbb-cccc",
                expires_at=now + timedelta(days=30),
                created_at=now,
                ip_address="127.0.0.1",
                user_agent="pytest",
            )

        monkeypatch.setattr(AuthService, "get_user_by_id", fake_get_user_by_id)
        monkeypatch.setattr(AuthService, "create_session", fake_create_session)

        with TestClient(make_auth_app(user)) as client:
            # Create device code
            code_resp = client.post("/api/auth/cli/device/code", json={})
            device_code = code_resp.json()["device_code"]

            # Authorize device
            auth_resp = client.post(
                "/api/auth/cli/device/authorize",
                json={"device_code": device_code},
            )
            assert auth_resp.status_code == 200

            # Poll — should be authorized
            poll_resp = client.post(
                "/api/auth/cli/device/poll",
                json={"device_code": device_code},
            )

        assert poll_resp.status_code == 200
        data = poll_resp.json()
        assert data["status"] == "authorized"
        assert "access_token" in data
        assert data["user"]["email"] == user.email


class TestDeviceAuthorize:
    """Tests for POST /api/auth/cli/device/authorize"""

    def test_device_authorize_requires_auth(self):
        with TestClient(make_app()) as client:
            response = client.post(
                "/api/auth/cli/device/authorize",
                json={"device_code": "test"},
            )
        assert response.status_code == 401

    def test_device_authorize_invalid_code(self):
        with TestClient(make_auth_app()) as client:
            response = client.post(
                "/api/auth/cli/device/authorize",
                json={"device_code": "invalid_code"},
            )
        assert response.status_code == 400
        assert "Invalid or expired device code" in response.json()["detail"]
