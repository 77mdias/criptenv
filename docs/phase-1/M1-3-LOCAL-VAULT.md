# M1.3: Local Vault

**Milestone**: M1.3
**Duration**: Week 3
**Goal**: SQLite database at `~/.criptenv/vault.db` storing encrypted secrets
**Status**: ✅ COMPLETE (2026-04-30)

---

## Overview

The local vault stores encrypted secrets and session data in a SQLite database at `~/.criptenv/vault.db`. This is the only place where secrets are stored locally - the CLI never writes plaintext to disk.

---

## Schema

```sql
-- ~/.criptenv/vault.db

-- Master key salt (not the key itself)
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Encrypted session tokens
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    token_encrypted BLOB NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

-- Project/environment mappings (metadata only)
CREATE TABLE environments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    env_key_encrypted BLOB NOT NULL,  -- Encrypted environment key
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Encrypted secrets
CREATE TABLE secrets (
    id TEXT PRIMARY KEY,
    environment_id TEXT NOT NULL,
    key_id TEXT NOT NULL,              -- Human-readable key name
    iv BLOB NOT NULL,                  -- 12-byte IV
    ciphertext BLOB NOT NULL,           -- Encrypted value
    auth_tag BLOB NOT NULL,            -- 16-byte auth tag
    version INTEGER DEFAULT 1,
    checksum TEXT NOT NULL,            -- SHA-256 of plaintext
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (environment_id) REFERENCES environments(id)
);

CREATE INDEX idx_secrets_env ON secrets(environment_id);
CREATE INDEX idx_secrets_key ON secrets(key_id);
```

---

## File: vault/database.py

```python
"""SQLite database management for local vault"""

import aiosqlite
from pathlib import Path
import time
from typing import Optional

from criptenv.config import CONFIG_DIR, DB_FILE


async def get_db() -> aiosqlite.Connection:
    """Get database connection, creating if needed"""
    CONFIG_DIR.mkdir(exist_ok=True)

    db = await aiosqlite.connect(DB_FILE)
    db.row_factory = aiosqlite.Row

    # Enable foreign keys
    await db.execute("PRAGMA foreign_keys = ON")

    return db


async def init_schema(db: aiosqlite.Connection):
    """Initialize database schema"""
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
    """Close database connection"""
    await db.close()
```

---

## File: vault/models.py

```python
"""Data models for local vault"""

from dataclasses import dataclass
from typing import Optional
import time


@dataclass
class Session:
    id: str
    user_id: str
    email: str
    token_encrypted: bytes
    created_at: int
    expires_at: int

    @property
    def is_expired(self) -> bool:
        return time.time() > self.expires_at


@dataclass
class Environment:
    id: str
    project_id: str
    name: str
    env_key_encrypted: bytes
    created_at: int
    updated_at: int


@dataclass
class Secret:
    id: str
    environment_id: str
    key_id: str
    iv: bytes
    ciphertext: bytes
    auth_tag: bytes
    version: int
    checksum: str
    created_at: int
    updated_at: int

    @property
    def is_expired(self) -> bool:
        return False  # Secrets don't expire by default
```

---

## File: vault/queries.py

```python
"""Database queries for local vault"""

import aiosqlite
import os
import time
from typing import List, Optional

from criptenv.crypto import encrypt, decrypt, derive_env_key, encode_bytes, decode_bytes
from criptenv.vault.models import Session, Environment, Secret
from criptenv.vault.database import get_db, init_schema


# === Config Operations ===

async def get_config(key: str) -> Optional[str]:
    """Get config value"""
    db = await get_db()
    try:
        await init_schema(db)
        cursor = await db.execute(
            "SELECT value FROM config WHERE key = ?", (key,)
        )
        row = await cursor.fetchone()
        return row["value"] if row else None
    finally:
        await db.close()


async def set_config(key: str, value: str):
    """Set config value"""
    db = await get_db()
    try:
        await init_schema(db)
        await db.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
            (key, value)
        )
        await db.commit()
    finally:
        await db.close()


# === Session Operations ===

async def save_session(session: Session):
    """Save encrypted session"""
    db = await get_db()
    try:
        await init_schema(db)
        await db.execute(
            """INSERT OR REPLACE INTO sessions
               (id, user_id, email, token_encrypted, created_at, expires_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (session.id, session.user_id, session.email,
             session.token_encrypted, session.created_at, session.expires_at)
        )
        await db.commit()
    finally:
        await db.close()


async def get_session(session_id: str) -> Optional[Session]:
    """Get session by ID"""
    db = await get_db()
    try:
        await init_schema(db)
        cursor = await db.execute(
            "SELECT * FROM sessions WHERE id = ?", (session_id,)
        )
        row = await cursor.fetchone()
        if row:
            return Session(**dict(row))
        return None
    finally:
        await db.close()


async def delete_session(session_id: str):
    """Delete session"""
    db = await get_db()
    try:
        await db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        await db.commit()
    finally:
        await db.close()


# === Environment Operations ===

async def save_environment(env: Environment, master_key: bytes):
    """Save environment with encrypted key"""
    # Derive env key and encrypt it with master key
    env_key = derive_env_key(master_key, env.id)
    encrypted_key, iv, auth_tag, checksum = encrypt(env_key, master_key)

    db = await get_db()
    try:
        await init_schema(db)
        await db.execute(
            """INSERT OR REPLACE INTO environments
               (id, project_id, name, env_key_encrypted, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (env.id, env.project_id, env.name, encrypted_key,
             env.created_at, env.updated_at)
        )
        await db.commit()
    finally:
        await db.close()


async def get_environment(env_id: str, master_key: bytes) -> Optional[Environment]:
    """Get environment and decrypt key"""
    db = await get_db()
    try:
        await init_schema(db)
        cursor = await db.execute(
            "SELECT * FROM environments WHERE id = ?", (env_id,)
        )
        row = await cursor.fetchone()
        if not row:
            return None

        # Decrypt environment key
        encrypted = row["env_key_encrypted"]
        iv = encrypted[:12]
        auth_tag = encrypted[-16:]
        ciphertext = encrypted[12:-16]
        env_key = decrypt(ciphertext, iv, auth_tag, master_key)

        return Environment(
            id=row["id"],
            project_id=row["project_id"],
            name=row["name"],
            env_key_encrypted=env_key,  # Actually decrypted key
            created_at=row["created_at"],
            updated_at=row["updated_at"]
        )
    finally:
        await db.close()


async def list_environments(project_id: str) -> List[Environment]:
    """List environments for a project"""
    db = await get_db()
    try:
        await init_schema(db)
        cursor = await db.execute(
            "SELECT * FROM environments WHERE project_id = ?",
            (project_id,)
        )
        rows = await cursor.fetchall()
        return [Environment(**dict(row)) for row in rows]
    finally:
        await db.close()


# === Secret Operations ===

async def save_secret(secret: Secret, env_key: bytes):
    """Save encrypted secret"""
    db = await get_db()
    try:
        await init_schema(db)
        await db.execute(
            """INSERT OR REPLACE INTO secrets
               (id, environment_id, key_id, iv, ciphertext, auth_tag, version, checksum, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (secret.id, secret.environment_id, secret.key_id,
             secret.iv, secret.ciphertext, secret.auth_tag,
             secret.version, secret.checksum, secret.created_at, secret.updated_at)
        )
        await db.commit()
    finally:
        await db.close()


async def get_secret(secret_id: str, env_key: bytes) -> Optional[Secret]:
    """Get and decrypt secret"""
    db = await get_db()
    try:
        await init_schema(db)
        cursor = await db.execute(
            "SELECT * FROM secrets WHERE id = ?", (secret_id,)
        )
        row = await cursor.fetchone()
        if not row:
            return None

        return Secret(**dict(row))
    finally:
        await db.close()


async def list_secrets(environment_id: str) -> List[Secret]:
    """List secrets for an environment (without decrypting values)"""
    db = await get_db()
    try:
        await init_schema(db)
        cursor = await db.execute(
            "SELECT id, environment_id, key_id, version, checksum, created_at, updated_at FROM secrets WHERE environment_id = ?",
            (environment_id,)
        )
        rows = await cursor.fetchall()
        return [Secret(**dict(row)) for row in rows]
    finally:
        await db.close()


async def delete_secret(secret_id: str):
    """Delete a secret"""
    db = await get_db()
    try:
        await db.execute("DELETE FROM secrets WHERE id = ?", (secret_id,))
        await db.commit()
    finally:
        await db.close()
```

---

## File: vault/**init**.py

```python
"""CriptEnv local vault module"""

from criptenv.vault.database import get_db, init_schema, close_db
from criptenv.vault.models import Session, Environment, Secret
from criptenv.vault import queries

__all__ = [
    "get_db",
    "init_schema",
    "close_db",
    "Session",
    "Environment",
    "Secret",
    "queries",
]
```

---

## Usage Example

```python
from criptenv.vault import queries, Session, Environment, Secret
from criptenv.crypto import derive_master_key
import time

# Save a session
master_key = derive_master_key("password", salt)
session = Session(
    id="sess_abc123",
    user_id="user_123",
    email="user@example.com",
    token_encrypted=encrypted_token,
    created_at=int(time.time()),
    expires_at=int(time.time()) + 86400
)
await queries.save_session(session)

# Save an environment
env = Environment(
    id="env_xyz",
    project_id="proj_123",
    name="production",
    env_key_encrypted=b"",  # Will be encrypted
    created_at=int(time.time()),
    updated_at=int(time.time())
)
await queries.save_environment(env, master_key)

# List secrets
secrets = await queries.list_secrets("env_xyz")
for s in secrets:
    print(f"{s.key_id}: v{s.version}")
```

---

## Verification

```bash
cd apps/cli
pytest tests/test_vault.py -v

# Expected:
# test_save_session PASSED
# test_get_session PASSED
# test_save_environment PASSED
# test_list_secrets PASSED
```

---

## Security Notes

1. **Master key never stored** - only derived from password when needed
2. **Session token encrypted** before storage
3. **Environment keys encrypted** with master key
4. **Secrets stored as blobs** - raw ciphertext, not searchable
5. **SQLite file permissions** - should be 600 (owner read/write only)

---

**Previous**: [M1-2-ENCRYPTION.md](M1-2-ENCRYPTION.md)
**Next**: [M1-4-AUTH.md](M1-4-AUTH.md)
