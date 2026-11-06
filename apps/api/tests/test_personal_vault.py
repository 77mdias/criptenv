"""Personal vault (cofre pessoal): zero-knowledge per-user items, web-only.

Real SQLite DB: per-user isolation and optimistic versioning are the point of
these endpoints, so they are not mocked.
"""

import sys
from pathlib import Path
from uuid import uuid4

import pytest
import pytest_asyncio

pytest.importorskip("aiosqlite")

from pydantic import ValidationError
from sqlalchemy.dialects.postgresql import CITEXT, JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import Base
from app.models.personal_vault import PersonalVaultItem
from app.models.user import User
from app.schemas.personal_vault import EncryptedBody, EncryptedSummary, PersonalVaultConfigCreate


@compiles(CITEXT, "sqlite")
def _compile_citext_sqlite(element, compiler, **kw):
    return "TEXT"


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(element, compiler, **kw):
    return "JSON"


def _user(name):
    return User(id=uuid4(), email=f"{name}@example.com", name=name.title(),
                password_hash="", kdf_salt="salt", email_verified=True)


def _envelope(ct_len=60):
    return {"iv": "A" * 16, "ciphertext": "B" * ct_len, "auth_tag": "C" * 24}


def _config(**over):
    base = {"kdf": "PBKDF2-SHA256", "iterations": 600_000,
            "master_salt": "S" * 44, "extra_salt": "T" * 44,
            "master_wrapped_vault_key": _envelope(), "recovery_wrapped_vault_key": _envelope(),
            "extra_wrapped_protected_key": _envelope(), "recovery_wrapped_protected_key": _envelope()}
    return {**base, **over}


@pytest_asyncio.fixture
async def factory():
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield async_sessionmaker(engine, expire_on_commit=False)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(factory):
    async with factory() as db:
        yield db


@pytest_asyncio.fixture
async def user(db_session):
    u = _user("ana")
    db_session.add(u)
    await db_session.flush()
    return u


# ─── Task 1: schemas and models ─────────────────────────────────────────────

def test_config_rejects_weak_iterations():
    with pytest.raises(ValidationError):
        PersonalVaultConfigCreate(**_config(iterations=599_999))


def test_config_rejects_other_kdf():
    with pytest.raises(ValidationError):
        PersonalVaultConfigCreate(**_config(kdf="argon2id"))


def test_envelope_lengths_are_enforced():
    with pytest.raises(ValidationError):
        EncryptedSummary(**{**_envelope(), "iv": "A" * 15})
    with pytest.raises(ValidationError):
        EncryptedSummary(**_envelope(ct_len=4097))
    EncryptedBody(**_envelope(ct_len=65_536))
    with pytest.raises(ValidationError):
        EncryptedBody(**_envelope(ct_len=65_537))


@pytest.mark.asyncio
async def test_item_row_roundtrip(db_session, user):
    item = PersonalVaultItem(user_id=user.id, protected=True, summary=_envelope(), body=_envelope())
    db_session.add(item)
    await db_session.flush()
    assert item.version == 1 and item.protected is True
