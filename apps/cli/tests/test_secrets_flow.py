"""Integration tests for remote secret commands."""

from unittest.mock import patch

import pytest
from click.testing import CliRunner

from criptenv.cli import main
from tests.conftest import remote_cli_context_for


@pytest.fixture
def runner():
    return CliRunner()


class TestRemoteSecretFlow:
    def test_full_flow_set_get_list_delete(self, runner, remote_vault_client):
        with patch("criptenv.commands.secrets.cli_context", remote_cli_context_for(remote_vault_client)):
            result = runner.invoke(main, ["set", "API_KEY=secret123", "-p", "prj_123"])
            assert result.exit_code == 0
            assert "Set API_KEY" in result.output

            result = runner.invoke(main, ["get", "API_KEY", "-p", "prj_123"])
            assert result.exit_code == 0
            assert "secret123" in result.output

            result = runner.invoke(main, ["list", "-p", "prj_123"])
            assert result.exit_code == 0
            assert "API_KEY" in result.output
            assert "1 secret(s)" in result.output

            result = runner.invoke(main, ["delete", "API_KEY", "-p", "prj_123", "--force"])
            assert result.exit_code == 0
            assert "Deleted API_KEY" in result.output

            result = runner.invoke(main, ["list", "-p", "prj_123"])
            assert result.exit_code == 0
            assert "No secrets found" in result.output

    def test_set_updates_existing(self, runner, remote_vault_client):
        with patch("criptenv.commands.secrets.cli_context", remote_cli_context_for(remote_vault_client)):
            assert runner.invoke(main, ["set", "KEY=v1", "-p", "prj_123"]).exit_code == 0
            result = runner.invoke(main, ["set", "KEY=v2", "-p", "prj_123"])
            assert result.exit_code == 0
            assert "(v2)" in result.output

            result = runner.invoke(main, ["get", "KEY", "-p", "prj_123"])
            assert result.exit_code == 0
            assert "v2" in result.output

    def test_get_nonexistent(self, runner, remote_vault_client):
        with patch("criptenv.commands.secrets.cli_context", remote_cli_context_for(remote_vault_client)):
            result = runner.invoke(main, ["get", "NONEXISTENT", "-p", "prj_123"])
            assert result.exit_code == 1
            assert "not found" in result.output

    def test_delete_nonexistent(self, runner, remote_vault_client):
        with patch("criptenv.commands.secrets.cli_context", remote_cli_context_for(remote_vault_client)):
            result = runner.invoke(main, ["delete", "NONEXISTENT", "-p", "prj_123", "--force"])
            assert result.exit_code == 1
            assert "not found" in result.output

    def test_multiple_secrets(self, runner, remote_vault_client):
        with patch("criptenv.commands.secrets.cli_context", remote_cli_context_for(remote_vault_client)):
            for key, value in [("KEY_A", "val_a"), ("KEY_B", "val_b"), ("KEY_C", "val_c")]:
                assert runner.invoke(main, ["set", f"{key}={value}", "-p", "prj_123"]).exit_code == 0

            result = runner.invoke(main, ["list", "-p", "prj_123"])
            assert result.exit_code == 0
            assert "KEY_A" in result.output
            assert "KEY_B" in result.output
            assert "KEY_C" in result.output
            assert "3 secret(s)" in result.output

    def test_unicode_secret(self, runner, remote_vault_client):
        with patch("criptenv.commands.secrets.cli_context", remote_cli_context_for(remote_vault_client)):
            result = runner.invoke(main, ["set", "UNICODE=🔐 secreto 测试", "-p", "prj_123"])
            assert result.exit_code == 0

            result = runner.invoke(main, ["get", "UNICODE", "-p", "prj_123"])
            assert result.exit_code == 0
            assert "🔐 secreto 测试" in result.output

    def test_empty_value(self, runner, remote_vault_client):
        with patch("criptenv.commands.secrets.cli_context", remote_cli_context_for(remote_vault_client)):
            assert runner.invoke(main, ["set", "EMPTY=", "-p", "prj_123"]).exit_code == 0
            result = runner.invoke(main, ["get", "EMPTY", "-p", "prj_123"])
            assert result.exit_code == 0

    def test_wrong_vault_password(self, runner, remote_vault_client, monkeypatch):
        with patch("criptenv.commands.secrets.cli_context", remote_cli_context_for(remote_vault_client)):
            assert runner.invoke(main, ["set", "KEY=value", "-p", "prj_123"]).exit_code == 0

            monkeypatch.setenv("CRIPTENV_VAULT_PASSWORD", "wrong-password")
            result = runner.invoke(main, ["get", "KEY", "-p", "prj_123"])
            assert result.exit_code == 1
            assert "Invalid vault password" in result.output
