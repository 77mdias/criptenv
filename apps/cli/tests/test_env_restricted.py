"""`criptenv env`: restricted environments (only the project's owner and admins reach them)."""
from contextlib import contextmanager
from unittest.mock import AsyncMock, MagicMock

import pytest
from click.testing import CliRunner

from criptenv.api.client import CriptEnvClient
from criptenv.cli import main
from criptenv.commands import environments


@pytest.fixture
def client(monkeypatch):
    fake = MagicMock()
    fake.create_environment = AsyncMock(return_value={"id": "env-1", "name": "db-admin", "restricted": True})
    fake.update_environment = AsyncMock(return_value={"id": "env-1", "name": "db-admin"})
    fake.list_environments = AsyncMock(return_value={"environments": [
        {"id": "env-0", "name": "production", "is_default": True, "restricted": False},
        {"id": "env-1", "name": "db-admin", "is_default": False, "restricted": True},
    ]})

    @contextmanager
    def context(**_kwargs):
        yield None, None, fake

    monkeypatch.setattr(environments, "cli_context", context)
    monkeypatch.setattr(environments, "resolve_project_id", lambda db, project_id, client: "project-1")
    return fake


def run(*args):
    return CliRunner().invoke(main, ["env", *args])


def test_env_create_restricted_sends_the_flag(client):
    result = run("create", "db-admin", "--restricted")

    assert result.exit_code == 0, result.output
    client.create_environment.assert_awaited_once_with("project-1", "db-admin", None, restricted=True)
    assert "restricted" in result.output.lower()


def test_env_create_is_open_by_default(client):
    run("create", "homolog")

    client.create_environment.assert_awaited_once_with("project-1", "homolog", None, restricted=False)


@pytest.mark.parametrize("flag,value", [("--restricted", True), ("--open", False)])
def test_env_update_restricted_and_open(client, flag, value):
    result = run("update", "env-1", flag)

    assert result.exit_code == 0, result.output
    client.update_environment.assert_awaited_once_with(
        "project-1", "env-1", name=None, display_name=None, restricted=value,
    )


def test_env_update_refuses_both_flags(client):
    result = run("update", "env-1", "--restricted", "--open")

    assert result.exit_code != 0
    client.update_environment.assert_not_awaited()


def test_env_list_marks_restricted_environments(client):
    result = run("list")

    lines = {line.split()[0]: line for line in result.output.splitlines() if line.startswith(("production", "db-admin"))}
    assert "restricted" in lines["db-admin"]
    assert "restricted" not in lines["production"]


@pytest.mark.asyncio
async def test_client_sends_restricted_only_when_asked():
    api = CriptEnvClient.__new__(CriptEnvClient)
    api._request = AsyncMock(return_value=MagicMock(json=lambda: {}))

    await api.create_environment("p", "open-one")
    await api.create_environment("p", "db-admin", restricted=True)
    await api.update_environment("p", "env-1", restricted=False)

    assert [call.kwargs["json"] for call in api._request.await_args_list] == [
        {"name": "open-one"},
        {"name": "db-admin", "restricted": True},
        {"restricted": False},
    ]
