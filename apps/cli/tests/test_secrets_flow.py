"""Integration tests for init → set → get → list → delete flow."""

import pytest
from click.testing import CliRunner

from criptenv.cli import main


@pytest.fixture
def runner():
    return CliRunner()


MASTER_PASSWORD = "testpass123"


class TestLocalSecretFlow:
    """Test the complete local secret management flow."""

    def _init(self, runner, mock_config_dir):
        """Helper: initialize CriptEnv."""
        result = runner.invoke(
            main, ["init"],
            input=f"{MASTER_PASSWORD}\n{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0
        assert "initialized successfully" in result.output
        return result

    def test_full_flow_set_get_list_delete(self, runner, mock_config_dir):
        """Test: init → set → get → list → delete."""
        # Init
        self._init(runner, mock_config_dir)

        # Set a secret
        result = runner.invoke(
            main, ["set", "API_KEY=secret123"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0
        assert "Set API_KEY" in result.output

        # Get the secret
        result = runner.invoke(
            main, ["get", "API_KEY"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0
        assert "secret123" in result.output

        # List secrets
        result = runner.invoke(
            main, ["list"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0
        assert "API_KEY" in result.output
        assert "1 secret(s)" in result.output

        # Delete the secret
        result = runner.invoke(
            main, ["delete", "API_KEY", "--force"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0
        assert "Deleted API_KEY" in result.output

        # Verify it's gone
        result = runner.invoke(
            main, ["list"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0
        assert "No secrets found" in result.output

    def test_set_updates_existing(self, runner, mock_config_dir):
        """Setting the same key should update (increment version)."""
        self._init(runner, mock_config_dir)

        # Set v1
        result = runner.invoke(
            main, ["set", "KEY=v1"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0
        assert "Set KEY" in result.output

        # Set v2
        result = runner.invoke(
            main, ["set", "KEY=v2"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0
        assert "v2" in result.output

        # Get should return v2
        result = runner.invoke(
            main, ["get", "KEY"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0
        assert "v2" in result.output

    def test_get_nonexistent(self, runner, mock_config_dir):
        """Getting a nonexistent secret should fail."""
        self._init(runner, mock_config_dir)

        result = runner.invoke(
            main, ["get", "NONEXISTENT"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 1
        assert "not found" in result.output

    def test_delete_nonexistent(self, runner, mock_config_dir):
        """Deleting a nonexistent secret should fail."""
        self._init(runner, mock_config_dir)

        result = runner.invoke(
            main, ["delete", "NONEXISTENT", "--force"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 1
        assert "not found" in result.output

    def test_multiple_secrets(self, runner, mock_config_dir):
        """Should handle multiple secrets correctly."""
        self._init(runner, mock_config_dir)

        # Set multiple secrets
        for key, value in [("KEY_A", "val_a"), ("KEY_B", "val_b"), ("KEY_C", "val_c")]:
            result = runner.invoke(
                main, ["set", f"{key}={value}"],
                input=f"{MASTER_PASSWORD}\n"
            )
            assert result.exit_code == 0

        # List should show all
        result = runner.invoke(
            main, ["list"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0
        assert "KEY_A" in result.output
        assert "KEY_B" in result.output
        assert "KEY_C" in result.output
        assert "3 secret(s)" in result.output

        # Get each one
        for key, value in [("KEY_A", "val_a"), ("KEY_B", "val_b"), ("KEY_C", "val_c")]:
            result = runner.invoke(
                main, ["get", key],
                input=f"{MASTER_PASSWORD}\n"
            )
            assert result.exit_code == 0
            assert value in result.output

    def test_unicode_secret(self, runner, mock_config_dir):
        """Should handle unicode values."""
        self._init(runner, mock_config_dir)

        result = runner.invoke(
            main, ["set", "UNICODE=🔐 secreto 测试"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0

        result = runner.invoke(
            main, ["get", "UNICODE"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0
        assert "🔐 secreto 测试" in result.output

    def test_empty_value(self, runner, mock_config_dir):
        """Should handle empty values."""
        self._init(runner, mock_config_dir)

        result = runner.invoke(
            main, ["set", "EMPTY="],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0

        result = runner.invoke(
            main, ["get", "EMPTY"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0

    def test_wrong_password(self, runner, mock_config_dir):
        """Getting with wrong password should fail decryption."""
        self._init(runner, mock_config_dir)

        # Set with correct password
        result = runner.invoke(
            main, ["set", "KEY=value"],
            input=f"{MASTER_PASSWORD}\n"
        )
        assert result.exit_code == 0

        # Try to get with wrong password
        result = runner.invoke(
            main, ["get", "KEY"],
            input="wrongpassword\n"
        )
        assert result.exit_code == 1
