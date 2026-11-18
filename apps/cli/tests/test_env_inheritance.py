"""Environment inheritance in the CLI: create with --parent/--ttl, set/unset on a child, resolved reads
(each inherited value decrypted with its own environment's key), show, diff, delete and ci deploy."""

from unittest.mock import patch

import click
import pytest
from click.testing import CliRunner

from criptenv.cli import main
from criptenv.commands.environments import parse_ttl
from criptenv.crypto import build_project_vault_config
from tests.conftest import remote_cli_context_for

PROJECT = "00000000-0000-4000-8000-000000000123"
SECRET_VALUE = "s3cr3t-parent-value"


class InheritanceFakeClient:
    """A server in memory: environments with parents, blobs per environment, resolution by key name."""

    def __init__(self):
        self.vault_config, _ = build_project_vault_config("vault-password-123")
        self.envs = {
            "env-dev": {"id": "env-dev", "name": "dev", "is_default": True, "parent_id": None},
            "env-wt": {"id": "env-wt", "name": "dev/wt-x", "parent_id": "env-dev",
                       "expires_at": "2026-11-25T10:00:00+00:00"},
        }
        self.blobs = {"env-dev": [], "env-wt": []}
        self.unset = {"env-dev": [], "env-wt": []}
        self.versions = {"env-dev": 0, "env-wt": 0}
        self.pushes: list[dict] = []
        self.created: list[dict] = []
        self.deleted: list[str] = []

    async def get_project(self, project_id):
        return {"id": project_id, "vault_config": self.vault_config}

    async def list_environments(self, project_id):
        return {"environments": list(self.envs.values())}

    async def pull_vault(self, project_id, env_id):
        return {"blobs": list(self.blobs[env_id]), "version": self.versions[env_id], "unset_keys": self.unset[env_id]}

    def _chain(self, env_id):
        chain = [self.envs[env_id]]
        while chain[-1].get("parent_id"):
            chain.append(self.envs[chain[-1]["parent_id"]])
        return chain

    async def resolved_vault(self, project_id, env_id):
        chain = self._chain(env_id)
        resolved = {}
        for level in reversed(chain):
            for key in self.unset[level["id"]]:
                resolved.pop(key, None)
            for blob in self.blobs[level["id"]]:
                resolved[blob["key_id"]] = {**blob, "source_environment_name": level["name"],
                                            "origin": "local" if level["id"] == env_id else "inherited"}
        return {"blobs": [resolved[k] for k in sorted(resolved)], "version": self.versions[env_id],
                "unset_keys": self.unset[env_id], "chain": [{"id": e["id"], "name": e["name"]} for e in chain]}

    async def push_vault(self, project_id, env_id, blobs, vault_proof=None, expected_version=None, **kwargs):
        self.pushes.append({"env_id": env_id, "keys": [b["key_id"] for b in blobs], **kwargs})
        if "unset_keys" in kwargs:
            if self.envs[env_id].get("parent_id") is None:
                raise AssertionError("unset_keys sent for a root environment")
            self.unset[env_id] = sorted(set(kwargs["unset_keys"]) - {b["key_id"] for b in blobs})
        self.versions[env_id] += 1
        self.blobs[env_id] = [{**b, "environment_id": env_id, "updated_at": "2026-11-18T10:00:00Z"} for b in blobs]
        return {"blobs": self.blobs[env_id], "version": self.versions[env_id], "unset_keys": self.unset[env_id]}

    async def create_environment(self, project_id, name, display_name=None, restricted=False, **kwargs):
        self.created.append({"name": name, **kwargs})
        return {"id": "env-new", "name": name, "restricted": restricted, "parent_id": kwargs.get("parent_id"),
                "expires_at": "2026-11-25T10:00:00+00:00" if kwargs.get("ttl_seconds") else None}

    async def delete_environment(self, project_id, env_id):
        self.deleted.append(env_id)

    async def environment_diff(self, project_id, env_id):
        return {"environment": "dev/wt-x", "parent": "dev", "keys": [
            {"key": "DATABASE_URL", "status": "inherited", "source": "dev", "parent_source": "dev"},
            {"key": "PORT", "status": "override", "source": "dev/wt-x", "parent_source": "dev"},
            {"key": "SENTRY_DSN", "status": "unset", "source": "dev", "parent_source": "dev"},
        ]}


@pytest.fixture
def runner():
    return CliRunner()


@pytest.fixture
def server(monkeypatch):
    monkeypatch.setenv("CRIPTENV_VAULT_PASSWORD", "vault-password-123")
    return InheritanceFakeClient()


def _cli(runner, server, *args):
    fake = remote_cli_context_for(server)
    with patch("criptenv.commands.secrets.cli_context", fake), \
            patch("criptenv.commands.environments.cli_context", fake), \
            patch("criptenv.commands.import_export.cli_context", fake):
        return runner.invoke(main, [*args, "-p", PROJECT])


def _seed(runner, server):
    for pair in (f"DATABASE_URL={SECRET_VALUE}", "PORT=3000", "SENTRY_DSN=https://sentry"):
        assert _cli(runner, server, "set", pair, "-e", "dev").exit_code == 0
    assert _cli(runner, server, "set", "PORT=3101", "-e", "dev/wt-x").exit_code == 0


def test_parse_ttl():
    assert parse_ttl("7d") == 7 * 86400 and parse_ttl("12h") == 43200 and parse_ttl("30m") == 1800
    assert parse_ttl("2w") == 14 * 86400
    for bad in ("7", "0d", "-1d", "7y", ""):
        with pytest.raises(click.BadParameter):
            parse_ttl(bad)


def test_env_create_with_parent_and_ttl(runner, server):
    result = _cli(runner, server, "env", "create", "dev/wt-y", "--parent", "dev", "--ttl", "7d")

    assert result.exit_code == 0, result.output
    assert server.created == [{"name": "dev/wt-y", "parent_id": "env-dev", "ttl_seconds": 7 * 86400}]
    assert "Inherits from: dev" in result.output and "Expires:" in result.output


def test_ttl_needs_a_parent(runner, server):
    result = _cli(runner, server, "env", "create", "scratch", "--ttl", "1d")
    assert result.exit_code != 0 and "--ttl needs --parent" in result.output
    assert server.created == []


def test_set_on_child_pushes_only_its_override(runner, server):
    _seed(runner, server)
    assert [b["key_id"] for b in server.blobs["env-wt"]] == ["PORT"]
    assert server.pushes[-1] == {"env_id": "env-wt", "keys": ["PORT"], "unset_keys": []}
    assert all("unset_keys" not in p for p in server.pushes if p["env_id"] == "env-dev")


def test_get_and_export_on_child_decrypt_inherited_values_with_the_parent_key(runner, server):
    _seed(runner, server)

    inherited = _cli(runner, server, "get", "DATABASE_URL", "-e", "dev/wt-x")
    own = _cli(runner, server, "get", "PORT", "-e", "dev/wt-x")
    exported = _cli(runner, server, "export", "-e", "dev/wt-x")

    assert (inherited.exit_code, inherited.output.strip()) == (0, SECRET_VALUE)
    assert own.output.strip() == "3101"
    assert f"DATABASE_URL={SECRET_VALUE}" in exported.output and "PORT=3101" in exported.output


def test_unset_on_child_hides_the_key_and_set_brings_it_back(runner, server):
    _seed(runner, server)

    result = _cli(runner, server, "unset", "SENTRY_DSN", "--env", "dev/wt-x")

    assert result.exit_code == 0, result.output
    assert "its parent keeps it" in result.output
    assert server.unset["env-wt"] == ["SENTRY_DSN"]
    assert "SENTRY_DSN" not in _cli(runner, server, "export", "-e", "dev/wt-x").output
    assert "SENTRY_DSN" in [b["key_id"] for b in server.blobs["env-dev"]]  # the parent is untouched

    assert _cli(runner, server, "set", "SENTRY_DSN=local", "-e", "dev/wt-x").exit_code == 0
    assert server.unset["env-wt"] == []


def test_unset_on_a_root_environment_is_refused(runner, server):
    _seed(runner, server)
    result = _cli(runner, server, "unset", "PORT", "--env", "dev")
    assert result.exit_code == 1 and "has no parent" in result.output


def test_list_on_child_shows_the_origin(runner, server):
    _seed(runner, server)
    output = _cli(runner, server, "list", "-e", "dev/wt-x").output
    lines = {line.split()[0]: line for line in output.splitlines() if line.startswith("  ")}
    assert "inherited from dev" in lines["DATABASE_URL"] and lines["PORT"].endswith("local")


def test_env_show_resolved_masks_values_by_default(runner, server):
    _seed(runner, server)

    masked = _cli(runner, server, "env", "show", "dev/wt-x", "--resolved")
    shown = _cli(runner, server, "env", "show", "dev/wt-x", "--resolved", "--show-values")

    assert masked.exit_code == 0, masked.output
    assert "Inherits: dev" in masked.output
    assert "inherited from dev" in masked.output and SECRET_VALUE not in masked.output
    assert SECRET_VALUE in shown.output


def test_env_diff_prints_names_and_origins(runner, server):
    output = _cli(runner, server, "env", "diff", "dev/wt-x").output
    assert "~ PORT" in output and "- SENTRY_DSN" in output and "= DATABASE_URL" in output
    assert "2 change(s)" in output
    assert "has no parent" in _cli(runner, server, "env", "diff", "dev").output


def test_env_delete_child_by_name(runner, server):
    result = _cli(runner, server, "env", "delete", "dev/wt-x", "--force")
    assert result.exit_code == 0 and "parent untouched" in result.output
    assert server.deleted == ["env-wt"]


def test_run_on_child_injects_inherited_values(runner, server, monkeypatch):
    _seed(runner, server)
    captured = {}

    def fake_run(command, env, check):
        captured.update(env)
        return type("Done", (), {"returncode": 0})()

    monkeypatch.setattr("criptenv.commands.run_diff._USE_EXEC", False)
    monkeypatch.setattr("criptenv.commands.run_diff.subprocess.run", fake_run)
    with patch("criptenv.commands.import_export.cli_context", remote_cli_context_for(server)):
        result = runner.invoke(main, ["run", "-e", "dev/wt-x", "-p", PROJECT, "--", "true"])

    assert result.exit_code == 0, result.output
    assert captured["DATABASE_URL"] == SECRET_VALUE and captured["PORT"] == "3101"
    assert SECRET_VALUE not in result.output
