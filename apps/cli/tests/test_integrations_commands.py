from types import SimpleNamespace
from unittest.mock import patch, AsyncMock, MagicMock

import pytest
from click.testing import CliRunner

from criptenv.cli import main


def _make_mock_db():
    db = MagicMock()
    db.execute = AsyncMock(return_value=MagicMock())
    return db


def test_integrations_commands_are_registered():
    runner = CliRunner()

    result = runner.invoke(main, ["integrations", "--help"])

    assert result.exit_code == 0
    assert "list" in result.output
    assert "connect" in result.output
    assert "disconnect" in result.output
    assert "sync" in result.output
    assert "validate" in result.output


def test_railway_connect_rejected_as_invalid_choice():
    runner = CliRunner()

    result = runner.invoke(
        main,
        [
            "integrations",
            "connect",
            "railway",
            "--token",
            "railway-token",
            "--project-id",
            "railway-project",
        ],
    )

    assert result.exit_code == 2
    assert "Invalid value" in result.output


@patch("criptenv.commands.integrations.async_cli_context")
def test_integrations_validate(mock_ctx):
    runner = CliRunner()
    mock_client = AsyncMock()
    # Shape returned by POST /integrations/{id}/validate
    mock_client.validate_integration = AsyncMock(return_value={"valid": True, "error": None})
    mock_ctx.return_value.__aenter__ = AsyncMock(return_value=(_make_mock_db(), None, mock_client))
    mock_ctx.return_value.__aexit__ = AsyncMock(return_value=None)

    result = runner.invoke(main, ["integrations", "validate", "int_123", "--project", "00000000-0000-4000-8000-000000000123"])
    assert result.exit_code == 0
    assert "is valid" in result.output


@patch("criptenv.commands.integrations.async_cli_context")
def test_integrations_validate_invalid(mock_ctx):
    runner = CliRunner()
    mock_client = AsyncMock()
    mock_client.validate_integration = AsyncMock(
        return_value={"valid": False, "error": "Vercel API returned 403: Forbidden"}
    )
    mock_ctx.return_value.__aenter__ = AsyncMock(return_value=(_make_mock_db(), None, mock_client))
    mock_ctx.return_value.__aexit__ = AsyncMock(return_value=None)

    result = runner.invoke(main, ["integrations", "validate", "int_123", "--project", "00000000-0000-4000-8000-000000000123"])
    assert result.exit_code == 1
    assert "invalid: Vercel API returned 403: Forbidden" in result.output


@pytest.mark.asyncio
async def test_client_list_integrations_reads_api_envelope():
    """GET /integrations answers {"integrations": [...]} — reading "items" hid every integration."""
    from criptenv.api.client import CriptEnvClient

    client = CriptEnvClient.__new__(CriptEnvClient)
    response = MagicMock()
    response.json.return_value = {"integrations": [{"id": "i1", "provider": "vercel"}], "total": 1}
    client._request = AsyncMock(return_value=response)

    assert await client.list_integrations("p1") == [{"id": "i1", "provider": "vercel"}]


def _sync_env(monkeypatch, client, entries=None, blobs=None):
    """Patch the sync command's context, project resolution and vault."""
    from contextlib import contextmanager

    from criptenv.commands import integrations as integrations_module

    @contextmanager
    def fake_cli_context(*_args, **_kwargs):
        yield object(), None, client

    vault = MagicMock()
    vault.load_state = AsyncMock(return_value=SimpleNamespace(blobs=blobs or []))
    vault.decrypt_all = AsyncMock(return_value=entries or {})
    monkeypatch.setattr(integrations_module, "cli_context", fake_cli_context)
    monkeypatch.setattr(integrations_module, "resolve_project_id", lambda *a, **k: "proj-1")
    monkeypatch.setattr(integrations_module, "RemoteVault", lambda *_a: vault)
    imported = MagicMock(return_value=(1, 0))
    monkeypatch.setattr(integrations_module, "import_entries_into_vault", imported)
    return vault, imported


def test_sync_push_sends_decrypted_environment(monkeypatch):
    client = MagicMock()
    client.list_integrations = AsyncMock(return_value=[{"id": "int_1", "provider": "vercel", "name": "V"}])
    client.sync_integration = AsyncMock(return_value={"success": True, "synced_count": 2})
    _sync_env(monkeypatch, client, entries={"A": "1", "B": "2"})

    result = CliRunner().invoke(
        main, ["integrations", "sync", "--provider", "vercel", "--env", "staging", "--target", "preview"]
    )

    assert result.exit_code == 0, result.output
    client.sync_integration.assert_awaited_once_with(
        "proj-1",
        "int_1",
        direction="push",
        environment="preview",
        secrets=[{"key": "A", "value": "1"}, {"key": "B", "value": "2"}],
    )
    assert "Pushed 2 secret(s)" in result.output


def test_sync_push_sends_kind_and_reports_recreated(monkeypatch):
    client = MagicMock()
    client.list_integrations = AsyncMock(return_value=[{"id": "int_1", "provider": "vercel", "name": "V"}])
    client.sync_integration = AsyncMock(return_value={"success": True, "synced_count": 2, "recreated": ["A"]})
    _sync_env(
        monkeypatch,
        client,
        entries={"A": "1", "B": "2"},
        blobs=[{"key_id": "A", "kind": "secret"}, {"key_id": "B"}],
    )

    result = CliRunner().invoke(main, ["integrations", "sync", "--provider", "vercel", "--target", "production"])

    assert result.exit_code == 0, result.output
    assert client.sync_integration.await_args.kwargs["secrets"] == [
        {"key": "A", "value": "1", "kind": "secret"},
        {"key": "B", "value": "2"},
    ]
    assert "Recreated in vercel with the new type: A" in result.output


def test_sync_reports_provider_failure_with_exit_code(monkeypatch):
    client = MagicMock()
    client.list_integrations = AsyncMock(return_value=[{"id": "int_1", "provider": "vercel"}])
    client.sync_integration = AsyncMock(
        return_value={"success": False, "message": "Vercel API returned 403: Not authorized"}
    )
    _sync_env(monkeypatch, client, entries={"A": "1"})

    result = CliRunner().invoke(main, ["integrations", "sync", "--provider", "vercel"])

    assert result.exit_code == 1
    assert "Vercel API returned 403: Not authorized" in result.output


def test_sync_pull_encrypts_provider_values_into_vault(monkeypatch):
    client = MagicMock()
    client.list_integrations = AsyncMock(return_value=[{"id": "int_1", "provider": "render"}])
    client.sync_integration = AsyncMock(
        return_value={"success": True, "synced_count": 1, "secrets": [{"key": "A", "value": "1"}]}
    )
    vault, imported = _sync_env(monkeypatch, client)

    result = CliRunner().invoke(
        main, ["integrations", "sync", "--provider", "render", "--direction", "pull", "--overwrite"]
    )

    assert result.exit_code == 0, result.output
    client.sync_integration.assert_awaited_once_with(
        "proj-1", "int_1", direction="pull", environment="production"
    )
    imported.assert_called_once_with(vault, [("A", "1")], "production", True)


def test_pick_integration_refuses_to_guess_between_several():
    import click

    from criptenv.commands.integrations import pick_integration

    items = [
        {"id": "a", "provider": "vercel", "name": "Prod"},
        {"id": "b", "provider": "vercel", "name": "Preview"},
    ]
    with pytest.raises(click.ClickException, match="--integration"):
        pick_integration(items, "vercel", None)
    assert pick_integration(items, "vercel", "b")["name"] == "Preview"


def test_ci_deploy_without_session_reports_login_hint(mock_config_dir, monkeypatch):
    runner = CliRunner()

    init = runner.invoke(main, ["init"])
    assert init.exit_code == 0

    with runner.isolated_filesystem():
        with open(".env.production", "w") as f:
            f.write("API_KEY=secret\n")
        result = runner.invoke(main, ["ci", "deploy", "--env", "production", "--file", ".env.production"])

    # CI must fail the pipeline step, not pass silently
    assert result.exit_code == 1
    assert "No active CI session" in result.output


def test_connect_does_not_raise_unbound_local(monkeypatch):
    """Regression (Sprint 3, 2026-10): assigning to the outer parameters
    `token`/`project_id_opt` inside the nested `_do_connect()` made them
    closure locals, so `if not token` raised UnboundLocalError on every
    invocation. Found by the ruff F823 CI gate."""
    from contextlib import asynccontextmanager

    from criptenv.commands import integrations as integrations_module

    created = {}

    class FakeClient:
        async def create_integration(self, **kwargs):
            created.update(kwargs)
            return {"id": "int_1", "status": "active"}

    @asynccontextmanager
    async def fake_cli_context(*_args, **_kwargs):
        yield object(), None, FakeClient()

    async def fake_resolve_project_id(db, project, client=None):
        return "00000000-0000-4000-8000-000000000123"

    monkeypatch.setattr(integrations_module, "async_cli_context", fake_cli_context)
    monkeypatch.setattr(
        integrations_module, "resolve_project_id_async", fake_resolve_project_id
    )

    runner = CliRunner()
    result = runner.invoke(
        main,
        [
            "integrations",
            "connect",
            "vercel",
            "--token",
            "tok_xxx",
            "--project-id",
            "prj_provider",
        ],
    )

    assert "UnboundLocalError" not in str(result.exception)
    assert result.exit_code == 0, result.output
    assert created["config"]["api_token"] == "tok_xxx"
    assert created["config"]["project_id"] == "prj_provider"


def test_ci_deploy_uses_only_ci_routes(mock_config_dir, monkeypatch):
    """Regression: `ci deploy` went through RemoteVault.load_state, which calls
    the project/environments/vault-pull routes that reject CI sessions (401).
    It must seed state from GET /ci/secrets and write via vault/push only."""
    import asyncio

    from criptenv.commands import ci as ci_module
    from criptenv.crypto.keys import build_project_vault_config
    from criptenv.remote_vault import RemoteVault

    vault_config, _proof = build_project_vault_config("ci-vault-pw")
    pushed = {}

    class FakeClient:
        async def get_ci_secrets(self, project_id, environment):
            assert (project_id, environment) == ("prj_1", "production")
            return {"blobs": [], "version": 3, "environment_id": "env_1", "vault_config": vault_config}

        async def push_vault(self, project_id, env_id, blobs, vault_proof, expected_version):
            pushed.update(env_id=env_id, blobs=blobs, expected_version=expected_version)
            return {"version": 4}

        async def _forbidden(self, *_a, **_k):
            raise AssertionError("CI deploy must not call user-only routes")

        get_project = list_environments = pull_vault = _forbidden

    class FakeSession:
        project_id = "prj_1"
        environment_scope = None
        scopes = ["write:secrets"]

    class FakeManager:
        async def get_active_session(self):
            return FakeSession()

        async def get_authenticated_client(self):
            return FakeClient()

    monkeypatch.setattr(ci_module, "_ci_manager", lambda db: FakeManager())
    monkeypatch.setenv("CRIPTENV_VAULT_PASSWORD", "ci-vault-pw")

    runner = CliRunner()
    assert runner.invoke(main, ["init"]).exit_code == 0
    with runner.isolated_filesystem():
        with open(".env.production", "w") as f:
            f.write("API_KEY=from-ci\n")
        result = runner.invoke(main, ["ci", "deploy", "--env", "production", "--file", ".env.production"])

    assert result.exit_code == 0, result.output
    assert "Deployment complete" in result.output
    assert pushed["env_id"] == "env_1" and pushed["expected_version"] == 3
    # The pushed blob decrypts with the project vault password
    vault = RemoteVault(FakeClient(), "prj_1")
    vault.load_ci_state({"environment_id": "env_1", "vault_config": vault_config}, "production")
    assert asyncio.run(vault.decrypt_blob(pushed["blobs"][0], "env_1")) == b"from-ci"
