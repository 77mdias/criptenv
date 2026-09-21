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


# ─── PKCE (CLI browser login hardening) ──────────────────────────────────────


def test_generate_pkce_pair_is_rfc7636_compliant():
    """The verifier must be unreserved, 43..128 chars, and match the challenge."""
    from criptenv.pkce import generate_pkce_pair, compute_code_challenge

    verifier, challenge = generate_pkce_pair()

    assert 43 <= len(verifier) <= 128
    assert 43 <= len(challenge) <= 128
    assert "=" not in verifier and "=" not in challenge
    assert all(c.isalnum() or c in "-._~" for c in verifier)
    assert challenge == compute_code_challenge(verifier)


def test_generate_pkce_pair_is_unique_per_attempt():
    from criptenv.pkce import generate_pkce_pair

    assert len({generate_pkce_pair()[0] for _ in range(50)}) == 50


@pytest.mark.asyncio
async def test_cli_initiate_sends_s256_code_challenge(monkeypatch):
    client = CriptEnvClient()
    captured = {}

    async def fake_request(method, path, **kwargs):
        captured["method"] = method
        captured["path"] = path
        captured["json"] = kwargs.get("json")
        return httpx.Response(200, json={"auth_url": "u", "state": "s"}, request=httpx.Request(method, path))

    monkeypatch.setattr(client, "_request", fake_request)

    await client.cli_initiate("http://127.0.0.1:1234/callback", "CHALLENGE")

    assert captured["path"] == "/api/auth/cli/initiate"
    assert captured["json"]["callback_url"] == "http://127.0.0.1:1234/callback"
    assert captured["json"]["code_challenge"] == "CHALLENGE"
    assert captured["json"]["code_challenge_method"] == "S256"


@pytest.mark.asyncio
async def test_cli_token_sends_code_verifier(monkeypatch):
    client = CriptEnvClient()
    captured = {}

    async def fake_request(method, path, **kwargs):
        captured["json"] = kwargs.get("json")
        return httpx.Response(200, json={"token": "t"}, request=httpx.Request(method, path))

    monkeypatch.setattr(client, "_request", fake_request)

    await client.cli_token("AUTH_CODE", "VERIFIER")

    assert captured["json"] == {"auth_code": "AUTH_CODE", "code_verifier": "VERIFIER"}


def test_loopback_callback_handler_rejects_state_mismatch():
    """A code delivered with the wrong state must be discarded."""
    import threading
    import urllib.error
    import urllib.request
    import socketserver

    from criptenv.commands.login import _CallbackHandler

    _CallbackHandler.auth_code = None
    _CallbackHandler.error = None
    _CallbackHandler.expected_state = "expected-state"
    _CallbackHandler.event.clear()

    server = socketserver.TCPServer(("127.0.0.1", 0), _CallbackHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        with pytest.raises(urllib.error.HTTPError) as exc_info:
            urllib.request.urlopen(
                f"http://127.0.0.1:{port}/callback?code=stolen-code&state=wrong",
                timeout=5,
            )
        assert exc_info.value.code == 400
        assert _CallbackHandler.auth_code is None
        assert _CallbackHandler.error == "state_mismatch"

        with urllib.request.urlopen(
            f"http://127.0.0.1:{port}/callback?code=good-code&state=expected-state",
            timeout=5,
        ) as response:
            assert response.status == 200
        assert _CallbackHandler.auth_code == "good-code"
    finally:
        server.shutdown()
        server.server_close()
        _CallbackHandler.expected_state = None
