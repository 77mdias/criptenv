"""Tests for remote push/pull aliases."""

from unittest.mock import patch

import pytest
from click.testing import CliRunner

from criptenv.cli import main
from tests.conftest import remote_cli_context_for


@pytest.fixture
def runner():
    return CliRunner()


def test_push_requires_file(runner):
    result = runner.invoke(main, ["push", "-p", "prj_123"])

    assert result.exit_code == 1
    assert "push <file>" in result.output


def test_pull_requires_output(runner):
    result = runner.invoke(main, ["pull", "-p", "prj_123"])

    assert result.exit_code == 1
    assert "pull --output <file>" in result.output


def test_push_imports_file_to_remote_vault(runner, remote_vault_client, tmp_path):
    env_file = tmp_path / ".env.production"
    env_file.write_text("API_KEY=secret123\n")

    with (
        patch("criptenv.commands.import_export.cli_context", remote_cli_context_for(remote_vault_client)),
        patch("criptenv.commands.sync.import_entries_remote") as import_entries,
    ):
        import_entries.return_value = (1, 0)
        result = runner.invoke(main, ["push", str(env_file), "-p", "prj_123"])

    assert result.exit_code == 0
    assert "Pushed 1 secret(s)" in result.output
    import_entries.assert_called_once()


def test_pull_exports_remote_vault_to_file(runner, remote_vault_client, tmp_path):
    output = tmp_path / ".env.production"

    with patch("criptenv.commands.sync.export_entries_remote", return_value={"API_KEY": "secret123"}):
        result = runner.invoke(main, ["pull", "-p", "prj_123", "-o", str(output)])

    assert result.exit_code == 0
    assert output.read_text() == "API_KEY=secret123\n"
