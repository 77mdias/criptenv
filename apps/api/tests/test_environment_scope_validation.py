"""environment_scope on API keys / CI tokens must name an active project environment.

A key scoped to a nonexistent environment ("developer" instead of "development")
used to be created fine, authenticate, and then see no environments at all.
"""

from contextlib import contextmanager
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

pytest.importorskip("aiosqlite")

from sqlalchemy.dialects.postgresql import CITEXT, JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.database import Base, get_db
from app.middleware.auth import AuthContext, get_current_auth_context, get_current_user
from app.models.environment import Environment
from main import app


@compiles(CITEXT, "sqlite")
def _citext(element, compiler, **kw):
    return "TEXT"


@compiles(JSONB, "sqlite")
def _jsonb(element, compiler, **kw):
    return "JSON"


PROJECT_ID = uuid4()


@pytest_asyncio.fixture
async def session_factory():
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        db.add_all([
            Environment(id=uuid4(), project_id=PROJECT_ID, name="development"),
            Environment(id=uuid4(), project_id=PROJECT_ID, name="production", is_default=True),
            Environment(id=uuid4(), project_id=PROJECT_ID, name="legacy", archived=True),
        ])
        await db.commit()
    yield factory
    await engine.dispose()


@contextmanager
def app_overrides(session_factory, auth_context=None):
    user = MagicMock()
    user.id = uuid4()

    async def _db():
        async with session_factory() as db:
            yield db
            await db.commit()

    async def _user():
        return user

    async def _ctx():
        return auth_context or AuthContext(user=user, auth_type="session")

    app.dependency_overrides.update({get_db: _db, get_current_user: _user, get_current_auth_context: _ctx})
    with patch(
        "app.services.project_service.ProjectService.check_user_access",
        new_callable=AsyncMock,
        return_value=MagicMock(),
    ):
        try:
            yield
        finally:
            for dep in (get_db, get_current_user, get_current_auth_context):
                app.dependency_overrides.pop(dep, None)


async def _post(path, body):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        return await client.post(path, json=body, headers={"Authorization": "Bearer x"})


async def _get(path):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        return await client.get(path, headers={"Authorization": "Bearer x"})


API_KEYS = f"/api/v1/projects/{PROJECT_ID}/api-keys"
TOKENS = f"/api/v1/projects/{PROJECT_ID}/tokens"


@pytest.mark.asyncio
@pytest.mark.parametrize("path", [API_KEYS, TOKENS])
@pytest.mark.parametrize("scope", ["developer", "legacy"])  # typo, archived
async def test_unknown_environment_scope_is_rejected(session_factory, path, scope):
    with app_overrides(session_factory):
        response = await _post(path, {"name": "k", "environment_scope": scope})
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert f"'{scope}'" in detail
    assert "development, production" in detail


@pytest.mark.asyncio
async def test_valid_scope_is_stored_and_whitespace_normalized(session_factory):
    with app_overrides(session_factory):
        exact = await _post(API_KEYS, {"name": "a", "environment_scope": "development"})
        padded = await _post(API_KEYS, {"name": "b", "environment_scope": "  development "})
        token = await _post(TOKENS, {"name": "c", "environment_scope": " production "})
        unscoped = await _post(API_KEYS, {"name": "d", "environment_scope": ""})
    assert exact.status_code == 201 and exact.json()["environment_scope"] == "development"
    assert padded.status_code == 201 and padded.json()["environment_scope"] == "development"
    assert token.status_code == 201 and token.json()["token_info"]["environment_scope"] == "production"
    assert unscoped.status_code == 201 and unscoped.json()["environment_scope"] is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "scope, expected",
    [("development", ["development"]), (None, ["production", "development"])],
)
async def test_env_list_respects_api_key_scope(session_factory, scope, expected):
    api_key = MagicMock(environment_scope=scope, scopes=["read:secrets"], project_id=PROJECT_ID)
    ctx = AuthContext(user=MagicMock(id=uuid4()), auth_type="api_key", api_key=api_key)
    with app_overrides(session_factory, auth_context=ctx):
        response = await _get(f"/api/v1/projects/{PROJECT_ID}/environments")
    assert response.status_code == 200
    body = response.json()
    assert [e["name"] for e in body["environments"]] == expected
    assert body["api_key_environment_scope"] == scope
