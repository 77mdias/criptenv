# ruff: noqa: F811
"""Restricted environments and the hosting sync: found by the final review of the branch.

The sync route is not scoped by CriptEnv environment (the client sends plaintext for a provider
target), so what it can guard is the provider target a restricted environment is bound to.
"""
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.integration import Integration
from app.routers import integrations as integrations_router
from app.services.integration_service import IntegrationService
from tests.test_restricted_environments import _as, _drop_overrides, seed, world  # noqa: F401  (fixtures)

pytestmark = pytest.mark.asyncio


@pytest.fixture
def synced(monkeypatch):
    """The provider call succeeds without leaving the test."""
    sync = AsyncMock(return_value=(True, None, [{"key": "DB_ROOT_PASSWORD", "value": "s3cret"}]))
    monkeypatch.setattr(IntegrationService, "sync_integration", sync)
    monkeypatch.setattr(IntegrationService, "schedule_deploy", AsyncMock(return_value=False))
    return sync


async def _integration(world, seed):
    integration = Integration(
        id=uuid4(), project_id=world.project.id, provider="render", name="DB", config={},
        auto_sync_targets={str(world.secret.id): "production", str(world.envs["staging"].id): "preview"},
    )
    await seed(integration)
    return integration, f"/api/v1/projects/{world.project.id}/integrations/{integration.id}/sync"


def _as_ci(monkeypatch, scope):
    async def _authenticated(project_service, request, db, project_uuid):
        return None, {"environment_scope": scope, "session_id": "s", "ci_token_id": "t"}

    monkeypatch.setattr(integrations_router, "_authenticate_integration_sync_or_ci", _authenticated)


@pytest.mark.parametrize("direction", ["pull", "push"])
async def test_ci_session_not_scoped_to_it_cannot_sync_its_provider_target(
    monkeypatch, client, world, seed, synced, direction,
):
    _, url = await _integration(world, seed)
    body = {"direction": direction, "environment": "production", "secrets": [{"key": "A", "value": "1"}]}

    for scope in (None, "staging"):
        _as_ci(monkeypatch, scope)
        assert (await client.post(url, json=body)).status_code == 404
    synced.assert_not_awaited()


async def test_ci_session_scoped_to_it_can_sync_and_other_targets_stay_open(monkeypatch, client, world, seed, synced):
    _, url = await _integration(world, seed)

    _as_ci(monkeypatch, "db-admin")
    scoped = await client.post(url, json={"direction": "pull", "environment": "production"})
    _as_ci(monkeypatch, None)
    open_target = await client.post(url, json={"direction": "pull", "environment": "preview"})

    assert (scoped.status_code, open_target.status_code) == (200, 200)


async def test_audit_row_of_a_sync_to_its_target_is_hidden_from_a_developer(
    monkeypatch, client, world, seed, synced, factory,
):
    _, url = await _integration(world, seed)
    synced.return_value = (True, None, [])  # a push: nothing had to be recreated at the provider

    async def _admin(project_service, request, db, project_uuid):
        return world.bia, None

    monkeypatch.setattr(integrations_router, "_authenticate_integration_sync_or_ci", _admin)
    for target in ("production", "preview"):
        response = await client.post(url, json={
            "direction": "push", "environment": target, "secrets": [{"key": "DB_ROOT_PASSWORD", "value": "x"}],
        })
        assert response.status_code == 200

    async with factory() as db:
        rows = (await db.scalars(select(AuditLog).where(AuditLog.action == "integration.synced.push"))).all()
    assert sorted(row.meta["environment"] for row in rows) == ["preview", "production"]

    audit = f"/api/v1/projects/{world.project.id}/audit"
    _as(world.caio)
    seen_by_developer = [e["meta"]["environment"] for e in (await client.get(audit)).json()["logs"]]
    _as(world.bia)
    seen_by_admin = [e["meta"]["environment"] for e in (await client.get(audit)).json()["logs"]]

    assert seen_by_developer == ["preview"]
    assert sorted(seen_by_admin) == ["preview", "production"]
