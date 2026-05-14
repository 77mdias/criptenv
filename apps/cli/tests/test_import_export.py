"""Tests for remote import/export and doctor commands."""

from unittest.mock import patch

import pytest
from click.testing import CliRunner

from criptenv.cli import main
from tests.conftest import remote_cli_context_for


@pytest.fixture
def runner():
    return CliRunner()


class TestImportExport:
    def test_import_env_file(self, runner, remote_vault_client, tmp_path):
        env_file = tmp_path / "test.env"
        env_file.write_text(
            "# Comment line\n"
            "API_KEY=secret123\n"
            "DB_HOST=localhost\n"
            "DB_PORT=5432\n"
            "\n"
            "QUOTED_VALUE=\"hello world\"\n"
        )

        with (
            patch("criptenv.commands.import_export.cli_context", remote_cli_context_for(remote_vault_client)),
            patch("criptenv.commands.secrets.cli_context", remote_cli_context_for(remote_vault_client)),
        ):
            result = runner.invoke(main, ["import", str(env_file), "-p", "prj_123"])
            assert result.exit_code == 0
            assert "Imported 4 secret(s)" in result.output

            result = runner.invoke(main, ["list", "-p", "prj_123"])
            assert result.exit_code == 0
            assert "API_KEY" in result.output
            assert "DB_HOST" in result.output
            assert "DB_PORT" in result.output
            assert "QUOTED_VALUE" in result.output

    def test_import_skip_existing(self, runner, remote_vault_client, tmp_path):
        env_file = tmp_path / "test.env"
        env_file.write_text("API_KEY=overwritten\nDB_HOST=localhost\n")

        with (
            patch("criptenv.commands.import_export.cli_context", remote_cli_context_for(remote_vault_client)),
            patch("criptenv.commands.secrets.cli_context", remote_cli_context_for(remote_vault_client)),
        ):
            runner.invoke(main, ["set", "API_KEY=original", "-p", "prj_123"])
            result = runner.invoke(main, ["import", str(env_file), "-p", "prj_123"])
            assert result.exit_code == 0
            assert "Skipped 1" in result.output
            assert "Imported 1" in result.output

            result = runner.invoke(main, ["get", "API_KEY", "-p", "prj_123"])
            assert "original" in result.output

    def test_import_overwrite(self, runner, remote_vault_client, tmp_path):
        env_file = tmp_path / "test.env"
        env_file.write_text("API_KEY=new_value\n")

        with (
            patch("criptenv.commands.import_export.cli_context", remote_cli_context_for(remote_vault_client)),
            patch("criptenv.commands.secrets.cli_context", remote_cli_context_for(remote_vault_client)),
        ):
            runner.invoke(main, ["set", "API_KEY=original", "-p", "prj_123"])
            result = runner.invoke(main, ["import", str(env_file), "--overwrite", "-p", "prj_123"])
            assert result.exit_code == 0
            assert "Imported 1" in result.output

            result = runner.invoke(main, ["get", "API_KEY", "-p", "prj_123"])
            assert "new_value" in result.output

    def test_export_env_format(self, runner, remote_vault_client, tmp_path):
        output_file = tmp_path / "exported.env"

        with (
            patch("criptenv.commands.import_export.cli_context", remote_cli_context_for(remote_vault_client)),
            patch("criptenv.commands.secrets.cli_context", remote_cli_context_for(remote_vault_client)),
        ):
            runner.invoke(main, ["set", "KEY_A=val_a", "-p", "prj_123"])
            runner.invoke(main, ["set", "KEY_B=val_b", "-p", "prj_123"])
            result = runner.invoke(main, ["export", "-o", str(output_file), "-p", "prj_123"])
            assert result.exit_code == 0
            assert "Exported 2 secret(s)" in result.output

        content = output_file.read_text()
        assert "KEY_A=val_a" in content
        assert "KEY_B=val_b" in content

    def test_export_json_format(self, runner, remote_vault_client, tmp_path):
        output_file = tmp_path / "exported.json"

        with (
            patch("criptenv.commands.import_export.cli_context", remote_cli_context_for(remote_vault_client)),
            patch("criptenv.commands.secrets.cli_context", remote_cli_context_for(remote_vault_client)),
        ):
            runner.invoke(main, ["set", "KEY_A=val_a", "-p", "prj_123"])
            result = runner.invoke(main, ["export", "--format", "json", "-o", str(output_file), "-p", "prj_123"])
            assert result.exit_code == 0

        import json

        data = json.loads(output_file.read_text())
        assert data["KEY_A"] == "val_a"

    def test_export_empty(self, runner, remote_vault_client):
        with patch("criptenv.commands.import_export.cli_context", remote_cli_context_for(remote_vault_client)):
            result = runner.invoke(main, ["export", "-p", "prj_123"])

        assert result.exit_code == 0
        assert "No secrets" in result.output

    def test_import_empty_file(self, runner, mock_config_dir, tmp_path):
        env_file = tmp_path / "empty.env"
        env_file.write_text("# Only comments\n\n")

        result = runner.invoke(main, ["import", str(env_file), "-p", "prj_123"])
        assert result.exit_code == 0
        assert "No entries" in result.output


class TestDoctor:
    def test_doctor_not_initialized(self, runner, mock_config_dir):
        result = runner.invoke(main, ["doctor"])
        assert result.exit_code == 0
        assert "CriptEnv Doctor" in result.output
        assert "missing" in result.output.lower() or "not configured" in result.output.lower()

    def test_doctor_initialized(self, runner, mock_config_dir):
        runner.invoke(main, ["init"])

        result = runner.invoke(main, ["doctor"])
        assert result.exit_code == 0
        assert "Configuration directory exists" in result.output
        assert "metadata database exists" in result.output

    def test_doctor_verbose(self, runner, mock_config_dir):
        runner.invoke(main, ["init"])

        result = runner.invoke(main, ["doctor", "--verbose"])
        assert result.exit_code == 0
        assert "Path:" in result.output
