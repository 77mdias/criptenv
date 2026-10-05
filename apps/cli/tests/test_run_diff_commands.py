"""Tests for `criptenv run` and `criptenv diff` (Sprint 3).

`run` injects decrypted secrets into a subprocess without touching disk;
`diff` reports drift between a local .env and the remote vault and exits
non-zero when they differ (usable as a CI gate).
"""

import sys
from unittest.mock import patch

import pytest
from click.testing import CliRunner

from criptenv.cli import main


@pytest.fixture
def runner():
    return CliRunner()


@pytest.fixture
def fake_client():
    from tests.conftest import RemoteVaultFakeClient

    client = RemoteVaultFakeClient()
    return client


class TestRunCommand:
    def test_injects_secrets_into_child_process(self, runner, mock_config_dir, tmp_path):
        out_file = tmp_path / "child-out.txt"
        child_code = (
            "import os, pathlib; "
            f"pathlib.Path(r'{out_file}').write_text(os.environ['RUN_TOKEN'])"
        )

        with patch("criptenv.commands.run_diff.export_entries_remote", return_value={"RUN_TOKEN": "s3cret-value"}):
            result = runner.invoke(
                main,
                ["run", "--", sys.executable, "-c", child_code],
                catch_exceptions=False,
            )

        assert result.exit_code == 0
        assert out_file.read_text() == "s3cret-value"

    def test_propagates_child_exit_code(self, runner, fake_client, mock_config_dir):
        with patch("criptenv.commands.run_diff.export_entries_remote", return_value={}):
            result = runner.invoke(
                main,
                ["run", "--", sys.executable, "-c", "raise SystemExit(7)"],
                catch_exceptions=False,
            )

        assert result.exit_code == 7

    def test_requires_a_command(self, runner, mock_config_dir):
        result = runner.invoke(main, ["run"])
        assert result.exit_code != 0
        assert "Missing command" in result.output

    def test_missing_binary_reports_clearly(self, runner, mock_config_dir):
        with patch("criptenv.commands.run_diff.export_entries_remote", return_value={}):
            result = runner.invoke(main, ["run", "--", "definitely-not-a-real-binary-xyz"])

        assert result.exit_code != 0
        assert "Command not found" in result.output


class TestDiffCommand:
    def test_no_differences_exits_zero(self, runner, tmp_path, monkeypatch):
        env_file = tmp_path / ".env"
        env_file.write_text("API_KEY=abc\n")

        with patch("criptenv.commands.run_diff.export_entries_remote", return_value={"API_KEY": "abc"}):
            result = runner.invoke(main, ["diff", str(env_file)])

        assert result.exit_code == 0
        assert "No differences" in result.output

    def test_reports_all_difference_kinds_and_exits_one(self, runner, tmp_path):
        env_file = tmp_path / ".env"
        env_file.write_text("ONLY_LOCAL=1\nCHANGED=new\n")

        remote = {"ONLY_REMOTE": "1", "CHANGED": "old"}
        with patch("criptenv.commands.run_diff.export_entries_remote", return_value=remote):
            result = runner.invoke(main, ["diff", str(env_file)])

        assert result.exit_code == 1
        assert "ONLY_LOCAL" in result.output
        assert "ONLY_REMOTE" in result.output
        assert "CHANGED" in result.output
        assert "3 difference(s) found" in result.output

    def test_never_prints_full_secret_values(self, runner, tmp_path):
        env_file = tmp_path / ".env"
        env_file.write_text("CHANGED=super-secret-local-value\n")

        remote = {"CHANGED": "super-secret-remote-value"}
        with patch("criptenv.commands.run_diff.export_entries_remote", return_value=remote):
            result = runner.invoke(main, ["diff", str(env_file), "--show-values"])

        assert result.exit_code == 1
        assert "super-secret-local-value" not in result.output
        assert "super-secret-remote-value" not in result.output

    def test_missing_file_fails_clearly(self, runner, mock_config_dir):
        result = runner.invoke(main, ["diff", "does-not-exist.env"])
        assert result.exit_code != 0
