"""Auto-sync: saving in the CLI sends the environment to the bound hosting connections.

Real client-side crypto against the stateful fake API client from conftest; the
hosting side is only what the fake records.
"""

from contextlib import ExitStack
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from click.testing import CliRunner

from criptenv.api.client import CriptEnvAPIError
from criptenv.cli import main
from tests.conftest import RemoteVaultFakeClient, remote_cli_context_for

PROJECT = "00000000-0000-4000-8000-000000000123"


class HostedClient(RemoteVaultFakeClient):
    """The fake vault client plus one Vercel connection bound production → preview."""

    def __init__(self, features=("auto_sync",), targets=None):
        super().__init__()
        self.features = list(features)
        self.integrations = [{
            "id": "int_1", "provider": "vercel", "name": "Site",
            "auto_sync_targets": {"env_prod": "preview"} if targets is None else targets,
        }]
        self.sync_calls: list[dict] = []
        self.sync_result: dict | Exception = {"success": True, "synced_count": 1}
        self.pulls = 0

    async def pull_vault(self, project_id, env_id):
        self.pulls += 1
        return await super().pull_vault(project_id, env_id)

    async def integrations_envelope(self, project_id):
        return {"integrations": self.integrations, "features": self.features}

    async def list_integrations(self, project_id):
        return self.integrations

    async def sync_integration(self, project_id, integration_id, **kwargs):
        self.sync_calls.append({"integration_id": integration_id, **kwargs})
        if isinstance(self.sync_result, Exception):
            raise self.sync_result
        return self.sync_result


@pytest.fixture
def hosted(monkeypatch):
    monkeypatch.setenv("CRIPTENV_VAULT_PASSWORD", "vault-password-123")
    return HostedClient()


def run(client, *args):
    """Invoke the CLI with every command module talking to the fake client."""
    with ExitStack() as stack:
        for module in ("secrets", "import_export", "integrations"):
            stack.enter_context(patch(f"criptenv.commands.{module}.cli_context", remote_cli_context_for(client)))
        return CliRunner().invoke(main, list(args))


def pushes(client):
    return [call for call in client.sync_calls if call["direction"] == "push"]


def test_set_sends_the_environment_to_the_bound_connection(hosted):
    run(hosted, "set", "OLD=0", "-p", PROJECT)
    result = run(hosted, "set", "A=1", "--secret", "-p", PROJECT)

    assert result.exit_code == 0, result.output
    assert "✓ Set A" in result.output and "✓ Sent to Site (preview)" in result.output
    last = pushes(hosted)[-1]
    assert (last["integration_id"], last["environment"]) == ("int_1", "preview")
    assert sorted(last["secrets"], key=lambda s: s["key"]) == [
        {"key": "A", "value": "1", "kind": "secret"},
        {"key": "OLD", "value": "0"},
    ]
    assert "delete_keys" not in last or not last["delete_keys"]


def test_set_mentions_the_scheduled_deploy(hosted):
    hosted.sync_result = {"success": True, "synced_count": 1, "deploy_scheduled": True}

    result = run(hosted, "set", "A=1", "-p", PROJECT)

    assert "✓ Sent to Site (preview) — deploy in about a minute" in result.output


def test_delete_sends_only_that_key_as_delete_keys(hosted):
    run(hosted, "set", "A=1", "-p", PROJECT)
    run(hosted, "set", "B=2", "-p", PROJECT)

    result = run(hosted, "delete", "A", "--force", "-p", PROJECT)

    assert result.exit_code == 0, result.output
    last = pushes(hosted)[-1]
    assert last["delete_keys"] == ["A"]
    assert last["secrets"] == [{"key": "B", "value": "2"}]


def test_deleting_the_last_secret_still_tells_the_provider(hosted):
    run(hosted, "set", "A=1", "-p", PROJECT)

    run(hosted, "delete", "A", "--force", "-p", PROJECT)

    last = pushes(hosted)[-1]
    assert (last["secrets"], last["delete_keys"]) == ([], ["A"])


@pytest.mark.parametrize("features, targets", [
    ((), {"env_prod": "preview"}),          # binding stored, owner no longer on Max
    (("auto_sync",), {}),                   # Max, nothing bound
    (("auto_sync",), {"env_other": "production"}),  # bound, but another environment
])
def test_nothing_is_sent_without_the_feature_or_without_a_binding(monkeypatch, features, targets):
    monkeypatch.setenv("CRIPTENV_VAULT_PASSWORD", "vault-password-123")
    client = HostedClient(features=features, targets=targets)

    result = run(client, "set", "A=1", "-p", PROJECT)

    assert result.exit_code == 0, result.output
    assert client.sync_calls == []
    assert "Sent to" not in result.output


def test_no_extra_vault_read_when_there_is_nothing_to_send(monkeypatch):
    monkeypatch.setenv("CRIPTENV_VAULT_PASSWORD", "vault-password-123")
    client = HostedClient(features=())

    run(client, "set", "A=1", "-p", PROJECT)

    assert client.pulls == 1  # only the command's own load


def test_provider_failure_warns_and_exits_zero(hosted):
    hosted.sync_result = {"success": False, "message": "Vercel API returned 403: forbidden"}

    result = run(hosted, "set", "A=1", "-p", PROJECT)

    assert result.exit_code == 0, result.output
    assert "✓ Set A" in result.output
    assert "Could not send to Site: Vercel API returned 403: forbidden" in result.output
    assert "Your secrets are saved" in result.output
    assert (
        "criptenv integrations sync --provider vercel --integration int_1 --env production --target preview"
        in result.output
    )
    assert hosted.blobs and hosted.blobs[0]["key_id"] == "A"


def test_failed_removal_names_the_keys_and_gives_a_retry_that_removes_them(hosted):
    run(hosted, "set", "A=1", "-p", PROJECT)
    run(hosted, "set", "B=2", "-p", PROJECT)
    hosted.sync_result = {"success": False, "message": "boom"}

    result = run(hosted, "delete", "A", "--force", "-p", PROJECT)

    assert result.exit_code == 0, result.output
    assert "✓ Deleted A" in result.output
    assert "Not removed at Site: A." in result.output
    assert (
        "criptenv integrations sync --provider vercel --integration int_1 --env production --target preview --delete A"
        in result.output
    )


def test_manual_sync_can_remove_keys_at_the_provider(hosted):
    run(hosted, "set", "B=2", "-p", PROJECT)
    hosted.sync_calls.clear()

    result = run(
        hosted, "integrations", "sync", "--provider", "vercel", "--target", "preview",
        "--delete", "A", "--delete", "OLD", "--project", PROJECT,
    )

    assert result.exit_code == 0, result.output
    assert hosted.sync_calls[-1]["delete_keys"] == ["A", "OLD"]
    assert hosted.sync_calls[-1]["secrets"] == [{"key": "B", "value": "2"}]
    assert "Removed 2 key(s)" in result.output


def test_manual_sync_removes_keys_even_when_the_environment_is_empty(hosted):
    result = run(
        hosted, "integrations", "sync", "--provider", "vercel", "--delete", "A", "--project", PROJECT,
    )

    assert result.exit_code == 0, result.output
    assert (hosted.sync_calls[-1]["secrets"], hosted.sync_calls[-1]["delete_keys"]) == ([], ["A"])


def test_manual_sync_refuses_delete_on_pull(hosted):
    result = run(
        hosted, "integrations", "sync", "--provider", "vercel", "--direction", "pull",
        "--delete", "A", "--project", PROJECT,
    )

    assert result.exit_code == 1
    assert "--delete only works with --direction push" in result.output
    assert hosted.sync_calls == []


@pytest.mark.parametrize("error", [
    CriptEnvAPIError(402, "Plan feature required: auto_sync"),
    ConnectionError("network down"),
])
def test_api_402_or_network_error_warns_and_exits_zero(hosted, error):
    hosted.sync_result = error

    result = run(hosted, "set", "A=1", "-p", PROJECT)

    assert result.exit_code == 0, result.output
    assert "✓ Set A" in result.output and "Could not send to Site" in result.output


def test_failing_to_list_connections_warns_and_exits_zero(hosted):
    hosted.integrations_envelope = AsyncMock(side_effect=ConnectionError("network down"))

    result = run(hosted, "set", "A=1", "-p", PROJECT)

    assert result.exit_code == 0, result.output
    assert "✓ Set A" in result.output and "Auto-sync skipped" in result.output


def test_rotate_also_sends(hosted):
    run(hosted, "set", "A=1", "-p", PROJECT)

    result = run(hosted, "rotate", "A", "--value", "rotated", "--force", "-p", PROJECT)

    assert result.exit_code == 0, result.output
    assert pushes(hosted)[-1]["secrets"] == [{"key": "A", "value": "rotated"}]


def test_import_sends_once_with_everything(hosted, tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text("A=1\nB=2\n")

    result = run(hosted, "import", str(env_file), "-p", PROJECT)

    assert result.exit_code == 0, result.output
    assert len(pushes(hosted)) == 1
    assert sorted(s["key"] for s in pushes(hosted)[0]["secrets"]) == ["A", "B"]


def test_import_that_skipped_everything_sends_nothing(hosted, tmp_path):
    run(hosted, "set", "A=1", "-p", PROJECT)
    sent_before = len(pushes(hosted))
    env_file = tmp_path / ".env"
    env_file.write_text("A=other\n")

    run(hosted, "import", str(env_file), "-p", PROJECT)

    assert len(pushes(hosted)) == sent_before


def test_pull_from_provider_does_not_send_back(hosted):
    hosted.sync_result = {"success": True, "secrets": [{"key": "FROM_VERCEL", "value": "1"}]}

    result = run(hosted, "integrations", "sync", "--provider", "vercel", "--direction", "pull", "--project", PROJECT)

    assert result.exit_code == 0, result.output
    assert [blob["key_id"] for blob in hosted.blobs] == ["FROM_VERCEL"]
    assert pushes(hosted) == []


@pytest.mark.asyncio
async def test_client_sends_delete_keys_only_when_there_are_any():
    from criptenv.api.client import CriptEnvClient

    client = CriptEnvClient.__new__(CriptEnvClient)
    response = MagicMock()
    response.json.return_value = {"success": True}
    client._request = AsyncMock(return_value=response)

    await client.sync_integration("p1", "i1", secrets=[], delete_keys=["A"])
    await client.sync_integration("p1", "i1", secrets=[{"key": "B", "value": "2"}], delete_keys=[])

    bodies = [call.kwargs["json"] for call in client._request.await_args_list]
    assert bodies[0] == {"direction": "push", "environment": "production", "secrets": [], "delete_keys": ["A"]}
    assert "delete_keys" not in bodies[1]


@pytest.mark.asyncio
async def test_client_envelope_keeps_features_and_list_still_returns_the_integrations():
    from criptenv.api.client import CriptEnvClient

    client = CriptEnvClient.__new__(CriptEnvClient)
    response = MagicMock()
    response.json.return_value = {"integrations": [{"id": "i1"}], "features": ["auto_sync"]}
    client._request = AsyncMock(return_value=response)

    assert await client.integrations_envelope("p1") == {"integrations": [{"id": "i1"}], "features": ["auto_sync"]}
    assert await client.list_integrations("p1") == [{"id": "i1"}]
