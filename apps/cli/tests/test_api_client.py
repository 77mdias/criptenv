"""Tests for the CLI API client."""

import httpx
import pytest

from criptenv.api.client import CriptEnvClient
from criptenv.api.client import CriptEnvAPIError


@pytest.mark.asyncio
async def test_signin_uses_session_cookie_as_cli_token(monkeypatch):
    client = CriptEnvClient()

    async def fake_request(method, path, **kwargs):
        return httpx.Response(
            200,
            json={
                "user": {"id": "usr_1", "email": "dev@example.com"},
                "session": {"id": "sess_1"},
            },
            headers={"set-cookie": "session_token=cookie-token; Path=/; HttpOnly"},
            request=httpx.Request("POST", "https://api.example.test/api/auth/signin"),
        )

    monkeypatch.setattr(client, "_request", fake_request)

    response = await client.signin("dev@example.com", "password123")

    assert response["token"] == "cookie-token"


@pytest.mark.asyncio
async def test_request_uses_explicit_timeout(monkeypatch):
    captured = {}
    client = CriptEnvClient(base_url="https://api.example.test")

    class FakeAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def request(self, method, url, **kwargs):
            captured["timeout"] = kwargs["timeout"]
            return httpx.Response(
                200,
                json={"ok": True},
                request=httpx.Request(method, url),
            )

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)

    await client._request("GET", "/health")

    assert captured["timeout"].connect == 15.0
    assert captured["timeout"].read == 30.0


@pytest.mark.asyncio
async def test_request_timeout_raises_clear_api_error(monkeypatch):
    client = CriptEnvClient(base_url="https://api.example.test")

    class FakeAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def request(self, method, url, **kwargs):
            raise httpx.ConnectTimeout("")

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)

    with pytest.raises(CriptEnvAPIError) as exc_info:
        await client._request("POST", "/api/auth/cli/initiate")

    assert exc_info.value.status_code == 0
    assert "Timed out connecting to https://api.example.test" in str(exc_info.value)
