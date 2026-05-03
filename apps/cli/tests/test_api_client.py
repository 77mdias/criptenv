"""Tests for the CLI API client."""

import httpx
import pytest

from criptenv.api.client import CriptEnvClient


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
