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

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.personal_vault import PersonalVaultItem
from app.models.user import User
from app.schemas.personal_vault import EncryptedBody, EncryptedSummary, PersonalVaultConfigCreate


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
    monkeypatch.setattr(AuthService, "resolve_session", AsyncMock(return_value=(MagicMock(client="web"), user)))
    assert await get_current_web_user(_request(cookies={"session_token": "tok"}), db=MagicMock()) is user


@pytest.mark.asyncio
async def test_web_user_keeps_email_verification_rule(monkeypatch):
    user = _user("ana")
    user.email_verified = False
    monkeypatch.setattr(AuthService, "resolve_session", AsyncMock(return_value=(MagicMock(client="web"), user)))
    with pytest.raises(HTTPException) as exc:
        await get_current_web_user(_request(cookies={"session_token": "tok"}), db=MagicMock())
    assert exc.value.status_code == 403


# ─── Tasks 3-4: HTTP routes ─────────────────────────────────────────────────


from main import app  # noqa: E402


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


def _item(protected=False, item_id=None):
    return {"id": str(item_id or uuid4()), "protected": protected,
            "summary": _envelope(), "body": _envelope(ct_len=200)}


def _update(protected=False, expected_version=1):
    payload = _item(protected)
    payload.pop("id")
    return {**payload, "expected_version": expected_version}


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
    r = await client.put(f"/api/v1/personal-vault/items/{item['id']}", json=_update())
    assert r.status_code == 200 and r.json()["version"] == 2 and r.json()["protected"] is False
    assert [i["id"] for i in (await client.get("/api/v1/personal-vault/items")).json()] == [item["id"]]
    assert (await client.delete(f"/api/v1/personal-vault/items/{item['id']}")).status_code == 204
    assert (await client.get("/api/v1/personal-vault/items")).json() == []


@pytest.mark.asyncio
async def test_item_create_uses_client_id(client, setup_vault):
    item_id = uuid4()
    r = await client.post("/api/v1/personal-vault/items", json=_item(item_id=item_id))
    assert r.status_code == 201 and r.json()["id"] == str(item_id)


@pytest.mark.asyncio
async def test_item_create_duplicate_id_conflicts(client, setup_vault):
    payload = _item()
    assert (await client.post("/api/v1/personal-vault/items", json=payload)).status_code == 201
    r = await client.post("/api/v1/personal-vault/items", json=payload)
    assert r.status_code == 409 and r.json()["detail"] == "Item id already exists"
    assert len((await client.get("/api/v1/personal-vault/items")).json()) == 1


@pytest.mark.parametrize("bad_id", [
    "2F1C9A4E-0000-4000-8000-00000000000A",
    "2f1c9a4e000040008000000000000000",
    "{2f1c9a4e-0000-4000-8000-00000000000a}",
    "urn:uuid:2f1c9a4e-0000-4000-8000-00000000000a",
])
@pytest.mark.asyncio
async def test_item_create_rejects_non_canonical_id(client, setup_vault, bad_id):
    # The client binds its AAD to the exact id string; the server must return that same string.
    payload = {**_item(), "id": bad_id}
    assert (await client.post("/api/v1/personal-vault/items", json=payload)).status_code == 422


@pytest.mark.asyncio
async def test_item_create_requires_an_id(client, setup_vault):
    payload = _item()
    payload.pop("id")
    assert (await client.post("/api/v1/personal-vault/items", json=payload)).status_code == 422


@pytest.mark.asyncio
async def test_item_requires_config(client, as_user):
    as_user("ana")
    assert (await client.post("/api/v1/personal-vault/items", json=_item())).status_code == 404


@pytest.mark.asyncio
async def test_item_stale_version_conflicts(client, setup_vault):
    item = (await client.post("/api/v1/personal-vault/items", json=_item())).json()
    url = f"/api/v1/personal-vault/items/{item['id']}"
    assert (await client.put(url, json=_update())).status_code == 200
    r = await client.put(url, json=_update(protected=True))
    assert r.status_code == 409 and r.json()["detail"] == "Version conflict"
    assert (await client.get("/api/v1/personal-vault/items")).json()[0]["protected"] is False


@pytest.mark.asyncio
async def test_items_are_isolated(client, setup_vault, as_user):
    item = (await client.post("/api/v1/personal-vault/items", json=_item())).json()
    as_user("bia")
    assert (await client.get("/api/v1/personal-vault/items")).json() == []
    url = f"/api/v1/personal-vault/items/{item['id']}"
    assert (await client.put(url, json=_update())).status_code == 404
    assert (await client.delete(url)).status_code == 404
    as_user("ana")
    assert len((await client.get("/api/v1/personal-vault/items")).json()) == 1


from app import plans  # noqa: E402
from app.config import settings  # noqa: E402


def _plan(monkeypatch, **limits):
    """Shrink the free plan's limits for one test (the real ones are 120 items, 10 folders)."""
    free = plans.PLANS["free"]
    monkeypatch.setitem(plans.PLANS, "free", plans.Plan("free", {**free.limits, **limits}))
    monkeypatch.setattr(settings, "DEFAULT_PLAN", "free")


@pytest.mark.asyncio
async def test_item_limit_comes_from_plan(client, setup_vault, monkeypatch):
    _plan(monkeypatch, personal_vault_items=2)
    for _ in range(2):
        assert (await client.post("/api/v1/personal-vault/items", json=_item())).status_code == 201
    r = await client.post("/api/v1/personal-vault/items", json=_item())
    assert r.status_code == 402 and r.json()["detail"] == "Plan limit reached"


@pytest.mark.asyncio
async def test_unlimited_plan_has_no_item_limit(client, setup_vault, monkeypatch):
    _plan(monkeypatch, personal_vault_items=1)
    monkeypatch.setattr(settings, "DEFAULT_PLAN", "unlimited")
    for _ in range(3):
        assert (await client.post("/api/v1/personal-vault/items", json=_item())).status_code == 201


@pytest.mark.asyncio
async def test_over_limit_user_can_still_edit_and_delete(client, setup_vault, monkeypatch):
    _plan(monkeypatch, personal_vault_items=3)
    ids = [(await client.post("/api/v1/personal-vault/items", json=_item())).json()["id"] for _ in range(3)]
    _plan(monkeypatch, personal_vault_items=2)
    assert (await client.put(f"/api/v1/personal-vault/items/{ids[0]}", json=_update())).status_code == 200
    assert (await client.delete(f"/api/v1/personal-vault/items/{ids[1]}")).status_code == 204
    assert (await client.post("/api/v1/personal-vault/items", json=_item())).status_code == 402


@pytest.mark.asyncio
async def test_retry_at_the_limit_is_a_duplicate_not_a_limit(client, setup_vault, monkeypatch):
    # The last allowed item landed but its response was lost: the retry must get the
    # duplicate-id 409 (the web then saves the latest edits over it), not a 402.
    _plan(monkeypatch, personal_vault_items=1)
    payload = _item()
    assert (await client.post("/api/v1/personal-vault/items", json=payload)).status_code == 201
    r = await client.post("/api/v1/personal-vault/items", json=payload)
    assert r.status_code == 409 and r.json()["detail"] == "Item id already exists"


# ─── Folders: encrypted names, item membership stays inside the item summary ─

from app.models.personal_vault import PersonalVaultFolder  # noqa: E402

FOLDERS = "/api/v1/personal-vault/folders"


def _folder(folder_id=None, ct="N" * 40):
    return {"id": str(folder_id or uuid4()), "name": {**_envelope(), "ciphertext": ct}}


@pytest.mark.asyncio
async def test_folder_lifecycle(client, setup_vault):
    created = await client.post(FOLDERS, json=_folder())
    assert created.status_code == 201 and created.json()["version"] == 1
    folder_id = created.json()["id"]
    listed = (await client.get(FOLDERS)).json()
    assert [f["id"] for f in listed] == [folder_id] and listed[0]["name"]["ciphertext"] == "N" * 40
    r = await client.put(f"{FOLDERS}/{folder_id}",
                         json={"name": {**_envelope(), "ciphertext": "R" * 40}, "expected_version": 1})
    assert r.status_code == 200 and r.json()["version"] == 2 and r.json()["name"]["ciphertext"] == "R" * 40
    assert (await client.delete(f"{FOLDERS}/{folder_id}")).status_code == 204
    assert (await client.get(FOLDERS)).json() == []


@pytest.mark.asyncio
async def test_folder_stale_version_conflicts(client, setup_vault):
    folder_id = (await client.post(FOLDERS, json=_folder())).json()["id"]
    body = {"name": _envelope(), "expected_version": 1}
    assert (await client.put(f"{FOLDERS}/{folder_id}", json=body)).status_code == 200
    r = await client.put(f"{FOLDERS}/{folder_id}", json=body)
    assert r.status_code == 409 and r.json()["detail"] == "Version conflict"


@pytest.mark.asyncio
async def test_folder_duplicate_id_conflicts(client, setup_vault):
    payload = _folder()
    assert (await client.post(FOLDERS, json=payload)).status_code == 201
    r = await client.post(FOLDERS, json=payload)
    assert r.status_code == 409 and r.json()["detail"] == "Folder id already exists"
    assert len((await client.get(FOLDERS)).json()) == 1


@pytest.mark.asyncio
async def test_folder_requires_vault(client, as_user):
    as_user("ana")
    assert (await client.post(FOLDERS, json=_folder())).status_code == 404


@pytest.mark.asyncio
async def test_folders_are_per_user(client, setup_vault, as_user):
    folder_id = (await client.post(FOLDERS, json=_folder())).json()["id"]
    as_user("bia")
    assert (await client.get(FOLDERS)).json() == []
    url = f"{FOLDERS}/{folder_id}"
    assert (await client.put(url, json={"name": _envelope(), "expected_version": 1})).status_code == 404
    assert (await client.delete(url)).status_code == 404
    as_user("ana")
    assert len((await client.get(FOLDERS)).json()) == 1


@pytest.mark.asyncio
async def test_folder_limit_comes_from_plan(client, setup_vault, monkeypatch):
    _plan(monkeypatch, personal_vault_folders=2)
    for _ in range(2):
        assert (await client.post(FOLDERS, json=_folder())).status_code == 201
    r = await client.post(FOLDERS, json=_folder())
    assert r.status_code == 402 and r.json()["detail"] == "Plan limit reached"


@pytest.mark.asyncio
async def test_folder_name_size_is_limited(client, setup_vault):
    assert (await client.post(FOLDERS, json=_folder(ct="N" * 1024))).status_code == 201
    assert (await client.post(FOLDERS, json=_folder(ct="N" * 1025))).status_code == 422


@pytest.mark.asyncio
async def test_folder_retry_at_the_limit_is_a_duplicate_not_a_limit(client, setup_vault, monkeypatch):
    _plan(monkeypatch, personal_vault_folders=1)
    payload = _folder()
    assert (await client.post(FOLDERS, json=payload)).status_code == 201
    r = await client.post(FOLDERS, json=payload)
    assert r.status_code == 409 and r.json()["detail"] == "Folder id already exists"


@pytest.mark.asyncio
async def test_deleting_folder_keeps_items(client, setup_vault):
    folder_id = (await client.post(FOLDERS, json=_folder())).json()["id"]
    for _ in range(2):
        await client.post("/api/v1/personal-vault/items", json=_item())
    before = (await client.get("/api/v1/personal-vault/items")).json()
    assert (await client.delete(f"{FOLDERS}/{folder_id}")).status_code == 204
    after = (await client.get("/api/v1/personal-vault/items")).json()
    assert len(after) == 2
    assert sorted((i["id"], i["summary"]["ciphertext"], i["version"]) for i in after) == \
        sorted((i["id"], i["summary"]["ciphertext"], i["version"]) for i in before)


@pytest.mark.asyncio
async def test_item_body_size_is_limited(client, setup_vault):
    big = {"id": str(uuid4()), "protected": False, "summary": _envelope(), "body": _envelope(ct_len=65_537)}
    assert (await client.post("/api/v1/personal-vault/items", json=big)).status_code == 422


# ─── Task 5: account deletion ───────────────────────────────────────────────

from sqlalchemy import func, select  # noqa: E402

from app.models.personal_vault import PersonalVault  # noqa: E402


@pytest.mark.asyncio
async def test_delete_account_removes_personal_vault(db_session, user):
    db_session.add(PersonalVault(user_id=user.id, version=1, **_config()))
    db_session.add(PersonalVaultItem(user_id=user.id, summary=_envelope(), body=_envelope()))
    db_session.add(PersonalVaultFolder(user_id=user.id, name=_envelope()))
    await db_session.flush()
    await AuthService(db_session).delete_account(user)
    assert (await db_session.execute(select(func.count()).select_from(PersonalVaultFolder))).scalar() == 0
    assert (await db_session.execute(select(func.count()).select_from(PersonalVaultItem))).scalar() == 0
    assert (await db_session.execute(select(func.count()).select_from(PersonalVault))).scalar() == 0


# ─── Final review fix: CLI sessions are not web sessions ────────────────────

@pytest.mark.asyncio
async def test_cli_session_token_sent_as_cookie_is_refused(db_session, user):
    auth = AuthService(db_session)
    cli = await auth.create_session(user.id, user_agent="CriptEnv CLI", client="cli")
    web = await auth.create_session(user.id)
    with pytest.raises(HTTPException) as exc:
        await get_current_web_user(_request(cookies={"session_token": cli.plaintext_token}), db=db_session)
    assert exc.value.status_code == 403
    assert exc.value.detail == "Sign in again on the web dashboard to use the personal vault"
    ok = await get_current_web_user(_request(cookies={"session_token": web.plaintext_token}), db=db_session)
    assert ok.id == user.id


@pytest.mark.asyncio
async def test_pre_migration_session_is_told_to_sign_in_again(db_session, user):
    legacy = await AuthService(db_session).create_session(user.id)
    legacy.client = None  # rows created before migration 0015
    await db_session.flush()
    with pytest.raises(HTTPException) as exc:
        await get_current_web_user(_request(cookies={"session_token": legacy.plaintext_token}), db=db_session)
    assert exc.value.status_code == 403
    assert exc.value.detail == "Sign in again on the web dashboard to use the personal vault"


@pytest.mark.asyncio
async def test_unknown_cookie_is_still_401(db_session):
    with pytest.raises(HTTPException) as exc:
        await get_current_web_user(_request(cookies={"session_token": "x" * 40}), db=db_session)
    assert exc.value.status_code == 401


# ─── B3: concurrent vault creation ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_concurrent_create_config_conflicts_not_500(client, as_user, monkeypatch):
    as_user("ana")
    assert (await client.post("/api/v1/personal-vault/config", json=_config())).status_code == 201
    # Simulate the race: the existence check misses the row another request just inserted.
    real_get = personal_vault_service.PersonalVaultService.get_config
    calls = {"n": 0}

    async def racing_get(self, user_id):
        calls["n"] += 1
        return None if calls["n"] == 1 else await real_get(self, user_id)

    monkeypatch.setattr(personal_vault_service.PersonalVaultService, "get_config", racing_get)
    r = await client.post("/api/v1/personal-vault/config", json=_config())
    assert r.status_code == 409 and r.json()["detail"] == "Personal vault already exists"


# ─── B5: every route is web-only ────────────────────────────────────────────

@pytest.mark.parametrize("method,path", [
    ("GET", "/api/v1/personal-vault/config"),
    ("POST", "/api/v1/personal-vault/config"),
    ("PUT", "/api/v1/personal-vault/config"),
    ("GET", "/api/v1/personal-vault/items"),
    ("POST", "/api/v1/personal-vault/items"),
    ("PUT", "/api/v1/personal-vault/items/2f1c9a4e-0000-4000-8000-00000000000a"),
    ("DELETE", "/api/v1/personal-vault/items/2f1c9a4e-0000-4000-8000-00000000000a"),
    ("GET", "/api/v1/personal-vault/folders"),
    ("POST", "/api/v1/personal-vault/folders"),
    ("PUT", "/api/v1/personal-vault/folders/2f1c9a4e-0000-4000-8000-00000000000b"),
    ("DELETE", "/api/v1/personal-vault/folders/2f1c9a4e-0000-4000-8000-00000000000b"),
])
@pytest.mark.asyncio
async def test_every_route_rejects_bearer(client, method, path):
    bodies = {"/api/v1/personal-vault/config": {**_config(), "expected_version": 1},
              "/api/v1/personal-vault/items": _item(),
              "/api/v1/personal-vault/folders": _folder(),
              "/api/v1/personal-vault/folders/2f1c9a4e-0000-4000-8000-00000000000b":
                  {"name": _envelope(), "expected_version": 1}}
    json_body = bodies.get(path, _update()) if method in ("POST", "PUT") else None
    r = await client.request(method, path, json=json_body, headers={"Authorization": "Bearer cek_x"},
                             cookies={"session_token": "t" * 40})
    assert r.status_code == 403
