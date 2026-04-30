"""Tests for CLI commands."""

import pytest
from click.testing import CliRunner

from criptenv.cli import main


@pytest.fixture
def runner():
    return CliRunner()


class TestCLIHelp:
    def test_main_help(self, runner):
        result = runner.invoke(main, ["--help"])
        assert result.exit_code == 0
        assert "Zero-Knowledge secret management" in result.output

    def test_version(self, runner):
        result = runner.invoke(main, ["--version"])
        assert result.exit_code == 0
        assert "0.1.0" in result.output

    def test_init_help(self, runner):
        result = runner.invoke(main, ["init", "--help"])
        assert result.exit_code == 0
        assert "Initialize CriptEnv" in result.output

    def test_login_help(self, runner):
        result = runner.invoke(main, ["login", "--help"])
        assert result.exit_code == 0
        assert "Login to CriptEnv" in result.output

    def test_set_help(self, runner):
        result = runner.invoke(main, ["set", "--help"])
        assert result.exit_code == 0
        assert "KEY=value" in result.output

    def test_get_help(self, runner):
        result = runner.invoke(main, ["get", "--help"])
        assert result.exit_code == 0

    def test_list_help(self, runner):
        result = runner.invoke(main, ["list", "--help"])
        assert result.exit_code == 0

    def test_delete_help(self, runner):
        result = runner.invoke(main, ["delete", "--help"])
        assert result.exit_code == 0

    def test_push_help(self, runner):
        result = runner.invoke(main, ["push", "--help"])
        assert result.exit_code == 0

    def test_pull_help(self, runner):
        result = runner.invoke(main, ["pull", "--help"])
        assert result.exit_code == 0

    def test_env_help(self, runner):
        result = runner.invoke(main, ["env", "--help"])
        assert result.exit_code == 0
        assert "Manage environments" in result.output

    def test_projects_help(self, runner):
        result = runner.invoke(main, ["projects", "--help"])
        assert result.exit_code == 0

    def test_doctor_help(self, runner):
        result = runner.invoke(main, ["doctor", "--help"])
        assert result.exit_code == 0

    def test_import_help(self, runner):
        result = runner.invoke(main, ["import", "--help"])
        assert result.exit_code == 0

    def test_export_help(self, runner):
        result = runner.invoke(main, ["export", "--help"])
        assert result.exit_code == 0


class TestInitCommand:
    def test_init_creates_dir_and_vault(self, runner, mock_config_dir):
        """Init should create config dir, vault, and store salt."""
        # Provide master password twice (set + confirm)
        result = runner.invoke(main, ["init"], input="testpass123\ntestpass123\n")
        assert result.exit_code == 0
        assert "initialized successfully" in result.output
        assert (mock_config_dir / "vault.db").exists()

    def test_init_password_mismatch(self, runner, mock_config_dir):
        """Init should fail if passwords don't match."""
        result = runner.invoke(main, ["init"], input="testpass123\ndifferent\n")
        assert result.exit_code == 1
        assert "do not match" in result.output

    def test_init_password_too_short(self, runner, mock_config_dir):
        """Init should fail if password is too short."""
        result = runner.invoke(main, ["init"], input="short\nshort\n")
        assert result.exit_code == 1
        assert "at least 8 characters" in result.output

    def test_init_already_initialized(self, runner, mock_config_dir):
        """Init should warn if already initialized."""
        # First init
        runner.invoke(main, ["init"], input="testpass123\ntestpass123\n")
        # Second init without --force
        result = runner.invoke(main, ["init"], input="testpass123\ntestpass123\n")
        assert "already initialized" in result.output

    def test_init_force_reinitialize(self, runner, mock_config_dir):
        """Init --force should reinitialize."""
        runner.invoke(main, ["init"], input="testpass123\ntestpass123\n")
        result = runner.invoke(main, ["init", "--force"], input="newpass123\nnewpass123\n")
        assert result.exit_code == 0
        assert "initialized successfully" in result.output


class TestSetCommand:
    def test_set_requires_equals(self, runner):
        result = runner.invoke(main, ["set", "NO_EQUALS"])
        assert result.exit_code == 1
        assert "Must be KEY=value" in result.output

    def test_set_not_initialized(self, runner, mock_config_dir):
        """Set should fail if not initialized."""
        result = runner.invoke(main, ["set", "KEY=value"])
        assert result.exit_code == 1
        assert "init" in result.output.lower()


class TestDeleteCommand:
    def test_delete_confirms(self, runner):
        result = runner.invoke(main, ["delete", "KEY"], input="n\n")
        assert result.exit_code == 0
        assert "Cancelled" in result.output
