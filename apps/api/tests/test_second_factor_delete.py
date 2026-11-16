"""2FA as a second confirmation when a secret is deleted.

Real SQLite DB: the rule depends on the user row (2FA on or off, backup codes
spent), the session's origin and the keys the environment holds.
"""

import hashlib
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import pyotp
import pytest
import pytest_asyncio
from sqlalchemy import func, select

pytest.importorskip("aiosqlite")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import app  # noqa: E402

from app.middleware.auth import get_current_web_user  # noqa: E402
from app.middleware.second_factor import MAX_ATTEMPTS, TWO_FACTOR_HEADER  # noqa: E402
from app.models.environment import Environment  # noqa: E402
from app.models.member import ProjectMember  # noqa: E402
from app.models.project import Project  # noqa: E402
from app.models.user import Session, User  # noqa: E402
from app.models.vault import VaultBlob  # noqa: E402
from app.services.vault_service import compute_blob_checksum  # noqa: E402

SECRET = pyotp.random_base32()
BACKUP_CODE = "AB12CD34"
ITEMS = "/api/v1/personal-vault/items"


def _sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _user(two_factor: bool) -> User:
    return User(
        id=uuid4(), email=f"{uuid4().hex[:8]}@example.com", name="Ana", password_hash="",
        kdf_salt="salt", email_verified=True,
        two_factor_enabled=two_factor,
        two_factor_secret=SECRET.encode("utf-8") if two_factor else None,
        two_factor_backup_codes=[_sha(BACKUP_CODE)] if two_factor else [],
    )


def _code() -> dict[str, str]:
    return {TWO_FACTOR_HEADER: pyotp.TOTP(SECRET).now()}


def _wrong_code() -> dict[str, str]:
    valid = {pyotp.TOTP(SECRET).at(datetime.now(timezone.utc), counter_offset=o) for o in (-1, 0, 1)}
    return {TWO_FACTOR_HEADER: next(c for c in ("000000", "111111", "222222", "333333") if c not in valid)}


def _refusal(response) -> str:
    return response.json()["detail"]["code"]


# ─── Personal vault: deleting an item ───────────────────────────────────────


def _envelope(ct_len=60):
    return {"iv": "A" * 16, "ciphertext": "B" * ct_len, "auth_tag": "C" * 24}


_CONFIG = {
    "kdf": "PBKDF2-SHA256", "iterations": 600_000, "master_salt": "S" * 44, "extra_salt": "T" * 44,
    "master_wrapped_vault_key": _envelope(), "recovery_wrapped_vault_key": _envelope(),
    "extra_wrapped_protected_key": _envelope(), "recovery_wrapped_protected_key": _envelope(),
}


@pytest_asyncio.fixture
async def vault_user(client, factory):
    """A dashboard user with 2FA on and a personal vault; returns a function that adds an item."""
    user = _user(two_factor=True)
    async with factory() as db:
        db.add(user)
        await db.commit()
    app.dependency_overrides[get_current_web_user] = lambda: user
    assert (await client.post("/api/v1/personal-vault/config", json=_CONFIG)).status_code == 201

    async def add_item() -> str:
        payload = {"id": str(uuid4()), "protected": False, "summary": _envelope(), "body": _envelope(200)}
        assert (await client.post(ITEMS, json=payload)).status_code == 201
        return f"{ITEMS}/{payload['id']}"

    yield add_item
    app.dependency_overrides.pop(get_current_web_user, None)


@pytest.mark.asyncio
async def test_vault_item_delete_needs_a_valid_code(client, vault_user):
    url = await vault_user()

    missing = await client.delete(url)
    assert missing.status_code == 403 and _refusal(missing) == "TWO_FACTOR_REQUIRED"
    wrong = await client.delete(url, headers=_wrong_code())
    assert wrong.status_code == 403 and _refusal(wrong) == "TWO_FACTOR_INVALID"
    assert len((await client.get(ITEMS)).json()) == 1

    assert (await client.delete(url, headers=_code())).status_code == 204
    assert (await client.get(ITEMS)).json() == []


@pytest.mark.asyncio
async def test_backup_code_confirms_once(client, vault_user):
    first, second = await vault_user(), await vault_user()
    headers = {TWO_FACTOR_HEADER: BACKUP_CODE.lower()}

    assert (await client.delete(first, headers=headers)).status_code == 204
    reused = await client.delete(second, headers=headers)
    assert reused.status_code == 403 and _refusal(reused) == "TWO_FACTOR_INVALID"


@pytest.mark.asyncio
async def test_confirmation_locks_after_too_many_attempts(client, vault_user):
    url = await vault_user()
    for _ in range(MAX_ATTEMPTS):
        assert (await client.delete(url, headers=_wrong_code())).status_code == 403

    locked = await client.delete(url, headers=_code())
    assert locked.status_code == 429 and _refusal(locked) == "TWO_FACTOR_LOCKED"
    assert len((await client.get(ITEMS)).json()) == 1


@pytest.mark.asyncio
async def test_a_correct_code_clears_earlier_mistakes(client, vault_user):
    urls = [await vault_user() for _ in range(2)]
    for _ in range(MAX_ATTEMPTS - 1):
        assert (await client.delete(urls[0], headers=_wrong_code())).status_code == 403
    assert (await client.delete(urls[0], headers=_code())).status_code == 204

    for _ in range(MAX_ATTEMPTS - 1):
        assert (await client.delete(urls[1], headers=_wrong_code())).status_code == 403
    assert (await client.delete(urls[1], headers=_code())).status_code == 204


# ─── Project vault: a push that drops a secret ──────────────────────────────


def _blob(key_id: str) -> dict:
    iv, ciphertext, auth_tag = "aXY=", "Y3Q=", "dGFn"
    return {"key_id": key_id, "iv": iv, "ciphertext": ciphertext, "auth_tag": auth_tag,
            "checksum": compute_blob_checksum(key_id, iv, ciphertext, auth_tag), "version": 1}


@pytest_asyncio.fixture
async def project(client, factory):
    """A project with secrets A and B. Returns (push, key_count); `push` signs in as asked."""
    users = {True: _user(two_factor=True), False: _user(two_factor=False)}
    project_id, env_id = uuid4(), uuid4()
    tokens = {}
    async with factory() as db:
        db.add_all(users.values())
        await db.flush()
        db.add(Project(id=project_id, owner_id=users[True].id, name="P", slug=f"p-{uuid4().hex[:6]}", settings={}))
        await db.flush()
        db.add(Environment(id=env_id, project_id=project_id, name="production", secrets_version=1))
        for user in users.values():
            db.add(ProjectMember(project_id=project_id, user_id=user.id, role="admin"))
        for key_id in ("A", "B"):
            blob = _blob(key_id)
            db.add(VaultBlob(project_id=project_id, environment_id=env_id, **{k: v.encode() if k in {"iv", "ciphertext", "auth_tag"} else v for k, v in blob.items()}))
        for two_factor, user in users.items():
            for origin in ("web", "cli"):
                raw = f"{origin}-{two_factor}-{uuid4().hex}{uuid4().hex}"
                tokens[(two_factor, origin)] = raw
                db.add(Session(
                    user_id=user.id, token=_sha(raw), client=origin,
                    expires_at=datetime.now(timezone.utc) + timedelta(days=1),
                    last_accessed_at=datetime.now(timezone.utc),
                ))
        await db.commit()

    async def push(keys, *, two_factor=True, origin="web", bearer=None, expected_version=1, headers=None):
        raw = tokens[(two_factor, origin)]
        # The dashboard sends the cookie; the CLI sends the same kind of token as a Bearer header.
        bearer = origin == "cli" if bearer is None else bearer
        auth = {"Authorization": f"Bearer {raw}"} if bearer else {"Cookie": f"session_token={raw}"}
        return await client.post(
            f"/api/v1/projects/{project_id}/environments/{env_id}/vault/push",
            json={"blobs": [_blob(k) for k in keys], "expected_version": expected_version},
            headers={**auth, **(headers or {})},
        )

    async def key_count() -> int:
        async with factory() as db:
            return (await db.execute(select(func.count(VaultBlob.id)).where(VaultBlob.environment_id == env_id))).scalar()

    return push, key_count


@pytest.mark.asyncio
async def test_push_that_drops_a_secret_needs_a_code(project):
    push, key_count = project

    missing = await push(["A"])
    assert missing.status_code == 403 and _refusal(missing) == "TWO_FACTOR_REQUIRED"
    wrong = await push(["A"], headers=_wrong_code())
    assert wrong.status_code == 403 and _refusal(wrong) == "TWO_FACTOR_INVALID"
    assert await key_count() == 2

    assert (await push(["A"], headers=_code())).status_code == 201
    assert await key_count() == 1


@pytest.mark.asyncio
async def test_push_that_keeps_every_secret_is_not_asked(project):
    push, key_count = project
    assert (await push(["A", "B", "C"])).status_code == 201
    assert await key_count() == 3


@pytest.mark.asyncio
async def test_cli_session_is_not_asked(project):
    push, key_count = project
    assert (await push(["A"], origin="cli")).status_code == 201
    assert await key_count() == 1


@pytest.mark.asyncio
async def test_web_token_sent_as_bearer_is_still_asked(project):
    """The session's recorded origin decides, not the header the token travels in."""
    push, key_count = project
    response = await push(["A"], origin="web", bearer=True)
    assert response.status_code == 403 and _refusal(response) == "TWO_FACTOR_REQUIRED"
    assert await key_count() == 2


@pytest.mark.asyncio
async def test_user_without_two_factor_is_not_asked(project):
    push, key_count = project
    assert (await push(["A"], two_factor=False)).status_code == 201
    assert await key_count() == 1


@pytest.mark.asyncio
async def test_stale_push_gets_the_conflict_not_the_code_prompt(project):
    push, key_count = project
    assert (await push(["A"], expected_version=7)).status_code == 409
    assert await key_count() == 2
