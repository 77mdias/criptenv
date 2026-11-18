# ruff: noqa: F811
"""Inheritance in the vault routes: resolved reads, unset on push, the permission rule for credentials
scoped to a child, and the audit trail (key names and origins, never a value)."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.middleware import api_key_auth
from app.middleware.auth import AuthContext, get_current_auth_context
from app.models.api_key import APIKey, hash_api_key
from app.models.audit import AuditLog
from app.models.environment import Environment
from app.models.vault import VaultBlob
from app.routers import ci as ci_router
from main import app
from tests.test_restricted_environments import _as, _drop_overrides, seed, world  # noqa: F401  (fixtures)

pytestmark = pytest.mark.asyncio

CIPHERTEXT_MARK = "SECRET-CIPHERTEXT"


def _blob(env, key, checksum="0" * 64):
    return VaultBlob(id=uuid4(), project_id=env.project_id, environment_id=env.id, key_id=key, iv="iv-x",
                     ciphertext=f"{CIPHERTEXT_MARK}-{env.name}-{key}", auth_tag="tag-x", version=1, checksum=checksum)


def _push_blob(key, checksum="c" * 64):
    return {"key_id": key, "iv": "iv", "ciphertext": f"{CIPHERTEXT_MARK}-{key}", "auth_tag": "t",
            "checksum": checksum, "version": 1}


@pytest_asyncio.fixture
async def tree(world, seed):
    """development (DATABASE_URL, PORT, SENTRY_DSN) <- development/wt (PORT, WEBHOOK_SECRET; unsets SENTRY_DSN)."""
    dev = world.envs["development"]
    child = Environment(id=uuid4(), project_id=world.project.id, name="development/wt", parent_id=dev.id,
                        unset_keys=["SENTRY_DSN"])
    await seed(child, _blob(dev, "DATABASE_URL"), _blob(dev, "PORT"), _blob(dev, "SENTRY_DSN"),
               _blob(child, "PORT"), _blob(child, "WEBHOOK_SECRET"))
    world.dev, world.child = dev, child
    world.base = f"/api/v1/projects/{world.project.id}/environments"
    return world


def _with_key(user, world, scope, key_id=None):
    key = SimpleNamespace(id=key_id or uuid4(), project_id=world.project.id, environment_scope=scope,
                          scopes=["read:secrets"])
    app.dependency_overrides[get_current_auth_context] = lambda: AuthContext(user=user, auth_type="api_key", api_key=key)
    return key


def _by_key(blobs):
    return {b["key_id"]: (b["origin"], b["source_environment_name"], b["environment_id"]) for b in blobs}


async def test_resolved_read_returns_inherited_and_local_blobs_with_their_source(client, tree):
    _as(tree.caio)  # a developer reads an open environment

    response = await client.get(f"{tree.base}/{tree.child.id}/vault/resolved")

    assert response.status_code == 200
    body = response.json()
    assert _by_key(body["blobs"]) == {
        "DATABASE_URL": ("inherited", "development", str(tree.dev.id)),
        "PORT": ("local", "development/wt", str(tree.child.id)),
        "WEBHOOK_SECRET": ("local", "development/wt", str(tree.child.id)),
    }
    assert [e["name"] for e in body["chain"]] == ["development/wt", "development"]
    assert body["unset_keys"] == ["SENTRY_DSN"]


async def test_pull_of_a_child_returns_only_its_overrides_and_unset_keys(client, tree):
    _as(tree.bia)

    body = (await client.get(f"{tree.base}/{tree.child.id}/vault/pull")).json()

    assert sorted(b["key_id"] for b in body["blobs"]) == ["PORT", "WEBHOOK_SECRET"]
    assert body["unset_keys"] == ["SENTRY_DSN"]


async def test_parent_change_propagates_to_the_child_read(client, tree, factory):
    _as(tree.bia)
    async with factory() as db:
        port = await db.scalar(select(VaultBlob).where(VaultBlob.environment_id == tree.dev.id,
                                                        VaultBlob.key_id == "DATABASE_URL"))
        port.ciphertext = f"{CIPHERTEXT_MARK}-rotated"
        db.add(_blob(tree.dev, "NEW_FLAG"))
        await db.commit()

    blobs = (await client.get(f"{tree.base}/{tree.child.id}/vault/resolved")).json()["blobs"]

    by_key = {b["key_id"]: b for b in blobs}
    assert by_key["DATABASE_URL"]["ciphertext"] == f"{CIPHERTEXT_MARK}-rotated"
    assert by_key["NEW_FLAG"]["origin"] == "inherited"


# ─── Permission rule ─────────────────────────────────────────────────────────


async def test_key_scoped_to_child_reads_inherited_values_but_not_the_parent(client, tree):
    _with_key(tree.bia, tree, "development/wt")

    resolved = await client.get(f"{tree.base}/{tree.child.id}/vault/resolved")
    assert resolved.status_code == 200
    # Overridden (PORT) and unset (SENTRY_DSN) parent values are never handed out.
    sent = {(b["key_id"], b["source_environment_name"]) for b in resolved.json()["blobs"]}
    assert ("PORT", "development") not in sent and all(k != "SENTRY_DSN" for k, _ in sent)

    for path in ("/vault/pull", "/vault/resolved", "/vault/version", ""):
        assert (await client.get(f"{tree.base}/{tree.dev.id}{path}")).status_code == 403, path
    listed = (await client.get(tree.base)).json()["environments"]
    assert [e["name"] for e in listed] == ["development/wt"]


async def test_credentials_cannot_write_the_parent_through_the_child(client, tree, monkeypatch):
    # A CI session scoped to the child (with write:secrets) may push the child only.
    async def _session(token, project_id):
        return {"environment_scope": "development/wt", "scopes": ["read:secrets", "write:secrets"],
                "session_id": "s", "ci_token_id": "t"}

    from app.routers import vault as vault_router
    monkeypatch.setattr(vault_router, "validate_ci_session", _session)
    monkeypatch.setattr("app.services.project_service.ProjectService.has_vault_config", lambda self, p: False)
    headers = {"Authorization": "Bearer ci_s_fake-session"}

    refused = await client.post(f"{tree.base}/{tree.dev.id}/vault/push", headers=headers,
                                json={"blobs": [_push_blob("PORT")]})
    allowed = await client.post(f"{tree.base}/{tree.child.id}/vault/push", headers=headers,
                                json={"blobs": [_push_blob("PORT")], "unset_keys": ["SENTRY_DSN"]})

    assert refused.status_code == 403
    assert allowed.status_code == 201, allowed.text


async def test_api_keys_are_read_only_even_when_scoped_to_a_child(client, tree):
    _with_key(tree.bia, tree, "development/wt")
    pushed = await client.post(f"{tree.base}/{tree.child.id}/vault/push", json={"blobs": [_push_blob("PORT")]})
    assert pushed.status_code in (401, 403)


async def test_expired_or_revoked_key_scoped_to_child_is_refused(tree, seed, factory, monkeypatch):
    monkeypatch.setattr(api_key_auth, "async_session_factory", factory)
    revoked_raw = "cek_live_" + uuid4().hex
    now = datetime.now(timezone.utc)
    await seed(APIKey(id=uuid4(), user_id=tree.bia.id, project_id=tree.project.id, name="gone", prefix="cek_live_",
                      key_hash=hash_api_key(revoked_raw), environment_scope="development/wt", revoked_at=now))
    with pytest.raises(api_key_auth.RevokedApiKeyError):
        await api_key_auth.validate_api_key_context(revoked_raw)
    # Expiry is the same check validate_api_key_context runs (SQLite drops the zone, so on the model).
    expired = APIKey(environment_scope="development/wt", expires_at=now - timedelta(minutes=1))
    assert expired.is_expired() and not expired.is_valid()


async def test_ci_secrets_of_a_child_are_resolved_and_scoped(client, tree, monkeypatch):
    session = {"environment_scope": "development/wt", "session_id": "s1", "ci_token_id": "tok-1"}

    async def _authenticated(request, environment):
        if session["environment_scope"] not in (None, environment):
            from fastapi import HTTPException
            raise HTTPException(status_code=403)
        return tree.project.id, session

    monkeypatch.setattr(ci_router, "_authenticate_ci_secrets_request", _authenticated)

    secrets = await client.get("/api/v1/ci/secrets", params={"environment": "development/wt"})
    listed = await client.get("/api/v1/ci/secrets/list", params={"environment": "development/wt"})
    parent = await client.get("/api/v1/ci/secrets", params={"environment": "development"})

    assert secrets.status_code == 200
    assert _by_key(secrets.json()["blobs"])["DATABASE_URL"][:2] == ("inherited", "development")
    assert {k["key_id"]: k["source"] for k in listed.json()["keys"]} == {
        "DATABASE_URL": "development", "PORT": "development/wt", "WEBHOOK_SECRET": "development/wt",
    }
    assert parent.status_code == 403


# ─── Unset through push ──────────────────────────────────────────────────────


async def test_push_unset_on_child_and_set_clears_it(client, tree, factory):
    _as(tree.bia)
    url = f"{tree.base}/{tree.child.id}/vault/push"

    unset = await client.post(url, json={"blobs": [_push_blob("PORT"), _push_blob("WEBHOOK_SECRET")],
                                         "unset_keys": ["SENTRY_DSN", "DATABASE_URL"]})
    assert (unset.status_code, unset.json()["unset_keys"]) == (201, ["DATABASE_URL", "SENTRY_DSN"])
    resolved = (await client.get(f"{tree.base}/{tree.child.id}/vault/resolved")).json()["blobs"]
    assert sorted(b["key_id"] for b in resolved) == ["PORT", "WEBHOOK_SECRET"]

    # Setting a key again (no unset_keys sent: an older client) clears its unset marker.
    reset = await client.post(url, json={"blobs": [_push_blob("PORT"), _push_blob("WEBHOOK_SECRET"),
                                                   _push_blob("DATABASE_URL")]})
    assert reset.json()["unset_keys"] == ["SENTRY_DSN"]

    async with factory() as db:
        parent_keys = set(await db.scalars(select(VaultBlob.key_id).where(VaultBlob.environment_id == tree.dev.id)))
    assert parent_keys == {"DATABASE_URL", "PORT", "SENTRY_DSN"}  # the parent is untouched


async def test_unset_on_a_root_environment_is_refused(client, tree):
    _as(tree.bia)
    refused = await client.post(f"{tree.base}/{tree.dev.id}/vault/push",
                                json={"blobs": [], "unset_keys": ["PORT"]})
    assert (refused.status_code, refused.json()["detail"]) == (422, "Only a child environment can unset inherited keys")


# ─── Audit ───────────────────────────────────────────────────────────────────


async def _audit(factory, action):
    async with factory() as db:
        return list(await db.scalars(select(AuditLog).where(AuditLog.action == action)))


async def test_resolved_read_is_audited_with_key_origins_and_no_values(client, tree, factory):
    key = _with_key(tree.bia, tree, "development/wt")
    await client.get(f"{tree.base}/{tree.child.id}/vault/resolved")

    [row] = await _audit(factory, "vault.resolved_read")
    assert row.resource_id == tree.child.id and row.user_id == tree.bia.id
    assert row.meta["auth_type"] == "api_key" and row.meta["api_key_id"] == str(key.id)
    assert row.meta["environment_name"] == "development/wt"
    assert row.meta["keys"] == [
        {"key": "DATABASE_URL", "source": "development", "origin": "inherited"},
        {"key": "PORT", "source": "development/wt", "origin": "local"},
        {"key": "WEBHOOK_SECRET", "source": "development/wt", "origin": "local"},
    ]
    assert CIPHERTEXT_MARK not in repr(row.meta) and "iv-x" not in repr(row.meta)


async def test_ci_read_is_audited_with_the_token(client, tree, factory, monkeypatch):
    async def _authenticated(request, environment):
        return tree.project.id, {"environment_scope": "development/wt", "session_id": "s1", "ci_token_id": "tok-1"}

    monkeypatch.setattr(ci_router, "_authenticate_ci_secrets_request", _authenticated)
    await client.get("/api/v1/ci/secrets", params={"environment": "development/wt"})

    [row] = await _audit(factory, "vault.resolved_read")
    assert (row.meta["auth_type"], row.meta["ci_token_id"]) == ("ci_session", "tok-1")
    assert {k["key"] for k in row.meta["keys"]} == {"DATABASE_URL", "PORT", "WEBHOOK_SECRET"}
    assert CIPHERTEXT_MARK not in repr(row.meta)


async def test_push_is_audited_per_key_change(client, tree, factory):
    _as(tree.bia)
    await client.post(f"{tree.base}/{tree.child.id}/vault/push", json={
        "blobs": [_push_blob("PORT", checksum="0" * 64), _push_blob("NEW_KEY")],
        "unset_keys": ["DATABASE_URL", "SENTRY_DSN"],
    })

    [row] = await _audit(factory, "vault.pushed")
    assert row.meta["changes"] == {"added": ["NEW_KEY"], "removed": ["WEBHOOK_SECRET"], "unset": ["DATABASE_URL"]}
    assert CIPHERTEXT_MARK not in repr(row.meta)


async def test_pull_is_audited(client, tree, factory):
    _as(tree.bia)
    await client.get(f"{tree.base}/{tree.child.id}/vault/pull")
    [row] = await _audit(factory, "vault.pulled")
    assert [k["key"] for k in row.meta["keys"]] == ["PORT", "WEBHOOK_SECRET"]
