"""GET /api/v1/icons/{hostname}/icon.png: web session only, never stores anything."""
import logging
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.middleware.auth import get_current_web_user
from app.models.user import User
from app.services.site_icon_service import SiteIcon
from main import app

pytestmark = pytest.mark.asyncio

PNG = b"\x89PNG\r\n\x1a\n" + b"x" * 20


class FakeDB:
    def __init__(self):
        self.events = []

    async def commit(self):
        self.events.append("commit")

    async def rollback(self):
        pass

    async def close(self):
        pass


@pytest.fixture
def fake_db():
    return FakeDB()


@pytest.fixture
def icon_mock(monkeypatch):
    mock = AsyncMock(return_value=None)
    monkeypatch.setattr("app.routers.icons.get_site_icon", mock)
    return mock


@pytest_asyncio.fixture
async def raw_client(fake_db):
    async def _get_db():
        yield fake_db

    app.dependency_overrides[get_db] = _get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture
async def client(raw_client):
    user = User(id=uuid4(), email="ana@example.com", name="Ana", password_hash="", kdf_salt="salt", email_verified=True)
    app.dependency_overrides[get_current_web_user] = lambda: user
    try:
        yield raw_client
    finally:
        app.dependency_overrides.pop(get_current_web_user, None)


async def test_returns_icon_with_cache_headers(client, icon_mock):
    icon_mock.return_value = SiteIcon(PNG, "image/png")
    r = await client.get("/api/v1/icons/GitHub.com/icon.png")
    assert r.status_code == 200
    assert r.content == PNG
    assert r.headers["content-type"] == "image/png"
    assert r.headers["cache-control"] == "private, max-age=604800"
    assert r.headers["x-content-type-options"] == "nosniff"
    icon_mock.assert_awaited_once_with("github.com")


async def test_miss_is_404_cached_for_a_day(client, icon_mock):
    icon_mock.return_value = None
    r = await client.get("/api/v1/icons/github.com/icon.png")
    assert r.status_code == 404
    assert r.headers["cache-control"] == "private, max-age=86400"


@pytest.mark.parametrize("host", ["localhost", "10.0.0.1", "nodot", "bad_x.com"])
async def test_invalid_hostname_is_400_without_fetch(client, icon_mock, host):
    assert (await client.get(f"/api/v1/icons/{host}/icon.png")).status_code == 400
    icon_mock.assert_not_awaited()


async def test_commits_db_before_fetching(client, icon_mock, fake_db):
    icon_mock.side_effect = lambda host: fake_db.events.append("fetch") or None
    await client.get("/api/v1/icons/github.com/icon.png")
    assert fake_db.events[:2] == ["commit", "fetch"]


async def test_requires_web_session(raw_client, icon_mock):
    assert (await raw_client.get("/api/v1/icons/github.com/icon.png")).status_code == 401
    r = await raw_client.get("/api/v1/icons/github.com/icon.png", headers={"Authorization": "Bearer x"})
    assert r.status_code == 403
    icon_mock.assert_not_awaited()


async def test_request_log_line_hides_hostname(caplog, client, icon_mock):
    caplog.set_level(logging.INFO)
    icon_mock.return_value = None
    await client.get("/api/v1/icons/github.com/icon.png")
    # The "httpx" records here are the test client's own request log, not the server's.
    server = "\n".join(r.getMessage() for r in caplog.records if r.name != "httpx")
    assert "github.com" not in server
    assert "/api/v1/icons/[oculto]/icon.png" in server
