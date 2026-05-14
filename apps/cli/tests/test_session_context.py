"""Tests for CLI session storage and authenticated context."""

from pathlib import Path

from criptenv.context import cli_context, local_vault, run_async
from criptenv.crypto.keys import derive_master_key
from criptenv.session import SessionManager, get_or_create_auth_key
from criptenv.vault import queries


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


def test_authenticated_context_with_master_key_keeps_session_on_cli_auth_key(
    mock_config_dir, monkeypatch
):
    """Sync commands need auth.key for the API session and master key for local secrets."""
    password = "local-master-password"
    salt = bytes(range(32))
    expected_master_key = derive_master_key(password, salt)

    with local_vault() as db:
        run_async(queries.set_config(db, "master_salt", salt.hex()))
        auth_key = get_or_create_auth_key()
        manager = SessionManager(auth_key, db)
        run_async(
            manager.login_with_token(
                "session-token",
                {"id": "usr_1", "email": "dev@example.com"},
            )
        )

    monkeypatch.setattr("criptenv.context._get_master_password", lambda: password)

    with cli_context(require_auth=True, require_master_key=True) as (
        _db,
        master_key,
        client,
    ):
        assert master_key == expected_master_key
        assert client.session_token == "session-token"
