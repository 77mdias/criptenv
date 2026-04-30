"""SQLite database management for local vault."""

import aiosqlite
from pathlib import Path

from criptenv.config import CONFIG_DIR, DB_FILE


async def get_db() -> aiosqlite.Connection:
    """Get database connection, creating schema if needed."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)

    db = await aiosqlite.connect(str(DB_FILE))
    db.row_factory = aiosqlite.Row

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

        CREATE INDEX IF NOT EXISTS idx_secrets_env ON secrets(environment_id);
        CREATE INDEX IF NOT EXISTS idx_secrets_key ON secrets(key_id);
    """)
    await db.commit()


async def close_db(db: aiosqlite.Connection):
    """Close database connection."""
    await db.close()
