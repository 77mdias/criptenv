"""Regression test: API key auth must eager-load the owning user.

`validate_api_key_context` accesses `api_key.user` after loading the key.
Without eager loading, async SQLAlchemy raises MissingGreenletError (implicit
IO on a lazy relationship). The existing mock-based tests never caught this
because they never touched a real session (audit P1 #5, 2026-10).
"""

from uuid import uuid4

import pytest
import pytest_asyncio

pytest.importorskip("aiosqlite")

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import CITEXT, JSONB

from app.database import Base
from app.models.api_key import APIKey, hash_api_key
from app.models.user import User
from app.middleware import api_key_auth


# Compile Postgres-only types down to plain SQLite equivalents so the real
# models can be exercised against an in-memory SQLite database in tests.
@compiles(CITEXT, "sqlite")
def _compile_citext_sqlite(element, compiler, **kw):
    return "TEXT"


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(element, compiler, **kw):
    return "JSON"


@pytest_asyncio.fixture
async def session_factory():
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    yield factory
    await engine.dispose()


@pytest_asyncio.fixture
async def seeded_key(session_factory):
    """Create a user + API key and return the plaintext key."""
    plaintext = "cek_live_" + "a" * 32
    async with session_factory() as db:
        user = User(
            id=uuid4(),
            email="dev@example.com",
            name="Dev",
            password_hash="",
            kdf_salt="salt",
            email_verified=True,
        )
        db.add(user)
        await db.flush()

        api_key = APIKey(
            id=uuid4(),
            user_id=user.id,
            project_id=uuid4(),
            name="test key",
            prefix="cek_live_",
            key_hash=hash_api_key(plaintext),
            scopes=["read:secrets"],
        )
        db.add(api_key)
        await db.commit()
    return plaintext


@pytest.mark.asyncio
async def test_validate_api_key_context_eager_loads_user(session_factory, seeded_key, monkeypatch):
    monkeypatch.setattr(api_key_auth, "async_session_factory", session_factory)

    context = await api_key_auth.validate_api_key_context(seeded_key)

    # Accessing the relationship must not raise MissingGreenletError
    assert context.user.email == "dev@example.com"
    assert context.auth_type == "api_key"
    assert "read:secrets" in context.api_key.scopes


@pytest.mark.asyncio
async def test_validate_api_key_context_rejects_unknown_key(session_factory, monkeypatch):
    monkeypatch.setattr(api_key_auth, "async_session_factory", session_factory)

    with pytest.raises(api_key_auth.InvalidApiKeyError):
        await api_key_auth.validate_api_key_context("cek_live_" + "b" * 32)


@pytest.mark.asyncio
async def test_validate_api_key_context_rejects_revoked_key(session_factory, seeded_key, monkeypatch):
    monkeypatch.setattr(api_key_auth, "async_session_factory", session_factory)

    # Revoke the key directly, then validate. (The expired-key path compares
    # tz-aware datetimes, which SQLite drivers return as naive — the revoked
    # path exercises the same real-session flow without that driver quirk.)
    from datetime import datetime as _dt
    from sqlalchemy import update

    async with session_factory() as db:
        await db.execute(
            update(APIKey)
            .where(APIKey.key_hash == hash_api_key(seeded_key))
            .values(revoked_at=_dt.utcnow())
        )
        await db.commit()

    with pytest.raises(api_key_auth.RevokedApiKeyError):
        await api_key_auth.validate_api_key_context(seeded_key)
