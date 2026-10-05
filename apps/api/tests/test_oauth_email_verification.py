"""Regression tests for the OAuth email-verification account-takeover fix (P0-1).

Auto-linking an OAuth identity to an existing user by email is only allowed
when the provider verified the user's control of that email address.
See docs/audits/2026-10-auditoria-completa.md (P0-1).
"""
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.services.oauth_service import OAuthService, OAuthUserInfo


def make_user(email="victim@example.com"):
    return SimpleNamespace(
        id=uuid4(),
        email=email,
        name="Victim",
        two_factor_enabled=False,
        email_verified=True,
    )


class FakeResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class FakeDB:
    """Minimal async session stub: returns queued query results."""

    def __init__(self, results):
        self.results = list(results)
        self.added = []

    async def execute(self, *_args, **_kwargs):
        return FakeResult(self.results.pop(0) if self.results else None)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        return None

    async def refresh(self, _obj):
        return None

    async def delete(self, _obj):
        return None


class FakeProvider:
    def __init__(self, user_info: OAuthUserInfo):
        self.user_info = user_info

    async def exchange_code(self, code: str) -> dict:
        return {"access_token": "at", "expires_in": 3600}

    async def get_user_info(self, access_token: str) -> OAuthUserInfo:
        return self.user_info


def make_service(db, user_info):
    service = OAuthService(db)
    service._providers["github:http://test/api/auth/oauth/github/callback"] = FakeProvider(user_info)
    return service


@pytest.mark.asyncio
async def test_link_rejected_when_provider_email_unverified():
    """OAuth identity with an unverified email must NOT link to the existing
    account owning that address (prevents account takeover)."""
    victim = make_user()
    db = FakeDB([None, victim])  # no oauth account; existing user found
    service = make_service(db, OAuthUserInfo(
        id="attacker-provider-id",
        email="victim@example.com",
        name="Attacker",
        avatar_url=None,
        email_verified=False,
    ))

    with pytest.raises(ValueError, match="verified email"):
        await service.authenticate_with_oauth(
            "github", "code", base_url="http://test"
        )
    # No OAuthAccount may have been linked/created
    assert db.added == []


@pytest.mark.asyncio
async def test_link_allowed_when_provider_email_verified():
    victim = make_user()
    db = FakeDB([None, victim])
    service = make_service(db, OAuthUserInfo(
        id="legit-provider-id",
        email="victim@example.com",
        name="Victim",
        avatar_url=None,
        email_verified=True,
    ))

    user, session = await service.authenticate_with_oauth(
        "github", "code", base_url="http://test"
    )
    assert user is victim
    assert session is not None  # 2FA disabled -> session issued
    assert any(type(o).__name__ == "OAuthAccount" for o in db.added)


@pytest.mark.asyncio
async def test_new_user_email_verified_reflects_provider():
    """New accounts must mirror the provider's verification status instead of
    blindly marking email_verified=True."""
    db = FakeDB([None, None])  # no oauth account; no existing user
    service = make_service(db, OAuthUserInfo(
        id="provider-id",
        email="someone@example.com",
        name="Someone",
        avatar_url=None,
        email_verified=False,
    ))

    user, _session = await service.authenticate_with_oauth(
        "github", "code", base_url="http://test"
    )
    assert user.email == "someone@example.com"
    assert user.email_verified is False


@pytest.mark.asyncio
async def test_new_user_verified_email_still_works():
    db = FakeDB([None, None])
    service = make_service(db, OAuthUserInfo(
        id="provider-id",
        email="someone@example.com",
        name="Someone",
        avatar_url=None,
        email_verified=True,
    ))

    user, _session = await service.authenticate_with_oauth(
        "github", "code", base_url="http://test"
    )
    assert user.email_verified is True
