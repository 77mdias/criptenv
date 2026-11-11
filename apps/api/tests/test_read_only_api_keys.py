# ruff: noqa: F811
"""API keys are read-only: read:secrets and read:audit, nothing that writes or administers.

A key sits in a container or a file for months and works without a password or a second factor,
so a leaked key must not be able to change or destroy anything. Writing is for CI tokens (short
sessions) and for the logged-in user.
"""
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.middleware.auth import AuthContext, get_current_auth_context
from app.models.api_key import APIKey
from app.models.audit import AuditLog
from app.schemas.api_key import ApiKeyCreate, ApiKeyResponse
from main import app
from tests.test_restricted_environments import _as, _drop_overrides, seed, world  # noqa: F401  (fixtures)

pytestmark = pytest.mark.asyncio

REMOVED = ["write:secrets", "delete:secrets", "write:integrations", "admin:project"]


# ─── What a key may hold ─────────────────────────────────────────────────────


@pytest.mark.parametrize("scope", REMOVED)
async def test_a_key_cannot_be_created_with_a_write_or_admin_scope(scope):
    with pytest.raises(ValidationError):
        ApiKeyCreate(name="k", scopes=["read:secrets", scope])


async def test_read_audit_is_only_for_a_key_of_every_environment():
    ApiKeyCreate(name="k", scopes=["read:audit"])
    with pytest.raises(ValidationError):
        ApiKeyCreate(name="k", scopes=["read:audit"], environment_scope="production")


async def test_a_listed_key_shows_only_the_scopes_that_still_exist():
    response = ApiKeyResponse(
        id=uuid4(), name="old", prefix="cek_live_", scopes=["read:secrets", "write:secrets", "admin:project"],
        created_at=datetime.now(timezone.utc),
    )
    assert response.scopes == ["read:secrets"]


async def test_create_route_refuses_read_audit_on_an_environment_key(client, world):
    _as(world.ana)

    response = await client.post(
        f"/api/v1/projects/{world.project.id}/api-keys",
        json={"name": "k", "scopes": ["read:audit"], "environment_scope": "production"},
    )

    assert response.status_code == 422


async def test_update_route_refuses_adding_read_audit_to_an_environment_key(client, world, seed):
    key = APIKey(id=uuid4(), user_id=world.ana.id, project_id=world.project.id, name="k", key_hash=uuid4().hex,
                 prefix="cek_live_", scopes=["read:secrets"], environment_scope="production")
    await seed(key)
    _as(world.ana)
    url = f"/api/v1/projects/{world.project.id}/api-keys/{key.id}"

    refused = await client.patch(url, json={"scopes": ["read:secrets", "read:audit"]})
    allowed = await client.patch(url, json={"name": "renamed"})

    assert (refused.status_code, allowed.status_code) == (422, 200)


# ─── read:audit ──────────────────────────────────────────────────────────────


def _with_key(user, world, *, scopes, environment_scope=None, project_id=None):
    key = SimpleNamespace(project_id=project_id or world.project.id, environment_scope=environment_scope, scopes=scopes)
    app.dependency_overrides[get_current_auth_context] = lambda: AuthContext(user=user, auth_type="api_key", api_key=key)


async def _seed_logs(world, seed):
    def log(action, resource_id):
        return AuditLog(id=uuid4(), project_id=world.project.id, user_id=world.ana.id, action=action,
                        resource_type="vault", resource_id=resource_id)

    await seed(log("vault.pushed", world.secret.id), log("vault.pushed", world.envs["staging"].id),
               log("member.added", None))
    return f"/api/v1/projects/{world.project.id}/audit"


async def test_a_key_with_read_audit_reads_the_project_audit_without_restricted_events(client, world, seed):
    url = await _seed_logs(world, seed)
    # An admin's key, "for every environment": still no restricted environment (it is not scoped to it).
    _with_key(world.bia, world, scopes=["read:audit"])

    response = await client.get(url)

    assert response.status_code == 200
    assert response.json()["total"] == 2
    assert str(world.secret.id) not in [entry["resource_id"] for entry in response.json()["logs"]]


async def test_a_key_without_read_audit_is_refused(client, world, seed):
    url = await _seed_logs(world, seed)
    _with_key(world.bia, world, scopes=["read:secrets"])

    assert (await client.get(url)).status_code == 403


async def test_an_environment_key_never_reads_the_audit(client, world, seed):
    url = await _seed_logs(world, seed)
    # A row from before this rule, or written around the API: refused when used.
    _with_key(world.bia, world, scopes=["read:audit"], environment_scope="production")

    assert (await client.get(url)).status_code == 403


async def test_a_key_of_another_project_gets_404(client, world, seed):
    url = await _seed_logs(world, seed)
    _with_key(world.bia, world, scopes=["read:audit"], project_id=uuid4())

    assert (await client.get(url)).status_code == 404


async def test_the_session_still_reads_the_audit(client, world, seed):
    url = await _seed_logs(world, seed)
    _as(world.bia)

    assert (await client.get(url)).json()["total"] == 3


@pytest.mark.parametrize("path", ["/vault/pull", "/vault/version"])
async def test_an_old_admin_project_key_no_longer_reads_secrets(client, world, path):
    _with_key(world.bia, world, scopes=["admin:project"])

    response = await client.get(f"/api/v1/projects/{world.project.id}/environments/{world.envs['staging'].id}{path}")

    assert response.status_code == 403
