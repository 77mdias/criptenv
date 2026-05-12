"""CLI context helpers — bridges async vault/API with sync Click commands."""

import asyncio
import getpass
import os
from contextlib import asynccontextmanager, contextmanager
from typing import Optional

import click
import aiosqlite

from criptenv.crypto.keys import derive_master_key
from criptenv.vault.database import get_db, init_schema, close_db
from criptenv.vault import queries
from criptenv.session import SessionManager
from criptenv.api.client import CriptEnvClient


def run_async(coro):
    """Run an async coroutine from a sync Click command."""
    return asyncio.run(coro)


def _get_master_password() -> str:
    """Prompt user for master password (hidden input).
    
    In CI/CD environments, set CRIPTENV_MASTER_PASSWORD to avoid interactive prompt.
    """
    password = os.getenv("CRIPTENV_MASTER_PASSWORD")
    if password:
        return password
    return getpass.getpass("Master password: ")


async def _load_master_key(db: aiosqlite.Connection) -> bytes:
    """Load salt from vault and derive master key from user password."""
    salt_hex = await queries.get_config(db, "master_salt")
    if not salt_hex:
        raise click.ClickException(
            "Not initialized. Run 'criptenv init' first."
        )

    password = _get_master_password()
    return derive_master_key(password, bytes.fromhex(salt_hex))


async def _get_session_manager(db: aiosqlite.Connection) -> SessionManager:
    """Get a SessionManager with a valid authenticated client."""
    master_key = await _load_master_key(db)
    manager = SessionManager(master_key, db)

    client = await manager.get_authenticated_client()
    if not client:
        raise click.ClickException(
            "Not logged in or session expired. Run 'criptenv login' first."
        )

    return manager


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


def resolve_project_id(
    db: aiosqlite.Connection,
    explicit_project_id: Optional[str] = None,
) -> str:
    """Resolve project ID from explicit flag, env var, or saved config.

    Priority:
        1. Explicit --project flag
        2. CRIPTENV_PROJECT environment variable
        3. Saved current_project_id in local config

    Raises ClickException if no project ID can be resolved.
    """
    # 1. Explicit flag
    if explicit_project_id:
        return explicit_project_id

    # 2. Environment variable
    env_project = get_project_id_from_env()
    if env_project:
        return env_project

    # 3. Saved config
    saved = run_async(get_current_project_id(db))
    if saved:
        return saved

    raise click.ClickException(
        "No project selected. Use one of:\n"
        "  --project <id>                  (per-command flag)\n"
        "  CRIPTENV_PROJECT=<id>           (environment variable)\n"
        "  criptenv use <id>               (set default project)"
    )


@contextmanager
def cli_context(require_auth: bool = False):
    """
    Context manager that sets up DB, master key, and optionally session.

    Usage:
        with cli_context() as (db, master_key):
            # local-only operations (init, set, get, list, delete)

        with cli_context(require_auth=True) as (db, master_key, client):
            # API operations (push, pull, env list, etc.)
    """
    db = run_async(get_db())
    run_async(init_schema(db))

    try:
        if require_auth:
            manager = run_async(_get_session_manager(db))
            client = manager.client
            master_key = manager.master_key
            yield db, master_key, client
        else:
            # For local-only operations, still need master key
            salt_hex = run_async(queries.get_config(db, "master_salt"))
            if salt_hex:
                password = _get_master_password()
                master_key = derive_master_key(password, bytes.fromhex(salt_hex))
            else:
                master_key = None
            yield db, master_key, None
    finally:
        run_async(close_db(db))


@asynccontextmanager
async def async_cli_context(require_auth: bool = False):
    """Async variant of cli_context for Click commands already inside a coroutine."""
    db = await get_db()
    await init_schema(db)

    try:
        if require_auth:
            master_key = await _load_master_key(db)
            manager = SessionManager(master_key, db)
            client = await manager.get_authenticated_client()
            if not client:
                raise click.ClickException(
                    "Not logged in or session expired. Run 'criptenv login' first."
                )
            yield db, master_key, client
        else:
            salt_hex = await queries.get_config(db, "master_salt")
            if salt_hex:
                password = _get_master_password()
                master_key = derive_master_key(password, bytes.fromhex(salt_hex))
            else:
                master_key = None
            yield db, master_key, None
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
