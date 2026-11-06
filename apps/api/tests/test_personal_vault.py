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


# ─── Task 2: cookie-only web auth ───────────────────────────────────────────

from unittest.mock import AsyncMock, MagicMock  # noqa: E402

from fastapi import HTTPException  # noqa: E402
from starlette.requests import Request  # noqa: E402

from app.middleware.auth import get_current_web_user  # noqa: E402
from app.services.auth_service import AuthService  # noqa: E402


def _request(headers=None, cookies=None):
    raw = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    if cookies:
        raw.append((b"cookie", "; ".join(f"{k}={v}" for k, v in cookies.items()).encode()))
    return Request({"type": "http", "method": "GET", "path": "/", "headers": raw, "query_string": b""})


@pytest.mark.asyncio
async def test_web_user_rejects_bearer_even_if_valid(monkeypatch):
    monkeypatch.setattr(AuthService, "validate_session", AsyncMock(return_value=_user("ana")))
    request = _request(headers={"Authorization": "Bearer cek_valid"}, cookies={"session_token": "tok"})
    with pytest.raises(HTTPException) as exc:
        await get_current_web_user(request, db=MagicMock())
    assert exc.value.status_code == 403
    assert exc.value.detail == "Personal vault is only available in the web dashboard"


@pytest.mark.asyncio
async def test_web_user_requires_cookie():
    with pytest.raises(HTTPException) as exc:
        await get_current_web_user(_request(), db=MagicMock())
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_web_user_accepts_session_cookie(monkeypatch):
    user = _user("ana")
    monkeypatch.setattr(AuthService, "validate_session", AsyncMock(return_value=user))
    assert await get_current_web_user(_request(cookies={"session_token": "tok"}), db=MagicMock()) is user


@pytest.mark.asyncio
async def test_web_user_keeps_email_verification_rule(monkeypatch):
    user = _user("ana")
    user.email_verified = False
    monkeypatch.setattr(AuthService, "validate_session", AsyncMock(return_value=user))
    with pytest.raises(HTTPException) as exc:
        await get_current_web_user(_request(cookies={"session_token": "tok"}), db=MagicMock())
    assert exc.value.status_code == 403


# ─── Tasks 3-4: HTTP routes ─────────────────────────────────────────────────

from httpx import ASGITransport, AsyncClient  # noqa: E402

from main import app  # noqa: E402
from app.database import get_db  # noqa: E402


@pytest_asyncio.fixture
async def client(factory):
    async def _get_db():
        async with factory() as db:
            try:
                yield db
                await db.commit()
            except Exception:
                await db.rollback()
                raise

    app.dependency_overrides[get_db] = _get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_web_user, None)


@pytest_asyncio.fixture
async def as_user(factory):
    users = {}
    async with factory() as db:
        for name in ("ana", "bia"):
            users[name] = _user(name)
            db.add(users[name])
        await db.commit()

    def _switch(name):
        app.dependency_overrides[get_current_web_user] = lambda: users[name]
        return users[name]

    return _switch


@pytest.mark.asyncio
async def test_config_lifecycle(client, as_user):
    as_user("ana")
    assert (await client.get("/api/v1/personal-vault/config")).status_code == 404
    r = await client.post("/api/v1/personal-vault/config", json=_config())
    assert r.status_code == 201 and r.json()["version"] == 1
    assert (await client.post("/api/v1/personal-vault/config", json=_config())).status_code == 409
    r = await client.put("/api/v1/personal-vault/config",
                         json={**_config(master_salt="M" * 44), "expected_version": 1})
    assert r.status_code == 200 and r.json()["version"] == 2 and r.json()["master_salt"] == "M" * 44
    r = await client.get("/api/v1/personal-vault/config")
    assert r.status_code == 200 and r.json()["master_salt"] == "M" * 44


@pytest.mark.asyncio
async def test_config_stale_version_conflicts(client, as_user):
    as_user("ana")
    await client.post("/api/v1/personal-vault/config", json=_config())
    await client.put("/api/v1/personal-vault/config", json={**_config(), "expected_version": 1})
    r = await client.put("/api/v1/personal-vault/config", json={**_config(), "expected_version": 1})
    assert r.status_code == 409 and r.json()["detail"] == "Version conflict"


@pytest.mark.asyncio
async def test_config_update_without_vault_is_404(client, as_user):
    as_user("ana")
    r = await client.put("/api/v1/personal-vault/config", json={**_config(), "expected_version": 1})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_config_is_per_user(client, as_user):
    as_user("ana")
    await client.post("/api/v1/personal-vault/config", json=_config())
    as_user("bia")
    assert (await client.get("/api/v1/personal-vault/config")).status_code == 404


@pytest.mark.asyncio
async def test_routes_reject_bearer_tokens(client):
    r = await client.get("/api/v1/personal-vault/config", headers={"Authorization": "Bearer cek_x"})
    assert r.status_code == 403


from app.services import personal_vault_service  # noqa: E402


def _item(protected=False):
    return {"protected": protected, "summary": _envelope(), "body": _envelope(ct_len=200)}


@pytest_asyncio.fixture
async def setup_vault(client, as_user):
    as_user("ana")
    assert (await client.post("/api/v1/personal-vault/config", json=_config())).status_code == 201


@pytest.mark.asyncio
async def test_item_crud(client, setup_vault):
    r = await client.post("/api/v1/personal-vault/items", json=_item(protected=True))
    assert r.status_code == 201
    item = r.json()
    assert item["protected"] is True and item["version"] == 1
    r = await client.put(f"/api/v1/personal-vault/items/{item['id']}", json={**_item(), "expected_version": 1})
    assert r.status_code == 200 and r.json()["version"] == 2 and r.json()["protected"] is False
    assert [i["id"] for i in (await client.get("/api/v1/personal-vault/items")).json()] == [item["id"]]
    assert (await client.delete(f"/api/v1/personal-vault/items/{item['id']}")).status_code == 204
    assert (await client.get("/api/v1/personal-vault/items")).json() == []


@pytest.mark.asyncio
async def test_item_requires_config(client, as_user):
    as_user("ana")
    assert (await client.post("/api/v1/personal-vault/items", json=_item())).status_code == 404


@pytest.mark.asyncio
async def test_item_stale_version_conflicts(client, setup_vault):
    item = (await client.post("/api/v1/personal-vault/items", json=_item())).json()
    url = f"/api/v1/personal-vault/items/{item['id']}"
    assert (await client.put(url, json={**_item(), "expected_version": 1})).status_code == 200
    r = await client.put(url, json={**_item(protected=True), "expected_version": 1})
    assert r.status_code == 409 and r.json()["detail"] == "Version conflict"
    assert (await client.get("/api/v1/personal-vault/items")).json()[0]["protected"] is False


@pytest.mark.asyncio
async def test_items_are_isolated(client, setup_vault, as_user):
    item = (await client.post("/api/v1/personal-vault/items", json=_item())).json()
    as_user("bia")
    assert (await client.get("/api/v1/personal-vault/items")).json() == []
    url = f"/api/v1/personal-vault/items/{item['id']}"
    assert (await client.put(url, json={**_item(), "expected_version": 1})).status_code == 404
    assert (await client.delete(url)).status_code == 404
    as_user("ana")
    assert len((await client.get("/api/v1/personal-vault/items")).json()) == 1


@pytest.mark.asyncio
async def test_item_limit(client, setup_vault, monkeypatch):
    monkeypatch.setattr(personal_vault_service, "MAX_PERSONAL_VAULT_ITEMS", 2)
    for _ in range(2):
        assert (await client.post("/api/v1/personal-vault/items", json=_item())).status_code == 201
    r = await client.post("/api/v1/personal-vault/items", json=_item())
    assert r.status_code == 409 and r.json()["detail"] == "Item limit reached"


@pytest.mark.asyncio
async def test_item_body_size_is_limited(client, setup_vault):
    big = {"protected": False, "summary": _envelope(), "body": _envelope(ct_len=65_537)}
    assert (await client.post("/api/v1/personal-vault/items", json=big)).status_code == 422


# ─── Task 5: account deletion ───────────────────────────────────────────────

from sqlalchemy import func, select  # noqa: E402

from app.models.personal_vault import PersonalVault  # noqa: E402


@pytest.mark.asyncio
async def test_delete_account_removes_personal_vault(db_session, user):
    db_session.add(PersonalVault(user_id=user.id, version=1, **_config()))
    db_session.add(PersonalVaultItem(user_id=user.id, summary=_envelope(), body=_envelope()))
    await db_session.flush()
    await AuthService(db_session).delete_account(user)
    assert (await db_session.execute(select(func.count()).select_from(PersonalVaultItem))).scalar() == 0
    assert (await db_session.execute(select(func.count()).select_from(PersonalVault))).scalar() == 0
