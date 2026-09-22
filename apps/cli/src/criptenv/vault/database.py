"""SQLite database management for local vault."""

import os
import aiosqlite
from pathlib import Path

from criptenv.config import CONFIG_DIR, DB_FILE

# The vault directory holds encrypted secrets, CI sessions and the local auth
# key. Restrict it to the owner so other local users cannot read (or replace) it.
CONFIG_DIR_MODE = 0o700
DB_FILE_MODE = 0o600


def _restrict_permissions() -> None:
    """Best-effort tightening of the vault directory and database file modes."""
    try:
        os.chmod(CONFIG_DIR, CONFIG_DIR_MODE)
    except OSError:
        pass
    try:
        if DB_FILE.exists():
            os.chmod(DB_FILE, DB_FILE_MODE)
    except OSError:
        pass


async def get_db() -> aiosqlite.Connection:
    """Get database connection, creating schema if needed."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    _restrict_permissions()

    db = await aiosqlite.connect(str(DB_FILE))
    db.row_factory = aiosqlite.Row

    # aiosqlite creates the file with the process umask; tighten it explicitly.
    _restrict_permissions()

    # Enable foreign keys
    await db.execute("PRAGMA foreign_keys = ON")

    return db


async def init_schema(db: aiosqlite.Connection):
    """Initialize database schema."""
    await db.executescript("""
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            email TEXT NOT NULL,
            token_encrypted BLOB NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS environments (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            env_key_encrypted BLOB NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS secrets (
            id TEXT PRIMARY KEY,
            environment_id TEXT NOT NULL,
            key_id TEXT NOT NULL,
            iv BLOB NOT NULL,
            ciphertext BLOB NOT NULL,
            auth_tag BLOB NOT NULL,
            version INTEGER DEFAULT 1,
            checksum TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (environment_id) REFERENCES environments(id)
        );

        CREATE TABLE IF NOT EXISTS ci_sessions (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            project_name TEXT NOT NULL,
            session_token_encrypted BLOB NOT NULL,
            scopes TEXT NOT NULL,
            environment_scope TEXT,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_secrets_env ON secrets(environment_id);
        CREATE INDEX IF NOT EXISTS idx_secrets_key ON secrets(key_id);
        CREATE INDEX IF NOT EXISTS idx_ci_sessions_expires ON ci_sessions(expires_at);
    """)
    await db.commit()


async def close_db(db: aiosqlite.Connection):
    """Close database connection."""
    await db.close()
