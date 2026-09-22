"""Tests for AuthService profile helpers."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.auth_service import AuthService


@pytest.mark.asyncio
async def test_update_avatar_refreshes_user_after_flush():
    """Avatar updates should refresh server-generated fields before response serialization."""
    db = SimpleNamespace(flush=AsyncMock(), refresh=AsyncMock())
    user = SimpleNamespace(avatar_url=None)
    service = AuthService(db)

    updated_user = await service.update_avatar(user, avatar_url="https://example.com/avatar.png")

    assert updated_user is user
    assert user.avatar_url == "https://example.com/avatar.png"
    db.flush.assert_awaited_once()
    db.refresh.assert_awaited_once_with(user)


@pytest.mark.asyncio
async def test_update_profile_refreshes_user_after_flush():
    """Profile updates should refresh server-generated fields before response serialization."""
    db = SimpleNamespace(flush=AsyncMock(), refresh=AsyncMock())
    user = SimpleNamespace(name="Old Name", email="dev@example.com")
    service = AuthService(db)

    updated_user = await service.update_profile(user, name="New Name")

    assert updated_user is user
    assert user.name == "New Name"
    db.flush.assert_awaited_once()
    db.refresh.assert_awaited_once_with(user)


# ─── Session token storage (CR-P2-13) ────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_session_persists_only_the_token_digest():
    """The sessions table must never hold a usable bearer token.

    It previously stored the raw token, so read access to the database was
    enough to hijack any active session. CI tokens, API keys and 2FA challenges
    were already hashed; sessions now follow the same pattern.
    """
    import hashlib
    from unittest.mock import MagicMock
    from uuid import uuid4

    added = []
    db = MagicMock()
    db.add = lambda obj: added.append(obj)
    db.flush = AsyncMock()

    service = AuthService(db)
    service.get_user_sessions = AsyncMock(return_value=[])

    session = await service.create_session(uuid4())

    assert len(added) == 1
    stored = added[0]
    raw = session.plaintext_token

    assert len(raw) >= 32
    assert stored.token == hashlib.sha256(raw.encode("utf-8")).hexdigest()
    assert raw != stored.token
    assert raw not in stored.token


@pytest.mark.asyncio
async def test_validate_session_queries_by_digest():
    """Lookups must bind the digest, never the raw token."""
    import hashlib
    from unittest.mock import AsyncMock, MagicMock
    from uuid import uuid4

    captured = {}

    async def fake_execute(query):
        captured["query"] = query
        return MagicMock()

    db = MagicMock()
    db.execute = fake_execute

    service = AuthService(db)
    service._scalar_one_or_none = AsyncMock(return_value=None)

    raw = "a" * 64
    await service.validate_session(raw)

    params = list(captured["query"].compile().params.values())
    assert hashlib.sha256(raw.encode("utf-8")).hexdigest() in params
    assert raw not in params


@pytest.mark.asyncio
async def test_invalidate_session_queries_by_digest():
    """Signout must also locate the row through the digest."""
    import hashlib
    from unittest.mock import MagicMock

    captured = {}

    async def fake_execute(query):
        captured["query"] = query
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        return result

    db = MagicMock()
    db.execute = fake_execute

    service = AuthService(db)
    raw = "b" * 64

    assert await service.invalidate_session(raw) is False
    params = list(captured["query"].compile().params.values())
    assert hashlib.sha256(raw.encode("utf-8")).hexdigest() in params
    assert raw not in params
