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
