"""Tests for CLI session storage and authenticated context."""

from pathlib import Path

from criptenv.context import cli_context, local_vault, run_async
from criptenv.session import SessionManager, get_or_create_auth_key


def test_authenticated_context_uses_cli_auth_key_without_master_password(
    mock_config_dir, monkeypatch
):
    """API-only commands should not unlock the local secrets vault."""
    auth_key_file = mock_config_dir / "auth.key"
    monkeypatch.setattr("criptenv.session.AUTH_KEY_FILE", auth_key_file)

    with local_vault() as db:
        auth_key = get_or_create_auth_key()
        manager = SessionManager(auth_key, db)
        run_async(
            manager.login_with_token(
                "session-token",
                {"id": "usr_1", "email": "dev@example.com"},
            )
        )

    def fail_if_prompted():
        raise AssertionError("master password should not be requested")

    monkeypatch.setattr("criptenv.context._get_master_password", fail_if_prompted)

    with cli_context(require_auth=True) as (_db, master_key, client):
        assert master_key is None
        assert client.session_token == "session-token"

    assert Path(auth_key_file).exists()
