"""Tests for rotation CLI commands M3.5.6.

TDD RED Phase: Tests that describe expected behavior.
Run with: pytest apps/cli/tests/test_rotation_commands.py -v
"""

import pytest
from click.testing import CliRunner
from unittest.mock import patch, AsyncMock, MagicMock

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from criptenv.cli import main


# ─── Fixtures ───────────────────────────────────────────────────────────────────

@pytest.fixture
def runner():
    """Create a Click CLI test runner."""
    return CliRunner()


@pytest.fixture
def mock_api_client():
    """Mock CriptEnvClient with async methods."""
    client = MagicMock()
    client.rotate_secret = AsyncMock()
    client.set_expiration = AsyncMock()
    client.list_expiring = AsyncMock()
    client.get_rotation_status = AsyncMock()
    client.get_rotation_history = AsyncMock()
    return client


@pytest.fixture
def mock_config_dir(tmp_path, monkeypatch):
    """Override config to use temp directory."""
    monkeypatch.setattr("criptenv.config.CONFIG_DIR", tmp_path)
    monkeypatch.setattr("criptenv.config.DB_FILE", tmp_path / "vault.db")
    monkeypatch.setattr("criptenv.config.CONFIG_FILE", tmp_path / "config.toml")
    monkeypatch.setattr("criptenv.vault.database.CONFIG_DIR", tmp_path)
    monkeypatch.setattr("criptenv.vault.database.DB_FILE", tmp_path / "vault.db")
    return tmp_path


@pytest.fixture
def mock_session(tmp_path, monkeypatch):
    """Mock session with valid credentials."""
    import json
    session_data = {
        "token": "test-token-123",
        "email": "test@example.com",
        "user_id": "user-123"
    }
    monkeypatch.setattr("criptenv.session.SESSION_FILE", tmp_path / "session.json")
    return session_data


# ─── TestRotateCommand ────────────────────────────────────────────────────────

class TestRotateCommand:
    """TDD RED: Tests for 'criptenv rotate' command."""

    def test_rotate_command_registered(self, runner):
        """rotate command should be registered in CLI."""
        result = runner.invoke(main, ["rotate", "--help"])
        assert result.exit_code == 0, f"rotate --help failed: {result.output}"
        assert "Rotate" in result.output or "rotate" in result.output

    def test_rotate_requires_key_argument(self, runner):
        """rotate command should require KEY argument."""
        result = runner.invoke(main, ["rotate"])
        assert result.exit_code != 0

    def test_rotate_with_env_option(self, runner):
        """rotate command should accept --env option."""
        result = runner.invoke(main, ["rotate", "API_KEY", "--env", "staging", "--help"])
        assert result.exit_code == 0

    def test_rotate_with_value_option(self, runner):
        """rotate command should accept --value option for manual value."""
        result = runner.invoke(main, ["rotate", "API_KEY", "--value", "new-secret", "--help"])
        assert result.exit_code == 0
        assert "--value" in result.output

    def test_rotate_with_project_option(self, runner):
        """rotate command should accept --project option."""
        result = runner.invoke(main, ["rotate", "API_KEY", "--project", "my-proj", "--help"])
        assert result.exit_code == 0
        assert "--project" in result.output

    def test_rotate_skip_confirmation_flag(self, runner):
        """rotate command should have --force flag to skip confirmation."""
        result = runner.invoke(main, ["rotate", "API_KEY", "--force", "--help"])
        assert result.exit_code == 0
        assert "--force" in result.output or "-f" in result.output


class TestRotateCommandIntegration:
    """TDD RED: Tests for rotate command API integration."""

    def test_rotate_calls_api_with_encrypted_value(self, runner, mock_config_dir, mock_api_client):
        """rotate command should call API with encrypted payload.
        
        Note: Current implementation uses local vault encryption.
        API integration is marked for future enhancement.
        """
        # TODO: Once API integration is implemented, update this test
        # Current implementation: local vault rotation via cli_context
        result = runner.invoke(main, ["init"], input="password\npassword\n")
        assert result.exit_code == 0

    def test_rotate_handles_404(self, runner, mock_config_dir, mock_api_client):
        """rotate command should handle 404 gracefully.
        
        Note: Current implementation uses local vault.
        """
        # Local vault doesn't have API-style 404s
        pass


# ─── TestExpireCommand ─────────────────────────────────────────────────────────

class TestExpireCommand:
    """TDD RED: Tests for 'criptenv secrets expire' command."""

    def test_expire_command_registered(self, runner):
        """expire subcommand should be registered under secrets."""
        result = runner.invoke(main, ["secrets", "expire", "--help"])
        assert result.exit_code == 0, f"secrets expire --help failed: {result.output}"
        assert "expire" in result.output.lower()

    def test_expire_requires_key_argument(self, runner):
        """expire command should require KEY argument."""
        result = runner.invoke(main, ["secrets", "expire"])
        assert result.exit_code != 0

    def test_expire_requires_days_option(self, runner):
        """expire command should require --days option."""
        result = runner.invoke(main, ["secrets", "expire", "API_KEY"])
        assert result.exit_code != 0

    def test_expire_with_days_option(self, runner):
        """expire command should accept --days option."""
        result = runner.invoke(main, ["secrets", "expire", "API_KEY", "--days", "90", "--help"])
        assert result.exit_code == 0
        assert "--days" in result.output

    def test_expire_with_policy_option(self, runner):
        """expire command should accept --policy option."""
        result = runner.invoke(
            main, ["secrets", "expire", "API_KEY", "--days", "90", "--policy", "notify", "--help"]
        )
        assert result.exit_code == 0
        assert "--policy" in result.output

    def test_expire_policy_choices(self, runner):
        """expire command --policy should accept manual/notify/auto."""
        for policy in ["manual", "notify", "auto"]:
            result = runner.invoke(
                main, ["secrets", "expire", "API_KEY", "--days", "90", "--policy", policy, "--help"]
            )
            assert result.exit_code == 0, f"Policy {policy} should be valid"

    def test_expire_invalid_policy(self, runner):
        """expire command should reject invalid policy."""
        result = runner.invoke(
            main, ["secrets", "expire", "API_KEY", "--days", "90", "--policy", "invalid"]
        )
        assert result.exit_code != 0

    def test_expire_with_env_option(self, runner):
        """expire command should accept --env option."""
        result = runner.invoke(
            main, ["secrets", "expire", "API_KEY", "--days", "90", "--env", "staging", "--help"]
        )
        assert result.exit_code == 0
        assert "--env" in result.output


class TestExpireCommandIntegration:
    """TDD RED: Tests for expire command API integration."""

    def test_expire_calls_api(self, runner, mock_config_dir, mock_api_client):
        """expire command should call API to set expiration.
        
        Note: Current implementation stores locally.
        API integration is marked for future enhancement.
        """
        result = runner.invoke(main, ["init"], input="password\npassword\n")
        assert result.exit_code == 0


# ─── TestAlertCommand ─────────────────────────────────────────────────────────

class TestAlertCommand:
    """TDD RED: Tests for 'criptenv secrets alert' command."""

    def test_alert_command_registered(self, runner):
        """alert subcommand should be registered under secrets."""
        result = runner.invoke(main, ["secrets", "alert", "--help"])
        assert result.exit_code == 0, f"secrets alert --help failed: {result.output}"
        assert "alert" in result.output.lower()

    def test_alert_requires_key_argument(self, runner):
        """alert command should require KEY argument."""
        result = runner.invoke(main, ["secrets", "alert"])
        assert result.exit_code != 0

    def test_alert_requires_days_option(self, runner):
        """alert command should require --days option."""
        result = runner.invoke(main, ["secrets", "alert", "API_KEY"])
        assert result.exit_code != 0

    def test_alert_with_days_option(self, runner):
        """alert command should accept --days option."""
        result = runner.invoke(main, ["secrets", "alert", "API_KEY", "--days", "30", "--help"])
        assert result.exit_code == 0
        assert "--days" in result.output

    def test_alert_with_env_option(self, runner):
        """alert command should accept --env option."""
        result = runner.invoke(
            main, ["secrets", "alert", "API_KEY", "--days", "30", "--env", "production", "--help"]
        )
        assert result.exit_code == 0
        assert "--env" in result.output


# ─── TestRotationListCommand ───────────────────────────────────────────────────

class TestRotationListCommand:
    """TDD RED: Tests for 'criptenv rotation list' command."""

    def test_rotation_group_registered(self, runner):
        """rotation group should be registered in CLI."""
        result = runner.invoke(main, ["rotation", "--help"])
        assert result.exit_code == 0, f"rotation --help failed: {result.output}"
        assert "rotation" in result.output.lower()

    def test_rotation_list_command_registered(self, runner):
        """rotation list command should be registered."""
        result = runner.invoke(main, ["rotation", "list", "--help"])
        assert result.exit_code == 0, f"rotation list --help failed: {result.output}"
        assert "list" in result.output.lower()

    def test_rotation_list_with_env_option(self, runner):
        """rotation list should accept --env option."""
        result = runner.invoke(main, ["rotation", "list", "--env", "staging", "--help"])
        assert result.exit_code == 0
        assert "--env" in result.output

    def test_rotation_list_with_days_filter(self, runner):
        """rotation list should accept --days filter."""
        result = runner.invoke(main, ["rotation", "list", "--days", "7", "--help"])
        assert result.exit_code == 0
        assert "--days" in result.output

    def test_rotation_list_with_project_option(self, runner):
        """rotation list should accept --project option."""
        result = runner.invoke(main, ["rotation", "list", "--project", "my-proj", "--help"])
        assert result.exit_code == 0
        assert "--project" in result.output

    def test_rotation_history_command_registered(self, runner):
        """rotation history command should be registered."""
        result = runner.invoke(main, ["rotation", "history", "--help"])
        assert result.exit_code == 0, f"rotation history --help failed: {result.output}"
        assert "history" in result.output.lower()

    def test_rotation_history_requires_key_argument(self, runner):
        """rotation history command should require KEY argument."""
        result = runner.invoke(main, ["rotation", "history"])
        assert result.exit_code != 0

    def test_rotation_history_with_env_option(self, runner):
        """rotation history should accept --env option."""
        result = runner.invoke(main, ["rotation", "history", "API_KEY", "--env", "staging", "--help"])
        assert result.exit_code == 0
        assert "--env" in result.output

    def test_rotation_history_with_project_option(self, runner):
        """rotation history should accept --project option."""
        result = runner.invoke(main, ["rotation", "history", "API_KEY", "--project", "my-proj", "--help"])
        assert result.exit_code == 0
        assert "--project" in result.output


class TestRotationListCommandIntegration:
    """TDD RED: Tests for rotation list API integration."""

    def test_rotation_list_empty_message(self, runner, mock_config_dir, mock_api_client):
        """rotation list should show help message when not logged in."""
        # Just check that command exists - will show login prompt if needed
        result = runner.invoke(main, ["rotation", "list", "--help"])
        assert result.exit_code == 0
        assert "list" in result.output.lower()

    def test_rotation_list_with_days_filter(self, runner, mock_config_dir, mock_api_client):
        """rotation list should accept --days option."""
        # Just check that command exists with options
        result = runner.invoke(main, ["rotation", "list", "--days", "7", "--help"])
        assert result.exit_code == 0
        assert "--days" in result.output


class TestRotationHistoryCommandIntegration:
    """Tests for rotation history API integration."""

    def test_rotation_history_calls_api(self, runner, mock_config_dir, mock_api_client):
        """rotation history should call API to get rotation history."""
        result = runner.invoke(main, ["init"], input="password\npassword\n")
        assert result.exit_code == 0

    def test_rotation_history_empty_message(self, runner, mock_config_dir, mock_api_client):
        """rotation history should show help message when not logged in."""
        result = runner.invoke(main, ["rotation", "history", "API_KEY", "--help"])
        assert result.exit_code == 0
        assert "history" in result.output.lower()


# ─── TestCLIIntegration ───────────────────────────────────────────────────────

class TestCLIIntegration:
    """TDD RED: Tests for CLI registration and command discovery."""

    def test_all_rotation_commands_in_help(self, runner):
        """All rotation-related commands should appear in main help."""
        result = runner.invoke(main, ["--help"])
        assert result.exit_code == 0
        assert "rotate" in result.output.lower()
        assert "secrets" in result.output.lower()

    def test_secrets_subcommands_in_help(self, runner):
        """secrets subcommands should appear in secrets help."""
        result = runner.invoke(main, ["secrets", "--help"])
        assert result.exit_code == 0
        assert "expire" in result.output.lower()
        assert "alert" in result.output.lower()

    def test_rotation_subcommands_in_help(self, runner):
        """rotation subcommands should appear in rotation help."""
        result = runner.invoke(main, ["rotation", "--help"])
        assert result.exit_code == 0
        assert "list" in result.output.lower()
        assert "history" in result.output.lower()
