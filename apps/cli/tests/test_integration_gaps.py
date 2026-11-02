"""Regressions for gaps found integrating the CLI into a Docker app (docs/segredos.md)."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import click
import pytest
from click.testing import CliRunner

from criptenv.cli import main
from criptenv.commands.import_export import _format_entries, _parse_env_file
from criptenv.context import _get_session_manager, prompt_secret, resolve_project_id_async

TRICKY = {
    "PLAIN": "abc-123",
    "SPACE_HASH": "a b # not a comment",
    "QUOTES": "it's \"quoted\"",
    "MULTILINE": "line1\nline2\\end",
    "DOLLAR": "$aact_xyz",
    "EMPTY": "",
}


def test_env_format_roundtrips_tricky_values(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(_format_entries(TRICKY, "env"))
    assert dict(_parse_env_file(str(env_file))) == TRICKY


@pytest.mark.parametrize("fmt,expected", [("json", {}), ("env", None)])
def test_export_empty_keeps_stdout_clean(fmt, expected):
    runner = CliRunner()
    with patch("criptenv.commands.import_export.export_entries_remote", return_value={}):
        result = runner.invoke(main, ["export", "--format", fmt])
    assert result.exit_code == 0
    assert "No secrets to export." in result.stderr
    assert "No secrets" not in result.stdout
    if expected is not None:
        assert json.loads(result.stdout) == expected
    else:
        assert result.stdout == ""


def test_prompt_secret_fails_without_tty():
    with patch("sys.stdin.isatty", return_value=False):
        with pytest.raises(click.ClickException, match="CRIPTENV_VAULT_PASSWORD"):
            prompt_secret("Vault password: ", "CRIPTENV_VAULT_PASSWORD")


async def test_api_key_env_authenticates_without_session(monkeypatch, tmp_path):
    monkeypatch.setenv("CRIPTENV_API_KEY", "cek_test")
    with patch("criptenv.context.get_or_create_auth_key") as auth_key:
        manager, _ = await _get_session_manager(db=MagicMock())
    assert manager.client.session_token == "cek_test"
    auth_key.assert_not_called()  # nothing touches ~/.criptenv/auth.key


class TestProjectNameResolution:
    UUID = "11111111-2222-3333-4444-555555555555"

    def _client(self, projects):
        client = MagicMock()
        client.list_projects = AsyncMock(return_value={"projects": projects})
        return client

    async def test_uuid_passes_through_without_api_call(self):
        client = self._client([])
        assert await resolve_project_id_async(MagicMock(), self.UUID, client) == self.UUID
        client.list_projects.assert_not_called()

    async def test_name_and_slug_resolve_to_id(self):
        client = self._client([{"id": self.UUID, "name": "AutoGiro", "slug": "autogiro"}])
        assert await resolve_project_id_async(MagicMock(), "AutoGiro", client) == self.UUID
        assert await resolve_project_id_async(MagicMock(), "autogiro", client) == self.UUID

    async def test_unknown_name_fails_clearly(self):
        with pytest.raises(click.ClickException, match="not found"):
            await resolve_project_id_async(MagicMock(), "nope", self._client([]))
