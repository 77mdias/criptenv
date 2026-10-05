"""Regression tests for 2FA challenge lockout and atomic rate limiting (Sprint 2).

- A 2FA challenge is consumed after MAX_2FA_CHALLENGE_ATTEMPTS wrong codes,
  closing the 10-minute distributed brute-force window (audit P2 #11).
- `check_and_increment` performs a single atomic increment, so concurrent
  requests can never all read the same count and slip past the limit
  (audit P2 #10).
"""

import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.services.auth_service import AuthService


class FakeResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class FakeDB:
    def __init__(self, results):
        self.results = list(results)
        self.flushed = 0

    async def execute(self, *_a, **_k):
        return FakeResult(self.results.pop(0) if self.results else None)

    def add(self, obj):
        pass

    async def flush(self):
        self.flushed += 1

    async def refresh(self, _obj):
        return None


def _challenge(failed_attempts=0):
    return SimpleNamespace(
        user_id=uuid4(),
        token_hash="hash",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        consumed_at=None,
        failed_attempts=failed_attempts,
    )


def _user_with_2fa():
    return SimpleNamespace(
        id=uuid4(),
        email="dev@example.com",
        two_factor_enabled=True,
        backup_codes=[],
    )


@pytest.mark.asyncio
async def test_wrong_codes_increment_attempts(monkeypatch):
    challenge = _challenge()
    db = FakeDB([challenge, _user_with_2fa()])
    service = AuthService(db)

    monkeypatch.setattr(AuthService, "_verify_totp_code", lambda self, u, c: False)
    monkeypatch.setattr(AuthService, "verify_backup_code", AsyncMock(return_value=False))

    with pytest.raises(ValueError, match="Invalid verification code"):
        await service.complete_two_factor_challenge("token", "000000", False)

    assert challenge.failed_attempts == 1
    assert challenge.consumed_at is None


@pytest.mark.asyncio
async def test_challenge_locked_out_after_max_attempts(monkeypatch):
    challenge = _challenge(failed_attempts=AuthService.MAX_2FA_CHALLENGE_ATTEMPTS)
    db = FakeDB([challenge, _user_with_2fa()])
    service = AuthService(db)

    monkeypatch.setattr(AuthService, "_verify_totp_code", lambda self, u, c: True)

    with pytest.raises(ValueError, match="Too many invalid attempts"):
        await service.complete_two_factor_challenge("token", "123456", False)

    assert challenge.consumed_at is not None


@pytest.mark.asyncio
async def test_fifth_wrong_code_consumes_challenge(monkeypatch):
    challenge = _challenge(failed_attempts=AuthService.MAX_2FA_CHALLENGE_ATTEMPTS - 1)
    db = FakeDB([challenge, _user_with_2fa()])
    service = AuthService(db)

    monkeypatch.setattr(AuthService, "_verify_totp_code", lambda self, u, c: False)
    monkeypatch.setattr(AuthService, "verify_backup_code", AsyncMock(return_value=False))

    with pytest.raises(ValueError):
        await service.complete_two_factor_challenge("token", "000000", False)

    assert challenge.failed_attempts == AuthService.MAX_2FA_CHALLENGE_ATTEMPTS
    assert challenge.consumed_at is not None


class AsyncMock:
    def __init__(self, return_value=None):
        self._return_value = return_value
        self.calls = []

    async def __call__(self, *args, **kwargs):
        self.calls.append((args, kwargs))
        return self._return_value


# ─── Atomic rate limiting ────────────────────────────────────────────────────


def _memory_storage():
    from app.middleware.rate_limit import RateLimitStorage

    storage = RateLimitStorage.__new__(RateLimitStorage)
    storage.storage_backend = "memory"
    storage._storage = {}
    return storage


@pytest.mark.asyncio
async def test_check_and_increment_enforces_limit_atomically():
    storage = _memory_storage()
    limit = 5

    results = await asyncio.gather(
        *(storage.check_and_increment("k", limit, 60) for _ in range(20))
    )

    allowed = [r for r, _ in results if r]
    assert len(allowed) == limit, "exactly `limit` requests may pass, regardless of concurrency"
    final_count = max(c for _, c in results)
    assert final_count == 20
