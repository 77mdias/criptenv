"""Config/Secret kind per vault blob: stored, and kept across replace-all pushes.

Real SQLite DB: the push deletes and rewrites every row, so preservation is
only meaningful against a real table.
"""
import sys
from pathlib import Path
from uuid import uuid4

import pytest
import pytest_asyncio

pytest.importorskip("aiosqlite")

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import CITEXT, JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import Base
from app.models.environment import Environment
from app.models.vault import VaultBlob
from app.schemas.vault import VaultBlobPush
from app.services.vault_service import VaultService


@compiles(CITEXT, "sqlite")
def _compile_citext_sqlite(element, compiler, **kw):
    return "TEXT"


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(element, compiler, **kw):
    return "JSON"


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
    await engine.dispose()


async def _environment(db, project_id):
    env = Environment(id=uuid4(), project_id=project_id, name=f"env-{uuid4().hex[:6]}", secrets_version=0)
    db.add(env)
    await db.flush()
    return env


def _blob(key_id, kind=None):
    data = VaultBlobPush(
        key_id=key_id, iv="aXY=", ciphertext="Y3Q=", auth_tag="dGFn", checksum="a" * 64, version=1,
        **({"kind": kind} if kind else {}),
    )
    return data.model_dump()


async def _push(db, env, *blobs):
    await VaultService(db).push_blobs(env.project_id, env.id, list(blobs))


async def _kinds(db, env):
    rows = await db.execute(select(VaultBlob.key_id, VaultBlob.kind).where(VaultBlob.environment_id == env.id))
    return dict(rows.all())


@pytest.mark.asyncio
async def test_new_blob_without_kind_is_config(db):
    env = await _environment(db, uuid4())
    await _push(db, env, _blob("A"))
    assert await _kinds(db, env) == {"A": "config"}


@pytest.mark.asyncio
async def test_explicit_kind_is_stored(db):
    env = await _environment(db, uuid4())
    await _push(db, env, _blob("A", "secret"))
    assert await _kinds(db, env) == {"A": "secret"}
    blobs, _version = await VaultService(db).pull_blobs(env.project_id, env.id)
    assert [blob.kind for blob in blobs] == ["secret"]


@pytest.mark.asyncio
async def test_push_without_kind_keeps_previous_kind(db):
    env = await _environment(db, uuid4())
    await _push(db, env, _blob("A", "secret"))
    await _push(db, env, _blob("A"))
    assert await _kinds(db, env) == {"A": "secret"}


@pytest.mark.asyncio
async def test_explicit_kind_overrides_previous(db):
    env = await _environment(db, uuid4())
    await _push(db, env, _blob("A", "secret"))
    await _push(db, env, _blob("A", "config"))
    assert await _kinds(db, env) == {"A": "config"}


@pytest.mark.asyncio
async def test_renamed_key_does_not_inherit_kind(db):
    env = await _environment(db, uuid4())
    await _push(db, env, _blob("A", "secret"))
    await _push(db, env, _blob("B"))
    assert await _kinds(db, env) == {"B": "config"}


@pytest.mark.asyncio
async def test_full_list_resend_without_kinds_preserves_all(db):
    env = await _environment(db, uuid4())
    await _push(db, env, _blob("A", "secret"), _blob("B", "config"))
    await _push(db, env, _blob("A"), _blob("B"))
    assert await _kinds(db, env) == {"A": "secret", "B": "config"}


async def _legacy_row(db, env, key_id):
    """A row from before migration 0016: no kind was ever chosen."""
    db.add(VaultBlob(
        id=uuid4(), project_id=env.project_id, environment_id=env.id, key_id=key_id,
        iv="aXY=", ciphertext="Y3Q=", auth_tag="dGFn", version=1, checksum="a" * 64, kind=None,
    ))
    await db.flush()


@pytest.mark.asyncio
async def test_legacy_row_stays_unset_on_push_without_kind(db):
    env = await _environment(db, uuid4())
    await _legacy_row(db, env, "A")
    await _push(db, env, _blob("A"))
    assert await _kinds(db, env) == {"A": None}
    blobs, _version = await VaultService(db).pull_blobs(env.project_id, env.id)
    assert [blob.kind for blob in blobs] == [None]


@pytest.mark.asyncio
async def test_legacy_row_takes_an_explicit_kind(db):
    env = await _environment(db, uuid4())
    await _legacy_row(db, env, "A")
    await _push(db, env, _blob("A", "secret"))
    assert await _kinds(db, env) == {"A": "secret"}


def test_invalid_kind_rejected():
    with pytest.raises(ValidationError):
        VaultBlobPush(key_id="A", iv="x", ciphertext="y", auth_tag="z", checksum="a" * 64, version=1, kind="public")


@pytest.mark.asyncio
async def test_kind_is_scoped_to_environment(db):
    project_id = uuid4()
    first = await _environment(db, project_id)
    second = await _environment(db, project_id)
    await _push(db, first, _blob("A", "secret"))
    await _push(db, second, _blob("A"))
    assert await _kinds(db, second) == {"A": "config"}
