# ruff: noqa: F811
"""Restricted environments: no read route hands their data to a developer or viewer.

Each test asks the same thing twice: Caio (developer) must not get it, Bia (admin) must.
"""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.routers import integrations as integrations_router
from app.routers import rotation
from app.services.project_service import ProjectService

from app.models.audit import AuditLog
from app.models.integration import Integration
from app.models.member import CIToken, ProjectMember
from app.models.secret_expiration import SecretExpiration
from app.models.vault import VaultBlob
from tests.test_restricted_environments import _as, _drop_overrides, seed, world  # noqa: F401  (fixtures)

pytestmark = pytest.mark.asyncio

SOON = datetime.now(timezone.utc) + timedelta(days=3)


def _blob(env, key):
    return VaultBlob(id=uuid4(), project_id=env.project_id, environment_id=env.id, key_id=key,
                     iv="iv", ciphertext="ct", auth_tag="tag", version=1, checksum="0" * 64)


def _expiration(env, key):
    return SecretExpiration(id=uuid4(), project_id=env.project_id, environment_id=env.id,
                            secret_key=key, expires_at=SOON)


def _base(world):
    return f"/api/v1/projects/{world.project.id}"


async def _both(client, world, url):
    """The same GET as the developer and as the admin."""
    _as(world.caio)
    developer = await client.get(url)
    _as(world.bia)
    admin = await client.get(url)
    return developer, admin


async def test_vault_pull_and_version_are_404_for_a_developer(client, world, seed):
    await seed(_blob(world.secret, "DB_ROOT_PASSWORD"))
    vault = f"{_base(world)}/environments/{world.secret.id}/vault"

    for path in ("/pull", "/version"):
        developer, admin = await _both(client, world, vault + path)
        assert (developer.status_code, admin.status_code) == (404, 200), path

    _as(world.caio)
    open_vault = f"{_base(world)}/environments/{world.envs['staging'].id}/vault/pull"
    assert (await client.get(open_vault)).status_code == 200


async def test_rotation_routes_are_404_for_a_developer(client, world, db_session):
    # Every rotation and expiration route goes through this one check.
    async def check(user):
        await rotation._check_access(user, world.project.id, world.secret.id, ProjectService(db_session), db_session)

    with pytest.raises(HTTPException) as refused:
        await check(world.caio)
    assert (refused.value.status_code, refused.value.detail) == (404, "Environment not found")
    await check(world.bia)

    _as(world.caio)
    history = f"{_base(world)}/environments/{world.secret.id}/secrets/DB_ROOT_PASSWORD/rotation/history"
    assert (await client.get(history)).status_code == 404


async def test_expiring_list_hides_restricted_items(client, world, seed):
    # Only the restricted environment has an expiration. (SQLite hands dates back without a zone and the
    # route compares them with aware ones, so the admin side of this list cannot run on the test database.)
    await seed(_expiration(world.secret, "DB_ROOT_PASSWORD"))
    _as(world.caio)

    developer = await client.get(f"{_base(world)}/secrets/expiring?days=30&include_expired=true")

    assert (developer.status_code, developer.json()["items"]) == (200, [])


async def test_matrix_hides_the_restricted_column(client, world, seed):
    await seed(_blob(world.secret, "DB_ROOT_PASSWORD"), _blob(world.envs["staging"], "API_KEY"))

    developer, admin = await _both(client, world, f"{_base(world)}/secrets/matrix")

    assert "db-admin" not in [env["name"] for env in developer.json()["environments"]]
    assert [row["key_id"] for row in developer.json()["keys"]] == ["API_KEY"]
    assert "db-admin" in [env["name"] for env in admin.json()["environments"]]
    assert sorted(row["key_id"] for row in admin.json()["keys"]) == ["API_KEY", "DB_ROOT_PASSWORD"]


async def test_me_overview_hides_the_restricted_environment_and_its_alerts(client, world, seed):
    await seed(_blob(world.secret, "DB_ROOT_PASSWORD"), _expiration(world.secret, "DB_ROOT_PASSWORD"))

    developer, admin = await _both(client, world, "/api/v1/me/overview")

    def names(response):
        return [env["name"] for project in response.json()["projects"] for env in project["environments"]]

    def alerts(response):
        attention = response.json()["attention"]
        return [item["secret_key"] for item in [*attention["expired"], *attention["expiring"]]]

    assert "db-admin" not in names(developer) and alerts(developer) == []
    assert "db-admin" in names(admin) and alerts(admin) == ["DB_ROOT_PASSWORD"]


async def test_audit_hides_events_of_the_restricted_environment(client, world, seed):
    def log(action, resource_id):
        return AuditLog(id=uuid4(), project_id=world.project.id, user_id=world.ana.id, action=action,
                        resource_type="vault", resource_id=resource_id)

    await seed(log("vault.pushed", world.secret.id), log("vault.pushed", world.envs["staging"].id),
               log("project.updated", world.project.id))

    developer, admin = await _both(client, world, f"{_base(world)}/audit")

    assert (developer.json()["total"], admin.json()["total"]) == (2, 3)
    assert str(world.secret.id) not in [entry["resource_id"] for entry in developer.json()["logs"]]


async def test_integrations_hide_bindings_of_the_restricted_environment(monkeypatch, client, world, seed):
    # The list route calls get_current_user directly, not as a dependency.
    current = {}

    async def _current_user(request, db):
        return current["user"]

    monkeypatch.setattr(integrations_router, "get_current_user", _current_user)

    async def _both(client, world, url):  # noqa: F811  (same as the module helper, also feeding the patch above)
        results = []
        for user in (world.caio, world.bia):
            current["user"] = user
            _as(user)
            results.append(await client.get(url))
        return results

    integration = Integration(
        id=uuid4(), project_id=world.project.id, provider="vercel", name="Site", config={},
        auto_sync_targets={str(world.secret.id): "production", str(world.envs["staging"].id): "preview"},
    )
    await seed(integration)
    staging_only = {str(world.envs["staging"].id): "preview"}

    listed_dev, listed_admin = await _both(client, world, f"{_base(world)}/integrations")
    one_dev, one_admin = await _both(client, world, f"{_base(world)}/integrations/{integration.id}")

    assert listed_dev.json()["integrations"][0]["auto_sync_targets"] == staging_only
    assert one_dev.json()["auto_sync_targets"] == staging_only
    assert len(listed_admin.json()["integrations"][0]["auto_sync_targets"]) == 2
    assert len(one_admin.json()["auto_sync_targets"]) == 2


async def test_ci_token_list_hides_tokens_scoped_to_it(client, world, seed):
    def token(name, scope):
        return CIToken(id=uuid4(), project_id=world.project.id, name=name, token_hash=uuid4().hex,
                       scopes=["read:secrets"], environment_scope=scope, created_by=world.ana.id)

    await seed(token("db", "db-admin"), token("app", "production"), token("all", None))

    developer, admin = await _both(client, world, f"{_base(world)}/tokens")

    assert sorted(t["name"] for t in developer.json()["tokens"]) == ["all", "app"]
    assert sorted(t["name"] for t in admin.json()["tokens"]) == ["all", "app", "db"]


async def test_demoted_admin_loses_access_at_once(client, world, factory):
    url = f"{_base(world)}/environments/{world.secret.id}/vault/pull"
    _as(world.bia)
    assert (await client.get(url)).status_code == 200

    async with factory() as db:
        membership = await db.scalar(select(ProjectMember).where(ProjectMember.user_id == world.bia.id))
        membership.role = "developer"
        await db.commit()

    assert (await client.get(url)).status_code == 404
