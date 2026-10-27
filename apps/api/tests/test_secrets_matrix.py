"""GET /api/v1/projects/{id}/secrets/matrix (UX.3).

Key × environment presence built from vault metadata only — the response must
never carry ciphertext/iv/auth_tag (zero-knowledge stays intact).
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
from app.middleware.auth import get_current_user_or_api_key
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


def _blob(project, env, key, version):
    return VaultBlob(id=uuid4(), project_id=project.id, environment_id=env.id, key_id=key,
                     iv="IV-SECRET", ciphertext="CIPHERTEXT-SECRET", auth_tag="TAG-SECRET",
                     version=version, checksum="c" * 64)


@pytest_asyncio.fixture
async def world():
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    owner = User(id=uuid4(), email="ana@example.com", name="Ana", password_hash="", kdf_salt="s", email_verified=True)
    stranger = User(id=uuid4(), email="eve@example.com", name="Eve", password_hash="", kdf_salt="s", email_verified=True)
    project = Project(id=uuid4(), owner_id=owner.id, name="api", slug="api", settings={})
    prod = Environment(id=uuid4(), project_id=project.id, name="production", is_default=True)
    dev = Environment(id=uuid4(), project_id=project.id, name="development")
    old = Environment(id=uuid4(), project_id=project.id, name="legacy", archived=True)

    async with factory() as db:
        db.add_all([owner, stranger, project, prod, dev, old])
        db.add_all([
            ProjectMember(id=uuid4(), project_id=project.id, user_id=owner.id, role="viewer"),
            _blob(project, prod, "DATABASE_URL", 3), _blob(project, dev, "DATABASE_URL", 1),
            _blob(project, prod, "STRIPE_KEY", 2),
            _blob(project, old, "LEGACY_ONLY", 1),
        ])
        await db.commit()
    yield factory, owner, stranger, project, prod, dev
    await engine.dispose()


async def _get(factory, user, project_id):
    async def _get_db():
        async with factory() as db:
            yield db

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_user_or_api_key] = lambda: MagicMock(id=user.id)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            return await client.get(f"/api/v1/projects/{project_id}/secrets/matrix",
                                    headers={"Authorization": "Bearer test"})
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user_or_api_key, None)


@pytest.mark.asyncio
async def test_matrix_reports_presence_per_environment(world):
    factory, owner, _, project, prod, dev = world
    response = await _get(factory, owner, project.id)
    assert response.status_code == 200, response.text
    data = response.json()

    assert [e["name"] for e in data["environments"]] == ["production", "development"]
    keys = {k["key_id"]: k["cells"] for k in data["keys"]}
    assert set(keys) == {"DATABASE_URL", "STRIPE_KEY"}  # archived env's key excluded
    assert keys["DATABASE_URL"][str(prod.id)]["version"] == 3
    assert keys["DATABASE_URL"][str(dev.id)]["version"] == 1
    assert keys["STRIPE_KEY"][str(prod.id)]["version"] == 2
    assert keys["STRIPE_KEY"][str(dev.id)] is None


@pytest.mark.asyncio
async def test_matrix_never_returns_encrypted_material(world):
    factory, owner, _, project, *_ = world
    body = (await _get(factory, owner, project.id)).text
    for secret in ("CIPHERTEXT-SECRET", "IV-SECRET", "TAG-SECRET", "ciphertext", "auth_tag"):
        assert secret not in body


@pytest.mark.asyncio
async def test_matrix_hidden_from_non_members(world):
    factory, _, stranger, project, *_ = world
    assert (await _get(factory, stranger, project.id)).status_code == 404
