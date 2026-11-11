# ruff: noqa: F811
"""Restricted environments: a CI token or an API key with no scope does not reach them."""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.middleware.api_key_auth import require_api_key_environment
from app.middleware.auth import AuthContext, get_current_auth_context
from app.middleware.ci_auth import require_ci_session_environment
from app.routers import ci as ci_router
from app.services.environment_access import hidden_ids_for_credential
from main import app
from tests.test_restricted_environment_routes import _blob
from tests.test_restricted_environments import _drop_overrides, seed, world  # noqa: F401  (fixtures)

pytestmark = pytest.mark.asyncio


def _status(call) -> int | None:
    try:
        call()
    except HTTPException as error:
        return error.status_code
    return None


async def test_unscoped_credentials_are_refused_on_a_restricted_environment():
    unscoped_ci, scoped_ci = {"environment_scope": None}, {"environment_scope": "db-admin"}
    unscoped_key, scoped_key = SimpleNamespace(environment_scope=None), SimpleNamespace(environment_scope="db-admin")

    assert _status(lambda: require_ci_session_environment(unscoped_ci, "db-admin", restricted=True)) == 404
    assert _status(lambda: require_api_key_environment(unscoped_key, "db-admin", restricted=True)) == 404
    assert _status(lambda: require_ci_session_environment(scoped_ci, "db-admin", restricted=True)) is None
    assert _status(lambda: require_api_key_environment(scoped_key, "db-admin", restricted=True)) is None
    # Open environments keep working as before.
    assert _status(lambda: require_ci_session_environment(unscoped_ci, "staging")) is None
    assert _status(lambda: require_api_key_environment(unscoped_key, "staging")) is None
    assert _status(lambda: require_ci_session_environment(scoped_ci, "staging")) == 403


async def test_hidden_ids_for_credential(db_session, world):
    assert await hidden_ids_for_credential(db_session, world.project.id, None) == {world.secret.id}
    assert await hidden_ids_for_credential(db_session, world.project.id, "production") == {world.secret.id}
    assert await hidden_ids_for_credential(db_session, world.project.id, "db-admin") == set()


def _with_key(user, world, scope):
    key = SimpleNamespace(project_id=world.project.id, environment_scope=scope, scopes=["read:secrets"])
    app.dependency_overrides[get_current_auth_context] = lambda: AuthContext(user=user, auth_type="api_key", api_key=key)


async def test_unscoped_api_key_cannot_pull_it_and_does_not_list_it(client, world, seed):
    await seed(_blob(world.secret, "DB_ROOT_PASSWORD"))
    base = f"/api/v1/projects/{world.project.id}"
    _with_key(world.bia, world, None)  # an admin's key, for "all environments"

    listed = (await client.get(f"{base}/environments")).json()
    matrix = (await client.get(f"{base}/secrets/matrix")).json()

    assert "db-admin" not in [env["name"] for env in listed["environments"]]
    assert "db-admin" not in [env["name"] for env in matrix["environments"]]
    assert matrix["keys"] == []
    assert (await client.get(f"{base}/environments/{world.secret.id}")).status_code == 404
    assert (await client.get(f"{base}/environments/{world.secret.id}/vault/pull")).status_code == 404
    assert (await client.get(f"{base}/environments/{world.secret.id}/vault/version")).status_code == 404


async def test_api_key_scoped_to_it_can_while_its_creator_is_admin(client, world, seed):
    await seed(_blob(world.secret, "DB_ROOT_PASSWORD"))
    base = f"/api/v1/projects/{world.project.id}"

    _with_key(world.bia, world, "db-admin")
    assert (await client.get(f"{base}/environments/{world.secret.id}/vault/pull")).status_code == 200
    assert [env["name"] for env in (await client.get(f"{base}/environments")).json()["environments"]] == ["db-admin"]

    # The same key in the hands of someone who is not (or no longer) an admin.
    _with_key(world.caio, world, "db-admin")
    assert (await client.get(f"{base}/environments/{world.secret.id}/vault/pull")).status_code == 404
    assert (await client.get(f"{base}/environments")).json()["environments"] == []


@pytest.mark.parametrize("path", ["/api/v1/ci/secrets", "/api/v1/ci/secrets/list"])
async def test_ci_session_reaches_a_restricted_environment_only_when_scoped_to_it(
    monkeypatch, client, world, seed, path,
):
    await seed(_blob(world.secret, "DB_ROOT_PASSWORD"))
    session = {"environment_scope": None}

    async def _authenticated(request, environment):
        return world.project.id, session

    monkeypatch.setattr(ci_router, "_authenticate_ci_secrets_request", _authenticated)

    assert (await client.get(path, params={"environment": "db-admin"})).status_code == 404
    session["environment_scope"] = "db-admin"
    assert (await client.get(path, params={"environment": "db-admin"})).status_code == 200
    session["environment_scope"] = None
    assert (await client.get(path, params={"environment": "staging"})).status_code == 200
