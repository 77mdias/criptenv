"""Regression tests for CI session persistence (audit P1, 2026-10).

`save_ci_session` used `json.dumps` without a module-level `import json`,
raising NameError at runtime whenever a CI session was saved — the bug was
missed because no test covered this path.
"""

import time

import pytest

from criptenv.vault import queries
from criptenv.vault.models import CISession


def _make_ci_session(**overrides) -> CISession:
    defaults = {
        "id": "ci_sess_001",
        "project_id": "prj_001",
        "project_name": "my-project",
        "session_token_encrypted": b"encrypted-ci-token",
        "scopes": ["secrets:read", "secrets:write"],
        "environment_scope": "production",
        "created_at": int(time.time()),
        "expires_at": int(time.time()) + 86400,
    }
    defaults.update(overrides)
    return CISession(**defaults)


class TestCISessionQueries:
    @pytest.mark.asyncio
    async def test_save_ci_session_does_not_raise(self, mock_config_dir):
        """Regression: save_ci_session must not fail with NameError."""
        from criptenv.vault.database import get_db, init_schema, close_db

        db = await get_db()
        await init_schema(db)
        try:
            await queries.save_ci_session(db, _make_ci_session())
        finally:
            await close_db(db)

    @pytest.mark.asyncio
    async def test_save_then_get_active_ci_session_roundtrip(self, mock_config_dir):
        from criptenv.vault.database import get_db, init_schema, close_db

        db = await get_db()
        await init_schema(db)
        try:
            session = _make_ci_session()
            await queries.save_ci_session(db, session)

            loaded = await queries.get_active_ci_session(db)
            assert loaded is not None
            assert loaded.id == session.id
            assert loaded.project_id == session.project_id
            assert loaded.scopes == session.scopes
            assert loaded.environment_scope == session.environment_scope
            assert loaded.session_token_encrypted == session.session_token_encrypted
        finally:
            await close_db(db)

    @pytest.mark.asyncio
    async def test_get_active_ci_session_skips_expired(self, mock_config_dir):
        from criptenv.vault.database import get_db, init_schema, close_db

        db = await get_db()
        await init_schema(db)
        try:
            expired = _make_ci_session(
                id="ci_old",
                created_at=int(time.time()) - 7200,
                expires_at=int(time.time()) - 3600,
            )
            await queries.save_ci_session(db, expired)

            assert await queries.get_active_ci_session(db) is None
        finally:
            await close_db(db)
