"""CLI context helpers — bridges async vault/API with sync Click commands."""

import asyncio
import getpass
import os
import sys
import uuid
from contextlib import asynccontextmanager, contextmanager
from typing import Optional

import click
import aiosqlite

from criptenv.crypto.keys import derive_master_key
from criptenv.vault.database import get_db, init_schema, close_db
from criptenv.vault import queries
from criptenv.session import SessionManager, get_or_create_auth_key
from criptenv.api.client import CriptEnvClient


def run_async(coro):
    """Run an async coroutine from a sync Click command."""
    return asyncio.run(coro)


def _get_master_password() -> str:
    """Prompt for the legacy local-vault master password.

    Main remote-terminal secret commands use the project Vault password via
    RemoteVault. This helper remains for compatibility paths/tests that still
    exercise the historical local vault.
    """
    password = os.getenv("CRIPTENV_MASTER_PASSWORD")
    if password:
        return password
    return prompt_secret("Master password: ", "CRIPTENV_MASTER_PASSWORD")


def prompt_secret(prompt: str, env_var: str) -> str:
    """getpass, but fail fast without a TTY instead of waiting for input that never comes."""
    if not sys.stdin.isatty():
        raise click.ClickException(
            f"{env_var} is not set and there is no terminal to prompt for it."
        )
    return getpass.getpass(prompt)


async def _load_master_key(db: aiosqlite.Connection) -> bytes:
    """Load salt from vault and derive master key from user password."""
    salt_hex = await queries.get_config(db, "master_salt")
    if not salt_hex:
        raise click.ClickException(
            "Not initialized. Run 'criptenv init' first."
        )

    password = _get_master_password()
    return derive_master_key(password, bytes.fromhex(salt_hex))


async def _migrate_legacy_session(
    db: aiosqlite.Connection,
    auth_key: bytes,
) -> tuple[SessionManager, CriptEnvClient] | None:
    """Migrate a pre-auth-key session encrypted with the vault master key."""
    salt_hex = await queries.get_config(db, "master_salt")
    if not salt_hex:
        return None

    click.echo(
        "Saved session uses legacy vault encryption. "
        "Enter the master password once to migrate CLI auth.",
        err=True,
    )
    master_key = await _load_master_key(db)
    legacy_manager = SessionManager(master_key, db)
    client = await legacy_manager.get_authenticated_client()
    session = await legacy_manager.get_active_session()
    if not client or not session or not client.session_token:
        return None

    manager = SessionManager(auth_key, db)
    await manager.login_with_token(
        client.session_token,
        {"id": session.user_id, "email": session.email},
    )
    migrated_client = await manager.get_authenticated_client()
    return (manager, migrated_client) if migrated_client else None


async def _get_session_manager(
    db: aiosqlite.Connection,
    require_master_key: bool = False,
) -> tuple[SessionManager, bytes | None]:
    """Get a SessionManager with a valid authenticated client.

    CRIPTENV_API_KEY, when set, authenticates this process directly: no
    session is read from or written to disk.
    """
    master_key: bytes | None = await _load_master_key(db) if require_master_key else None

    api_key = os.getenv("CRIPTENV_API_KEY")
    if api_key:
        manager = SessionManager(b"", db)
        manager.client.set_token(api_key)
        return manager, master_key

    storage_key = get_or_create_auth_key()
    manager = SessionManager(storage_key, db)

    try:
        client = await manager.get_authenticated_client()
    except Exception:
        migrated = await _migrate_legacy_session(db, storage_key)
        if migrated:
            manager, client = migrated
        else:
            client = None

    if not client:
        raise click.ClickException(
            "Not logged in or session expired. Run 'criptenv login' first."
        )

    return manager, master_key


async def _resolve_env_id(
    db: aiosqlite.Connection,
    env_name_or_id: Optional[str],
) -> str:
    """Resolve environment name to ID. Falls back to 'default'."""
    if not env_name_or_id:
        env_name_or_id = "default"

    # Try as ID first
    env = await queries.get_environment(db, env_name_or_id)
    if env:
        return env.id

    # Try as name
    env = await queries.get_environment_by_name(db, env_name_or_id)
    if env:
        return env.id

    raise click.ClickException(
        f"Environment '{env_name_or_id}' not found. "
        "Run 'criptenv env list' to see available environments."
    )


def get_project_id_from_env() -> Optional[str]:
    """Get project ID from CRIPTENV_PROJECT environment variable."""
    return os.getenv("CRIPTENV_PROJECT")


async def get_current_project_id(db: aiosqlite.Connection) -> Optional[str]:
    """Get the currently selected project ID from local config."""
    return await queries.get_config(db, "current_project_id")


async def set_current_project_id(db: aiosqlite.Connection, project_id: str):
    """Set the currently selected project ID in local config."""
    await queries.set_config(db, "current_project_id", project_id)


async def clear_current_project_id(db: aiosqlite.Connection):
    """Clear the currently selected project ID from local config."""
    await db.execute("DELETE FROM config WHERE key = ?", ("current_project_id",))
    await db.commit()


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


async def _project_id_from_name(client: CriptEnvClient | None, value: str) -> str:
    """Accept a project name/slug where an ID is expected (the API only takes UUIDs)."""
    if client is None or _is_uuid(value):
        return value
    result = await client.list_projects()
    matches = [
        p for p in result.get("projects", []) if value in (p.get("name"), p.get("slug"))
    ]
    if len(matches) == 1:
        return matches[0]["id"]
    if not matches:
        raise click.ClickException(
            f"Project '{value}' not found. Run 'criptenv projects list' to see your projects."
        )
    raise click.ClickException(
        f"More than one project is named '{value}'. Use the project ID instead."
    )


def resolve_project_id(
    db: aiosqlite.Connection,
    explicit_project_id: Optional[str] = None,
    client: CriptEnvClient | None = None,
) -> str:
    """Resolve project ID from explicit flag, env var, or saved config.

    Priority:
        1. Explicit --project flag
        2. CRIPTENV_PROJECT environment variable
        3. Saved current_project_id in local config

    Names/slugs from 1 and 2 are resolved to IDs when ``client`` is given.
    Raises ClickException if no project ID can be resolved.
    """
    return run_async(resolve_project_id_async(db, explicit_project_id, client))


async def resolve_project_id_async(
    db: aiosqlite.Connection,
    explicit_project_id: Optional[str] = None,
    client: CriptEnvClient | None = None,
) -> str:
    """Async variant of resolve_project_id for async Click command bodies."""
    if explicit_project_id:
        return await _project_id_from_name(client, explicit_project_id)

    env_project = get_project_id_from_env()
    if env_project:
        return await _project_id_from_name(client, env_project)

    saved = await get_current_project_id(db)
    if saved:
        return saved

    raise click.ClickException(
        "No project selected. Use one of:\n"
        "  --project <id>                  (per-command flag)\n"
        "  CRIPTENV_PROJECT=<id>           (environment variable)\n"
        "  criptenv use <id>               (set default project)"
    )


async def _open_db(require_auth: bool, require_master_key: bool) -> aiosqlite.Connection:
    """Open the local vault DB, or a throwaway in-memory one in API-key mode.

    CRIPTENV_API_KEY runs keep no local state, so they must not create
    ~/.criptenv/vault.db (and must work with a read-only HOME).
    """
    if require_auth and not require_master_key and os.getenv("CRIPTENV_API_KEY"):
        db = await aiosqlite.connect(":memory:")
        db.row_factory = aiosqlite.Row
    else:
        db = await get_db()
    await init_schema(db)
    return db


@contextmanager
def cli_context(require_auth: bool = False, require_master_key: bool | None = None):
    """
    Context manager that sets up DB, optional master key, and optional session.

    Usage:
        with cli_context() as (db, master_key):
            # local-only operations (init, set, get, list, delete)

        with cli_context(require_auth=True) as (db, None, client):
            # API operations that do not need local secret decryption

        with cli_context(require_auth=True, require_master_key=True) as (db, master_key, client):
            # API operations that also decrypt local secrets
    """
    if require_master_key is None:
        require_master_key = not require_auth

    db = run_async(_open_db(require_auth, require_master_key))

    try:
        if require_auth:
            manager, master_key = run_async(_get_session_manager(db, require_master_key))
            client = manager.client
            yield db, master_key, client
        elif require_master_key:
            # For local-only operations, still need master key
            salt_hex = run_async(queries.get_config(db, "master_salt"))
            if salt_hex:
                password = _get_master_password()
                master_key = derive_master_key(password, bytes.fromhex(salt_hex))
            else:
                master_key = None
            yield db, master_key, None
        else:
            yield db, None, CriptEnvClient()
    finally:
        run_async(close_db(db))


@asynccontextmanager
async def async_cli_context(require_auth: bool = False, require_master_key: bool | None = None):
    """Async variant of cli_context for Click commands already inside a coroutine."""
    if require_master_key is None:
        require_master_key = not require_auth

    db = await _open_db(require_auth, require_master_key)

    try:
        if require_auth:
            manager, master_key = await _get_session_manager(db, require_master_key)
            client = manager.client
            yield db, master_key, client
        elif require_master_key:
            salt_hex = await queries.get_config(db, "master_salt")
            if salt_hex:
                password = _get_master_password()
                master_key = derive_master_key(password, bytes.fromhex(salt_hex))
            else:
                master_key = None
            yield db, master_key, None
        else:
            yield db, None, CriptEnvClient()
    finally:
        await close_db(db)


@contextmanager
def local_vault():
    """
    Lightweight context for operations that only need DB access
    (no master key, no auth). Used by 'init' command.
    """
    db = run_async(get_db())
    run_async(init_schema(db))
    try:
        yield db
    finally:
        run_async(close_db(db))
