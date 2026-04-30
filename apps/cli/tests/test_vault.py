"""Tests for the local vault (SQLite)."""

import pytest
import time
import os

from criptenv.vault.database import get_db, init_schema, close_db
from criptenv.vault.models import Session, Environment, Secret
from criptenv.vault import queries


@pytest.fixture
async def db(mock_config_dir):
    """Get a test database with initialized schema, cleaned between tests."""
    db = await get_db()
    await init_schema(db)
    # Clean before test
    await db.execute("DELETE FROM secrets")
    await db.execute("DELETE FROM environments")
    await db.execute("DELETE FROM sessions")
    await db.execute("DELETE FROM config")
    await db.commit()
    yield db
    await close_db(db)


def _make_session(**overrides) -> Session:
    """Create a test session."""
    defaults = {
        "id": "sess_001",
        "user_id": "user_001",
        "email": "test@example.com",
        "token_encrypted": b"encrypted_token_data",
        "created_at": int(time.time()),
        "expires_at": int(time.time()) + 86400,
    }
    defaults.update(overrides)
    return Session(**defaults)


def _make_environment(**overrides) -> Environment:
    """Create a test environment."""
    defaults = {
        "id": "env_001",
        "project_id": "proj_001",
        "name": "staging",
        "env_key_encrypted": b"encrypted_env_key",
        "created_at": int(time.time()),
        "updated_at": int(time.time()),
    }
    defaults.update(overrides)
    return Environment(**defaults)


def _make_secret(environment_id: str = "env_001", **overrides) -> Secret:
    """Create a test secret."""
    defaults = {
        "id": "sec_001",
        "environment_id": environment_id,
        "key_id": "API_KEY",
        "iv": os.urandom(12),
        "ciphertext": os.urandom(32),
        "auth_tag": os.urandom(16),
        "version": 1,
        "checksum": "abc123",
        "created_at": int(time.time()),
        "updated_at": int(time.time()),
    }
    defaults.update(overrides)
    return Secret(**defaults)


# ─── Config Tests ─────────────────────────────────────────────────────────────


class TestConfigQueries:
    @pytest.mark.asyncio
    async def test_set_and_get_config(self, db):
        await queries.set_config(db, "master_salt", "abc123")
        value = await queries.get_config(db, "master_salt")
        assert value == "abc123"

    @pytest.mark.asyncio
    async def test_get_config_missing(self, db):
        value = await queries.get_config(db, "nonexistent")
        assert value is None

    @pytest.mark.asyncio
    async def test_set_config_overwrite(self, db):
        await queries.set_config(db, "key", "value1")
        await queries.set_config(db, "key", "value2")
        value = await queries.get_config(db, "key")
        assert value == "value2"


# ─── Session Tests ────────────────────────────────────────────────────────────


class TestSessionQueries:
    @pytest.mark.asyncio
    async def test_save_and_get_session(self, db):
        session = _make_session()
        await queries.save_session(db, session)

        result = await queries.get_active_session(db)
        assert result is not None
        assert result.id == "sess_001"
        assert result.email == "test@example.com"

    @pytest.mark.asyncio
    async def test_get_active_session_expired(self, db):
        session = _make_session(expires_at=int(time.time()) - 100)
        await queries.save_session(db, session)

        result = await queries.get_active_session(db)
        assert result is None

    @pytest.mark.asyncio
    async def test_get_active_session_most_recent(self, db):
        old = _make_session(id="old", created_at=1000)
        new = _make_session(id="new", created_at=2000)
        await queries.save_session(db, old)
        await queries.save_session(db, new)

        result = await queries.get_active_session(db)
        assert result.id == "new"

    @pytest.mark.asyncio
    async def test_delete_session(self, db):
        session = _make_session()
        await queries.save_session(db, session)
        await queries.delete_session(db, "sess_001")

        result = await queries.get_active_session(db)
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_all_sessions(self, db):
        await queries.save_session(db, _make_session(id="s1"))
        await queries.save_session(db, _make_session(id="s2"))
        await queries.delete_all_sessions(db)

        result = await queries.get_active_session(db)
        assert result is None


# ─── Environment Tests ────────────────────────────────────────────────────────


class TestEnvironmentQueries:
    @pytest.mark.asyncio
    async def test_save_and_list(self, db):
        env = _make_environment()
        await queries.save_environment(db, env)

        envs = await queries.list_environments(db)
        assert len(envs) == 1
        assert envs[0].name == "staging"

    @pytest.mark.asyncio
    async def test_list_filter_by_project(self, db):
        await queries.save_environment(db, _make_environment(id="e1", project_id="p1"))
        await queries.save_environment(db, _make_environment(id="e2", project_id="p2", name="production"))

        envs = await queries.list_environments(db, project_id="p1")
        assert len(envs) == 1
        assert envs[0].id == "e1"

    @pytest.mark.asyncio
    async def test_get_environment(self, db):
        await queries.save_environment(db, _make_environment())
        result = await queries.get_environment(db, "env_001")
        assert result is not None
        assert result.name == "staging"

    @pytest.mark.asyncio
    async def test_get_environment_missing(self, db):
        result = await queries.get_environment(db, "nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_environment_by_name(self, db):
        await queries.save_environment(db, _make_environment())
        result = await queries.get_environment_by_name(db, "staging")
        assert result is not None
        assert result.id == "env_001"

    @pytest.mark.asyncio
    async def test_get_environment_by_name_and_project(self, db):
        await queries.save_environment(db, _make_environment(id="e1", project_id="p1"))
        await queries.save_environment(db, _make_environment(id="e2", project_id="p2"))

        result = await queries.get_environment_by_name(db, "staging", project_id="p1")
        assert result is not None
        assert result.id == "e1"


# ─── Secret Tests ─────────────────────────────────────────────────────────────


class TestSecretQueries:
    @pytest.mark.asyncio
    async def _setup_env(self, db):
        """Helper to create a parent environment."""
        await queries.save_environment(db, _make_environment())

    @pytest.mark.asyncio
    async def test_save_and_list(self, db):
        await self._setup_env(db)
        secret = _make_secret()
        await queries.save_secret(db, secret)

        secrets = await queries.list_secrets(db, "env_001")
        assert len(secrets) == 1
        assert secrets[0].key_id == "API_KEY"

    @pytest.mark.asyncio
    async def test_list_multiple(self, db):
        await self._setup_env(db)
        await queries.save_secret(db, _make_secret(id="s1", key_id="KEY_A"))
        await queries.save_secret(db, _make_secret(id="s2", key_id="KEY_B"))

        secrets = await queries.list_secrets(db, "env_001")
        assert len(secrets) == 2
        key_ids = [s.key_id for s in secrets]
        assert "KEY_A" in key_ids
        assert "KEY_B" in key_ids

    @pytest.mark.asyncio
    async def test_get_secret(self, db):
        await self._setup_env(db)
        await queries.save_secret(db, _make_secret())

        result = await queries.get_secret(db, "env_001", "API_KEY")
        assert result is not None
        assert result.key_id == "API_KEY"

    @pytest.mark.asyncio
    async def test_get_secret_missing(self, db):
        await self._setup_env(db)
        result = await queries.get_secret(db, "env_001", "NONEXISTENT")
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_secret(self, db):
        await self._setup_env(db)
        await queries.save_secret(db, _make_secret())
        await queries.delete_secret(db, "sec_001")

        secrets = await queries.list_secrets(db, "env_001")
        assert len(secrets) == 0

    @pytest.mark.asyncio
    async def test_delete_secret_by_key(self, db):
        await self._setup_env(db)
        await queries.save_secret(db, _make_secret())

        deleted = await queries.delete_secret_by_key(db, "env_001", "API_KEY")
        assert deleted is True

        secrets = await queries.list_secrets(db, "env_001")
        assert len(secrets) == 0

    @pytest.mark.asyncio
    async def test_delete_secret_by_key_not_found(self, db):
        await self._setup_env(db)
        deleted = await queries.delete_secret_by_key(db, "env_001", "NONEXISTENT")
        assert deleted is False

    @pytest.mark.asyncio
    async def test_save_secret_updates(self, db):
        """Saving with same ID should update (upsert)."""
        await self._setup_env(db)
        await queries.save_secret(db, _make_secret(version=1))
        await queries.save_secret(db, _make_secret(version=2))

        secrets = await queries.list_secrets(db, "env_001")
        assert len(secrets) == 1
        assert secrets[0].version == 2
