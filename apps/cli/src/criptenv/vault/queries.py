"""Database query operations for local vault."""

import time
from typing import Optional

import aiosqlite

from criptenv.vault.models import Session, Environment, Secret, CISession


# ─── Config ───────────────────────────────────────────────────────────────────


async def get_config(db: aiosqlite.Connection, key: str) -> Optional[str]:
    """Get a config value by key."""
    cursor = await db.execute("SELECT value FROM config WHERE key = ?", (key,))
    row = await cursor.fetchone()
    return row["value"] if row else None


async def set_config(db: aiosqlite.Connection, key: str, value: str):
    """Set a config value."""
    await db.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
        (key, value),
    )
    await db.commit()


# ─── Sessions ─────────────────────────────────────────────────────────────────


async def save_session(db: aiosqlite.Connection, session: Session):
    """Save or update an encrypted session."""
    await db.execute(
        """INSERT OR REPLACE INTO sessions
           (id, user_id, email, token_encrypted, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            session.id,
            session.user_id,
            session.email,
            session.token_encrypted,
            session.created_at,
            session.expires_at,
        ),
    )
    await db.commit()


async def get_active_session(db: aiosqlite.Connection) -> Optional[Session]:
    """Get the most recent non-expired session."""
    now = int(time.time())
    cursor = await db.execute(
        """SELECT * FROM sessions
           WHERE expires_at > ?
           ORDER BY created_at DESC
           LIMIT 1""",
        (now,),
    )
    row = await cursor.fetchone()
    if not row:
        return None
    return Session(
        id=row["id"],
        user_id=row["user_id"],
        email=row["email"],
        token_encrypted=row["token_encrypted"],
        created_at=row["created_at"],
        expires_at=row["expires_at"],
    )


async def delete_session(db: aiosqlite.Connection, session_id: str):
    """Delete a session."""
    await db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    await db.commit()


async def delete_all_sessions(db: aiosqlite.Connection):
    """Delete all sessions (logout)."""
    await db.execute("DELETE FROM sessions")
    await db.commit()


# ─── Environments ─────────────────────────────────────────────────────────────


async def save_environment(db: aiosqlite.Connection, env: Environment):
    """Save or update an environment."""
    now = int(time.time())
    await db.execute(
        """INSERT OR REPLACE INTO environments
           (id, project_id, name, env_key_encrypted, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (env.id, env.project_id, env.name, env.env_key_encrypted, env.created_at, now),
    )
    await db.commit()


async def list_environments(
    db: aiosqlite.Connection, project_id: Optional[str] = None
) -> list[Environment]:
    """List all environments, optionally filtered by project."""
    if project_id:
        cursor = await db.execute(
            "SELECT * FROM environments WHERE project_id = ? ORDER BY name",
            (project_id,),
        )
    else:
        cursor = await db.execute("SELECT * FROM environments ORDER BY name")

    rows = await cursor.fetchall()
    return [
        Environment(
            id=r["id"],
            project_id=r["project_id"],
            name=r["name"],
            env_key_encrypted=r["env_key_encrypted"],
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        )
        for r in rows
    ]


async def get_environment(
    db: aiosqlite.Connection, env_id: str
) -> Optional[Environment]:
    """Get an environment by ID."""
    cursor = await db.execute("SELECT * FROM environments WHERE id = ?", (env_id,))
    row = await cursor.fetchone()
    if not row:
        return None
    return Environment(
        id=row["id"],
        project_id=row["project_id"],
        name=row["name"],
        env_key_encrypted=row["env_key_encrypted"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


async def get_environment_by_name(
    db: aiosqlite.Connection, name: str, project_id: Optional[str] = None
) -> Optional[Environment]:
    """Get an environment by name, optionally filtered by project."""
    if project_id:
        cursor = await db.execute(
            "SELECT * FROM environments WHERE name = ? AND project_id = ?",
            (name, project_id),
        )
    else:
        cursor = await db.execute(
            "SELECT * FROM environments WHERE name = ?", (name,)
        )
    row = await cursor.fetchone()
    if not row:
        return None
    return Environment(
        id=row["id"],
        project_id=row["project_id"],
        name=row["name"],
        env_key_encrypted=row["env_key_encrypted"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


# ─── Secrets ──────────────────────────────────────────────────────────────────


async def save_secret(db: aiosqlite.Connection, secret: Secret):
    """Save or update a secret."""
    now = int(time.time())
    await db.execute(
        """INSERT OR REPLACE INTO secrets
           (id, environment_id, key_id, iv, ciphertext, auth_tag,
            version, checksum, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            secret.id,
            secret.environment_id,
            secret.key_id,
            secret.iv,
            secret.ciphertext,
            secret.auth_tag,
            secret.version,
            secret.checksum,
            secret.created_at,
            now,
        ),
    )
    await db.commit()


async def list_secrets(
    db: aiosqlite.Connection, environment_id: str
) -> list[Secret]:
    """List all secrets in an environment."""
    cursor = await db.execute(
        "SELECT * FROM secrets WHERE environment_id = ? ORDER BY key_id",
        (environment_id,),
    )
    rows = await cursor.fetchall()
    return [
        Secret(
            id=r["id"],
            environment_id=r["environment_id"],
            key_id=r["key_id"],
            iv=r["iv"],
            ciphertext=r["ciphertext"],
            auth_tag=r["auth_tag"],
            version=r["version"],
            checksum=r["checksum"],
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        )
        for r in rows
    ]


async def get_secret(
    db: aiosqlite.Connection, environment_id: str, key_id: str
) -> Optional[Secret]:
    """Get a specific secret by environment and key name."""
    cursor = await db.execute(
        "SELECT * FROM secrets WHERE environment_id = ? AND key_id = ?",
        (environment_id, key_id),
    )
    row = await cursor.fetchone()
    if not row:
        return None
    return Secret(
        id=row["id"],
        environment_id=row["environment_id"],
        key_id=row["key_id"],
        iv=row["iv"],
        ciphertext=row["ciphertext"],
        auth_tag=row["auth_tag"],
        version=row["version"],
        checksum=row["checksum"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


async def delete_secret(db: aiosqlite.Connection, secret_id: str):
    """Delete a secret by ID."""
    await db.execute("DELETE FROM secrets WHERE id = ?", (secret_id,))
    await db.commit()


async def delete_secret_by_key(
    db: aiosqlite.Connection, environment_id: str, key_id: str
) -> bool:
    """Delete a secret by environment and key name. Returns True if found."""
    cursor = await db.execute(
        "DELETE FROM secrets WHERE environment_id = ? AND key_id = ?",
        (environment_id, key_id),
    )
    await db.commit()
    return cursor.rowcount > 0


# ─── CI Sessions ──────────────────────────────────────────────────────────────


async def save_ci_session(db: aiosqlite.Connection, session: CISession):
    """Save or replace a CI session."""
    await db.execute(
        """INSERT OR REPLACE INTO ci_sessions
           (id, project_id, project_name, session_token_encrypted, scopes,
            environment_scope, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            session.id,
            session.project_id,
            session.project_name,
            session.session_token_encrypted,
            json.dumps(session.scopes),
            session.environment_scope,
            session.created_at,
            session.expires_at,
        ),
    )
    await db.commit()


async def get_active_ci_session(db: aiosqlite.Connection) -> Optional[CISession]:
    """Get the most recent non-expired CI session."""
    import json
    
    now = int(time.time())
    cursor = await db.execute(
        """SELECT * FROM ci_sessions
           WHERE expires_at > ?
           ORDER BY created_at DESC
           LIMIT 1""",
        (now,),
    )
    row = await cursor.fetchone()
    if not row:
        return None
    return CISession(
        id=row["id"],
        project_id=row["project_id"],
        project_name=row["project_name"],
        session_token_encrypted=row["session_token_encrypted"],
        scopes=json.loads(row["scopes"]),
        environment_scope=row["environment_scope"],
        created_at=row["created_at"],
        expires_at=row["expires_at"],
    )


async def delete_ci_session(db: aiosqlite.Connection, session_id: str):
    """Delete a CI session."""
    await db.execute("DELETE FROM ci_sessions WHERE id = ?", (session_id,))
    await db.commit()


async def delete_all_ci_sessions(db: aiosqlite.Connection):
    """Delete all CI sessions."""
    await db.execute("DELETE FROM ci_sessions")
    await db.commit()
