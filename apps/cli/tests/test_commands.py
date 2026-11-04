"""Tests for CLI commands."""

import pytest
from click.testing import CliRunner

from criptenv import __version__
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
        assert __version__ in result.output

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
        """Init should create config dir and metadata database without a password."""
        result = runner.invoke(main, ["init"])
        assert result.exit_code == 0
        assert "configuration ready" in result.output
        assert (mock_config_dir / "vault.db").exists()

    def test_init_already_initialized(self, runner, mock_config_dir):
        """Init should be idempotent."""
        runner.invoke(main, ["init"])
        result = runner.invoke(main, ["init"])
        assert result.exit_code == 0
        assert "configuration ready" in result.output

    def test_init_force_reinitialize(self, runner, mock_config_dir):
        """Init --force should remain accepted for compatibility."""
        runner.invoke(main, ["init"])
        result = runner.invoke(main, ["init", "--force"])
        assert result.exit_code == 0
        assert "configuration ready" in result.output


class TestSetCommand:
    def test_set_requires_equals(self, runner):
        result = runner.invoke(main, ["set", "NO_EQUALS"])
        assert result.exit_code == 1
        assert "Must be KEY=value" in result.output

    def test_set_not_initialized(self, runner, mock_config_dir):
        """Set should require an authenticated remote session."""
        result = runner.invoke(main, ["set", "KEY=value"])
        assert result.exit_code == 1
        assert "login" in result.output.lower()


class TestDeleteCommand:
    def test_delete_confirms(self, runner):
        result = runner.invoke(main, ["delete", "KEY"], input="n\n")
        assert result.exit_code == 0
        assert "Cancelled" in result.output


class TestDoctorCommand:
    def test_doctor_uses_health_endpoint_for_api_check(self, runner, mock_config_dir, monkeypatch):
        """Doctor should use the stable API health endpoint, not /docs."""
        import httpx

        seen_urls = []

        def fake_get(url, timeout):
            seen_urls.append(url)
            return httpx.Response(200, json={"status": "healthy"})

        monkeypatch.setattr("httpx.get", fake_get)

        result = runner.invoke(main, ["doctor"])

        assert result.exit_code == 0
        assert seen_urls == ["https://criptenv-api.77mdevseven.tech/health"]
        assert "API server reachable" in result.output


class TestLoginApiKey:
    """Regression: `--api-key` was declared with flag_value, so Click treated it
    as a pure flag and `criptenv login --api-key cek_xxx` failed with
    'unexpected extra argument'."""

    @pytest.fixture
    def seen_keys(self, monkeypatch, mock_config_dir):
        from criptenv.commands import login as login_module

        seen = []

        async def fake_api_key_login(_auth_key, _db, api_key):
            seen.append(api_key)
            return {"email": "ci@example.com", "id": "usr_1"}

        monkeypatch.setattr(login_module, "_api_key_login", fake_api_key_login)
        return seen

    def test_api_key_value(self, runner, seen_keys):
        result = runner.invoke(main, ["login", "--api-key", "cek_live_abc"])
        assert result.exit_code == 0, result.output
        assert seen_keys == ["cek_live_abc"]

    def test_api_key_from_env(self, runner, seen_keys):
        result = runner.invoke(main, ["login"], env={"CRIPTENV_API_KEY": "cek_live_env"})
        assert result.exit_code == 0, result.output
        assert seen_keys == ["cek_live_env"]

    def test_api_key_without_value_prompts(self, runner, seen_keys):
        result = runner.invoke(main, ["login", "--api-key"], input="cek_live_prompt\n")
        assert result.exit_code == 0, result.output
        assert seen_keys == ["cek_live_prompt"]


class TestCleanErrors:
    def test_unhandled_api_error_prints_message_not_traceback(self, runner, mock_config_dir):
        from unittest.mock import patch

        from criptenv.api.client import CriptEnvAPIError

        error = CriptEnvAPIError(401, "The API key was rejected")
        with patch("criptenv.commands.run_diff.export_entries_remote", side_effect=error):
            result = runner.invoke(main, ["run", "--", "true"])

        assert result.exit_code == 1
        assert "Error: API error 401: The API key was rejected" in result.output
        assert "Traceback" not in result.output
        assert isinstance(result.exception, SystemExit)


class TestProjectsCreate:
    @pytest.fixture
    def created(self, monkeypatch):
        from tests.conftest import remote_cli_context_for

        captured = {}

        class Client:
            async def create_project(self, **kwargs):
                captured.update(kwargs)
                return {"id": "proj_1", "name": kwargs["name"]}

        monkeypatch.setattr(
            "criptenv.commands.projects.cli_context", remote_cli_context_for(Client())
        )
        return captured

    def test_uses_vault_password_env_without_prompting(self, runner, created, monkeypatch):
        from criptenv.crypto import verify_project_vault_password

        monkeypatch.setenv("CRIPTENV_VAULT_PASSWORD", "vault-password-123")
        result = runner.invoke(main, ["projects", "create", "demo"])

        assert result.exit_code == 0, result.output
        assert "Created project demo (proj_1)" in result.output
        assert verify_project_vault_password("vault-password-123", created["vault_config"])

    def test_rejects_short_env_password(self, runner, created, monkeypatch):
        monkeypatch.setenv("CRIPTENV_VAULT_PASSWORD", "short")
        result = runner.invoke(main, ["projects", "create", "demo"])

        assert result.exit_code == 1
        assert "at least 8 characters" in result.output
        assert created == {}

    def test_fails_fast_without_env_or_terminal(self, runner, created, monkeypatch):
        monkeypatch.delenv("CRIPTENV_VAULT_PASSWORD", raising=False)
        result = runner.invoke(main, ["projects", "create", "demo"])

        assert result.exit_code == 1
        assert "CRIPTENV_VAULT_PASSWORD is not set" in result.output
        assert created == {}
