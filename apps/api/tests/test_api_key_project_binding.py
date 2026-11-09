"""An API key only reaches the project it was created for.

An API key authenticates as the user who created it. The project routes used
to check only that this user was a member of the project in the URL, so a key
minted for one project could list, and pull the vault of, every other project
its owner belonged to.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
import pytest_asyncio

pytest.importorskip("aiosqlite")

from httpx import ASGITransport, AsyncClient
from sqlalchemy.dialects.postgresql import CITEXT, JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import app
from app.database import Base, get_db
from app.middleware.auth import AuthContext, get_current_auth_context
from app.models.environment import Environment
from app.models.member import ProjectMember
from app.models.project import Project
from app.models.user import User
from app.models.vault import VaultBlob


@compiles(CITEXT, "sqlite")
def _compile_citext_sqlite(element, compiler, **kw):
    return "TEXT"


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(element, compiler, **kw):
    return "JSON"


@pytest_asyncio.fixture
async def world():
    """One user who owns two projects, each with a secret in production."""
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    owner = User(id=uuid4(), email="ana@example.com", name="Ana", password_hash="", kdf_salt="s", email_verified=True)
    mine = Project(id=uuid4(), owner_id=owner.id, name="mine", slug="mine", settings={})
    other = Project(id=uuid4(), owner_id=owner.id, name="other", slug="other", settings={})
    mine_env = Environment(id=uuid4(), project_id=mine.id, name="production", is_default=True)
    other_env = Environment(id=uuid4(), project_id=other.id, name="production", is_default=True)

    async with factory() as db:
        db.add_all([owner, mine, other, mine_env, other_env])
        for project, env, key in ((mine, mine_env, "MINE_KEY"), (other, other_env, "OTHER_KEY")):
            db.add_all([
                ProjectMember(id=uuid4(), project_id=project.id, user_id=owner.id, role="owner"),
                VaultBlob(id=uuid4(), project_id=project.id, environment_id=env.id, key_id=key,
                          iv="iv", ciphertext="ct", auth_tag="tag", version=1, checksum="c" * 64),
            ])
        await db.commit()
    yield factory, owner, mine, mine_env, other, other_env
    await engine.dispose()


async def _get(factory, owner, project, path, auth_type="api_key"):
    async def _get_db():
        async with factory() as db:
            yield db
            await db.commit()

    api_key = None
    if auth_type == "api_key":
        api_key = MagicMock(project_id=project.id, environment_scope=None, scopes=["read:secrets"])
    context = AuthContext(user=owner, auth_type=auth_type, api_key=api_key)

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_auth_context] = lambda: context
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            return await client.get(path, headers={"Authorization": "Bearer cek_live_test"})
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_auth_context, None)


def _paths(project, env):
    base = f"/api/v1/projects/{project.id}"
    env_base = f"{base}/environments/{env.id}"
    return [
        base,
        f"{base}/secrets/matrix",
        f"{base}/environments",
        env_base,
        f"{env_base}/vault/pull",
        f"{env_base}/vault/version",
    ]


@pytest.mark.asyncio
async def test_api_key_reads_its_own_project(world):
    factory, owner, mine, mine_env, *_ = world
    for path in _paths(mine, mine_env):
        response = await _get(factory, owner, mine, path)
        assert response.status_code == 200, (path, response.text)

    pull = await _get(factory, owner, mine, f"/api/v1/projects/{mine.id}/environments/{mine_env.id}/vault/pull")
    assert [b["key_id"] for b in pull.json()["blobs"]] == ["MINE_KEY"]


@pytest.mark.asyncio
async def test_api_key_cannot_reach_another_project_of_its_owner(world):
    factory, owner, mine, _, other, other_env = world
    for path in _paths(other, other_env):
        response = await _get(factory, owner, mine, path)
        assert response.status_code == 404, (path, response.text)
        assert "OTHER_KEY" not in response.text


@pytest.mark.asyncio
async def test_project_list_with_api_key_shows_only_its_project(world):
    factory, owner, mine, *_ = world
    response = await _get(factory, owner, mine, "/api/v1/projects")
    assert response.status_code == 200, response.text
    body = response.json()
    assert [p["id"] for p in body["projects"]] == [str(mine.id)]
    assert body["total"] == 1


@pytest.mark.asyncio
async def test_session_still_sees_every_project(world):
    factory, owner, mine, _, other, other_env = world
    response = await _get(factory, owner, mine, "/api/v1/projects", auth_type="session")
    assert response.status_code == 200, response.text
    assert {p["id"] for p in response.json()["projects"]} == {str(mine.id), str(other.id)}

    for path in _paths(other, other_env):
        response = await _get(factory, owner, mine, path, auth_type="session")
        assert response.status_code == 200, (path, response.text)
