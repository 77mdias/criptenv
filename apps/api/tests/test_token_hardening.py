"""Regression tests for bearer-token hardening (Sprint 2, audit P1 #2 / P2 #7).

- Password reset and email verification tokens are stored as SHA-256 digests;
  the plaintext is handed to the caller once via `plaintext_token`.
- OAuth provider access/refresh tokens are sealed with AES-256-GCM under
  INTEGRATION_CONFIG_SECRET (legacy plaintext stays readable).
"""

import hashlib
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.config import settings
from app.crypto.oauth_tokens import OAuthTokenEncryption, encrypt_provider_token
from app.services.auth_service import AuthService

SECRET = "x" * 40


class FakeResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class FakeDB:
    def __init__(self, results):
        self.results = list(results)
        self.added = []

    async def execute(self, *_a, **_k):
        return FakeResult(self.results.pop(0) if self.results else None)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        return None

    async def refresh(self, _obj):
        return None


def _user(email="dev@example.com"):
    return SimpleNamespace(
        id=uuid4(),
        email=email,
        email_verified=False,
        password_hash="hash",
    )


@pytest.mark.asyncio
async def test_password_reset_stores_digest_and_exposes_plaintext_once(monkeypatch):
    user = _user()
    db = FakeDB([user, None])  # user select; invalidate update
    monkeypatch.setattr(AuthService, "hash_password", lambda self, p: "hashed")
    service = AuthService(db)

    reset = await service.create_password_reset(user.email)

    assert reset.token == hashlib.sha256(reset.plaintext_token.encode()).hexdigest()
    assert reset.token != reset.plaintext_token
    assert len(reset.token) == 64  # sha256 hex
    # Lookup uses the digest, never the plaintext
    assert db.added == [reset]


@pytest.mark.asyncio
async def test_validate_reset_token_hashes_lookup(monkeypatch):
    user = _user()
    plaintext = "super-secret-reset"
    digest = hashlib.sha256(plaintext.encode()).hexdigest()
    stored = SimpleNamespace(user_id=user.id)

    executed = []

    class DB(FakeDB):
        async def execute(self, stmt, *a, **k):
            rendered = str(stmt)
            try:
                params = stmt.compile().params
            except Exception:
                params = {}
            executed.append((rendered, params))
            return FakeResult(stored if "password_reset_tokens" in rendered else user)

    service = AuthService(DB([]))
    result = await service.validate_reset_token(plaintext)
    assert result is user
    token_stmt, token_params = executed[0]
    assert "password_reset_tokens" in token_stmt
    assert digest in token_params.values()
    assert plaintext not in token_params.values()


@pytest.fixture(autouse=True)
def _configured_secret(monkeypatch):
    monkeypatch.setattr(settings, "INTEGRATION_CONFIG_SECRET", SECRET)


def test_oauth_provider_token_encrypted_at_rest():
    stored = encrypt_provider_token("provider-access-token")
    assert stored is not None
    assert b"provider-access-token" not in stored  # no plaintext bytes
    assert OAuthTokenEncryption.is_encrypted(stored)

    decrypted = OAuthTokenEncryption.decrypt_legacy_or_encrypted(stored, "x" * 40)
    assert decrypted == "provider-access-token"


def test_oauth_provider_token_legacy_plaintext_still_readable():
    legacy = b"legacy-raw-token"
    assert OAuthTokenEncryption.decrypt_legacy_or_encrypted(legacy, "x" * 40) == "legacy-raw-token"


def test_oauth_provider_token_none_passthrough():
    assert encrypt_provider_token(None) is None


def test_oauth_token_tampering_rejected():
    stored = encrypt_provider_token("provider-access-token")
    import json as _json
    envelope = _json.loads(stored.decode("utf-8"))
    # Corrupt only the ciphertext, keeping valid JSON/b64 so decryption runs
    import base64 as _b64
    ciphertext = bytearray(_b64.b64decode(envelope["ciphertext"]))
    ciphertext[-1] ^= 0xFF
    envelope["ciphertext"] = _b64.b64encode(bytes(ciphertext)).decode("utf-8")
    tampered = _json.dumps(envelope).encode("utf-8")
    with pytest.raises(Exception):
        OAuthTokenEncryption.decrypt_legacy_or_encrypted(tampered, "x" * 40)
