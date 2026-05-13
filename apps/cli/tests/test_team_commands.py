"""Tests for team management, audit, and API key commands (Fases C/D/E)."""

import pytest
from click.testing import CliRunner
from unittest.mock import AsyncMock, patch, MagicMock

from criptenv.cli import main


def _make_mock_db():
    """Create a mock DB that supports config queries."""
    db = MagicMock()
    db.execute = AsyncMock(return_value=MagicMock())
    return db


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def runner():
    return CliRunner()


# ─── Members ─────────────────────────────────────────────────────────────────

class TestMembersCommands:
    @patch("criptenv.commands.members.cli_context")
    def test_members_list(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.list_members = AsyncMock(return_value={
            "members": [
                {"id": "mem_1", "user_id": "usr_1", "role": "admin", "name": "Alice", "email": "alice@example.com"},
                {"id": "mem_2", "user_id": "usr_2", "role": "developer", "name": "Bob", "email": "bob@example.com"},
            ],
            "total": 2,
        })
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["members", "list", "--project", "prj_123"])
        assert result.exit_code == 0
        assert "Alice" in result.output
        assert "admin" in result.output
        assert "2 member(s)" in result.output

    @patch("criptenv.commands.members.cli_context")
    def test_members_add(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.add_member = AsyncMock(return_value={"id": "mem_3", "role": "viewer"})
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["members", "add", "usr_99", "--role", "viewer", "--project", "prj_123"])
        assert result.exit_code == 0
        assert "Added member" in result.output
        assert "viewer" in result.output

    @patch("criptenv.commands.members.cli_context")
    def test_members_update(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.update_member = AsyncMock(return_value={"id": "mem_1", "role": "developer"})
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["members", "update", "mem_1", "--role", "developer", "--project", "prj_123"])
        assert result.exit_code == 0
        assert "Updated member" in result.output
        assert "developer" in result.output

    @patch("criptenv.commands.members.cli_context")
    def test_members_remove(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.remove_member = AsyncMock(return_value=None)
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["members", "remove", "mem_1", "--project", "prj_123", "--force"])
        assert result.exit_code == 0
        assert "Removed member" in result.output


# ─── Invites ─────────────────────────────────────────────────────────────────

class TestInvitesCommands:
    @patch("criptenv.commands.invites.cli_context")
    def test_invites_list(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.list_invites = AsyncMock(return_value={
            "invites": [
                {"id": "inv_1", "email": "alice@example.com", "role": "developer", "accepted_at": None, "revoked_at": None},
                {"id": "inv_2", "email": "bob@example.com", "role": "viewer", "accepted_at": "2026-01-01", "revoked_at": None},
            ],
            "total": 2,
        })
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["invites", "list", "--project", "prj_123"])
        assert result.exit_code == 0
        assert "alice@example.com" in result.output
        assert "pending" in result.output
        assert "accepted" in result.output

    @patch("criptenv.commands.invites.cli_context")
    def test_invites_create(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.create_invite = AsyncMock(return_value={
            "id": "inv_3", "email": "charlie@example.com", "role": "admin", "expires_at": "2026-06-01"
        })
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["invites", "create", "charlie@example.com", "--role", "admin", "--project", "prj_123"])
        assert result.exit_code == 0
        assert "Invite sent" in result.output
        assert "charlie@example.com" in result.output

    @patch("criptenv.commands.invites.cli_context")
    def test_invites_accept(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.accept_invite = AsyncMock(return_value={
            "id": "inv_1", "project_name": "My Project", "role": "developer"
        })
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["invites", "accept", "inv_1", "--project", "prj_123"])
        assert result.exit_code == 0
        assert "Accepted invite" in result.output
        assert "My Project" in result.output
        assert "developer" in result.output

    @patch("criptenv.commands.invites.cli_context")
    def test_invites_revoke(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.revoke_invite = AsyncMock(return_value={"id": "inv_1", "email": "alice@example.com"})
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["invites", "revoke", "inv_1", "--project", "prj_123", "--force"])
        assert result.exit_code == 0
        assert "Revoked invite" in result.output


# ─── Audit ───────────────────────────────────────────────────────────────────

class TestAuditCommands:
    @patch("criptenv.commands.audit.cli_context")
    def test_audit_list(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.list_audit = AsyncMock(return_value={
            "logs": [
                {"action": "secret.created", "resource_type": "secret", "created_at": "2026-05-01T12:00:00Z", "user_id": "usr_1"},
                {"action": "project.updated", "resource_type": "project", "created_at": "2026-05-02T10:00:00Z", "user_id": "usr_2"},
            ],
            "total": 2,
            "page": 1,
            "per_page": 50,
        })
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["audit", "list", "--project", "prj_123"])
        assert result.exit_code == 0
        assert "secret.created" in result.output
        assert "project.updated" in result.output
        assert "2 log(s)" in result.output

    @patch("criptenv.commands.audit.cli_context")
    def test_audit_list_with_filters(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.list_audit = AsyncMock(return_value={
            "logs": [{"action": "secret.created", "resource_type": "secret", "created_at": "2026-05-01T12:00:00Z", "user_id": "usr_1"}],
            "total": 1, "page": 1, "per_page": 50,
        })
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["audit", "list", "--project", "prj_123", "--action", "secret.created", "--limit", "10"])
        assert result.exit_code == 0
        mock_client.list_audit.assert_awaited_once_with(
            "prj_123", action="secret.created", resource_type=None, page=1, per_page=10
        )


# ─── API Keys ────────────────────────────────────────────────────────────────

class TestApiKeysCommands:
    @patch("criptenv.commands.api_keys.cli_context")
    def test_api_keys_list(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.list_api_keys = AsyncMock(return_value={
            "items": [
                {"id": "key_1", "name": "CI Key", "prefix": "cek_live_", "scopes": ["read:secrets"]},
                {"id": "key_2", "name": "Deploy Key", "prefix": "cek_test_", "scopes": ["read:secrets", "write:secrets"]},
            ],
            "total": 2,
        })
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["api-keys", "list", "--project", "prj_123"])
        assert result.exit_code == 0
        assert "CI Key" in result.output
        assert "cek_live_" in result.output
        assert "2 key(s)" in result.output

    @patch("criptenv.commands.api_keys.cli_context")
    def test_api_keys_create(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.create_api_key = AsyncMock(return_value={
            "id": "key_3", "name": "New Key", "key": "cek_live_abc123", "expires_at": None,
        })
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["api-keys", "create", "--project", "prj_123", "--name", "New Key"])
        assert result.exit_code == 0
        assert "API key created" in result.output
        assert "cek_live_abc123" in result.output

    @patch("criptenv.commands.api_keys.cli_context")
    def test_api_keys_revoke(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.revoke_api_key = AsyncMock(return_value={"id": "key_1", "name": "CI Key"})
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["api-keys", "revoke", "key_1", "--project", "prj_123", "--force"])
        assert result.exit_code == 0
        assert "Revoked API key" in result.output


# ─── Projects (update/delete/info) ───────────────────────────────────────────

class TestProjectExtraCommands:
    @patch("criptenv.commands.projects.cli_context")
    def test_projects_info(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.get_project = AsyncMock(return_value={
            "id": "prj_123", "name": "My Project", "slug": "my-project",
            "description": "Test desc", "owner_id": "usr_1",
            "created_at": "2026-01-01", "updated_at": "2026-05-01",
        })
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["projects", "info", "prj_123"])
        assert result.exit_code == 0
        assert "My Project" in result.output
        assert "prj_123" in result.output
        assert "Test desc" in result.output

    @patch("criptenv.commands.projects.cli_context")
    def test_projects_update(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.update_project = AsyncMock(return_value={"id": "prj_123", "name": "Updated Name"})
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["projects", "update", "prj_123", "--name", "Updated Name"])
        assert result.exit_code == 0
        assert "Updated project" in result.output

    @patch("criptenv.commands.projects.cli_context")
    def test_projects_delete(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.delete_project = AsyncMock(return_value=None)
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["projects", "delete", "prj_123", "--force"])
        assert result.exit_code == 0
        assert "Deleted project" in result.output

    @patch("criptenv.commands.projects.getpass.getpass")
    @patch("criptenv.commands.projects.cli_context")
    def test_projects_rekey(self, mock_ctx, mock_getpass, runner):
        from criptenv.crypto import build_project_vault_config

        # Setup passwords
        current_pwd = "current_password_123"
        new_pwd = "new_password_1234"
        mock_getpass.side_effect = [current_pwd, new_pwd, new_pwd]

        # Build a real vault config for the current password so verification passes
        vault_config, vault_proof = build_project_vault_config(current_pwd)

        mock_client = AsyncMock()
        mock_client.get_project = AsyncMock(return_value={
            "id": "prj_123",
            "name": "Test Project",
            "vault_config": vault_config,
        })
        mock_client.list_environments = AsyncMock(return_value={
            "environments": [{"id": "env_123", "name": "production"}]
        })
        mock_client.pull_vault = AsyncMock(return_value={
            "blobs": [],
            "version": 1,
        })
        mock_client.rekey_project = AsyncMock(return_value={"vault_config": {}})
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["projects", "rekey", "prj_123", "--force"])
        assert result.exit_code == 0
        assert "Rekeyed project" in result.output
        # Verify rekey_project was called with the full payload
        mock_client.rekey_project.assert_called_once()
        call_kwargs = mock_client.rekey_project.call_args.kwargs
        assert call_kwargs["project_id"] == "prj_123"
        assert "current_vault_proof" in call_kwargs
        assert "new_vault_config" in call_kwargs
        assert "new_vault_proof" in call_kwargs
        assert "environments" in call_kwargs


# ─── Environments (update/delete/get) ────────────────────────────────────────────

class TestUseCommand:
    @patch("criptenv.commands.use.queries.set_config", new_callable=AsyncMock)
    @patch("criptenv.commands.use.cli_context")
    def test_use_set_project(self, mock_ctx, mock_set_config, runner):
        mock_client = AsyncMock()
        mock_client.get_project = AsyncMock(return_value={"id": "prj_123", "name": "My Project"})
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["use", "prj_123"])
        assert result.exit_code == 0
        assert "Set current project" in result.output
        assert "My Project" in result.output

    @patch("criptenv.commands.use.queries.get_config", new_callable=AsyncMock)
    @patch("criptenv.commands.use.cli_context")
    def test_use_show_current(self, mock_ctx, mock_get_config, runner):
        mock_get_config.return_value = "prj_123"
        mock_client = AsyncMock()
        mock_client.get_project = AsyncMock(return_value={"id": "prj_123", "name": "My Project"})
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["use"])
        assert result.exit_code == 0
        assert "My Project" in result.output

    @patch("criptenv.commands.use.queries.set_config", new_callable=AsyncMock)
    @patch("criptenv.commands.use.cli_context")
    def test_use_clear(self, mock_ctx, mock_set_config, runner):
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, AsyncMock())
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["use", "--clear"])
        assert result.exit_code == 0
        assert "Cleared current project" in result.output


class TestSessionsCommand:
    @patch("criptenv.commands.sessions.cli_context")
    def test_sessions_list(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.get_sessions = AsyncMock(return_value={
            "sessions": [
                {"device_info": "Chrome on macOS", "ip_address": "192.168.1.1", "created_at": "2026-05-01T10:00:00Z", "is_current": True},
                {"device_info": "Firefox on Linux", "ip_address": "192.168.1.2", "created_at": "2026-05-02T12:00:00Z", "is_current": False},
            ],
        })
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["sessions"])
        assert result.exit_code == 0
        assert "Chrome on macOS" in result.output
        assert "192.168.1.1" in result.output
        assert "2 session(s)" in result.output

    @patch("criptenv.commands.sessions.cli_context")
    def test_sessions_empty(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.get_sessions = AsyncMock(return_value={"sessions": []})
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["sessions"])
        assert result.exit_code == 0
        assert "No active sessions found" in result.output


class TestStatusCommand:
    @patch("criptenv.commands.status.cli_context")
    def test_status_logged_in(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.get_session = AsyncMock(return_value={"email": "user@example.com", "name": "User"})
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        with patch("criptenv.commands.status.queries.get_config", AsyncMock(return_value="prj_123")):
            result = runner.invoke(main, ["status"])
            assert result.exit_code == 0
            assert "Logged in" in result.output
            assert "user@example.com" in result.output


class TestCompletionCommand:
    def test_completion_bash(self, runner):
        result = runner.invoke(main, ["completion", "bash"])
        assert result.exit_code == 0
        assert "criptenv" in result.output

    def test_completion_zsh(self, runner):
        result = runner.invoke(main, ["completion", "zsh"])
        assert result.exit_code == 0
        assert "criptenv" in result.output

    def test_completion_fish(self, runner):
        result = runner.invoke(main, ["completion", "fish"])
        assert result.exit_code == 0
        assert "criptenv" in result.output


class TestEnvironmentExtraCommands:
    @patch("criptenv.commands.environments.cli_context")
    def test_env_update(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.update_environment = AsyncMock(return_value={"id": "env_1", "name": "staging"})
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["env", "update", "env_1", "--project", "prj_123", "--display-name", "Staging Environment"])
        assert result.exit_code == 0
        assert "Updated environment" in result.output

    @patch("criptenv.commands.environments.cli_context")
    def test_env_delete(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.delete_environment = AsyncMock(return_value=None)
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["env", "delete", "env_1", "--project", "prj_123", "--force"])
        assert result.exit_code == 0
        assert "Deleted environment" in result.output

    @patch("criptenv.commands.environments.cli_context")
    def test_env_get(self, mock_ctx, runner):
        mock_client = AsyncMock()
        mock_client.get_environment = AsyncMock(return_value={
            "id": "env_1", "name": "staging", "display_name": "Staging Environment",
            "is_default": False, "created_at": "2026-01-01", "updated_at": "2026-05-01",
        })
        mock_ctx.return_value.__enter__ = lambda s: (_make_mock_db(), None, mock_client)
        mock_ctx.return_value.__exit__ = lambda s, *a: None

        result = runner.invoke(main, ["env", "get", "env_1", "--project", "prj_123"])
        assert result.exit_code == 0
        assert "staging" in result.output
        assert "Staging Environment" in result.output
        assert "No" in result.output
