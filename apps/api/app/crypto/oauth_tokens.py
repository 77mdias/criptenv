"""At-rest encryption for OAuth provider tokens (access/refresh).

`oauth_accounts.access_token` / `refresh_token` used to be stored as raw
plaintext bytes — a database leak would hand out provider credentials
(audit P2 #7, 2026-10). Tokens are sealed with AES-256-GCM under the same
dedicated secret as integration configs (`INTEGRATION_CONFIG_SECRET`).

Legacy rows (raw plaintext bytes) are still readable via
`decrypt_legacy_or_encrypted` and get transparently re-encrypted on the next
successful OAuth login.
"""

import json
import logging
import os
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

from app.crypto.integration_config import IntegrationConfigEncryption

logger = logging.getLogger(__name__)

INFO = b"criptenv-oauth-provider-token-v1"


class OAuthTokenEncryption:
    ENVELOPE_MARKER = "_criptenv_encrypted"
    VERSION = 1

    @classmethod
    def _derive_key(cls, secret: str) -> bytes:
        return HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=IntegrationConfigEncryption.SALT,
            info=INFO,
        ).derive(secret.encode("utf-8"))

    @classmethod
    def encrypt(cls, token: str, secret: str) -> bytes:
        """Encrypt a provider token into a JSON envelope stored as bytes."""
        nonce = os.urandom(12)
        ciphertext = AESGCM(cls._derive_key(secret)).encrypt(nonce, token.encode("utf-8"), INFO)
        envelope = {
            cls.ENVELOPE_MARKER: True,
            "version": cls.VERSION,
            "nonce": IntegrationConfigEncryption._b64encode(nonce),
            "ciphertext": IntegrationConfigEncryption._b64encode(ciphertext),
        }
        return json.dumps(envelope, separators=(",", ":")).encode("utf-8")

    @classmethod
    def is_encrypted(cls, data: Optional[bytes]) -> bool:
        if not data:
            return False
        try:
            envelope = json.loads(data.decode("utf-8"))
            return isinstance(envelope, dict) and bool(envelope.get(cls.ENVELOPE_MARKER))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return False

    @classmethod
    def decrypt(cls, data: bytes, secret: str) -> str:
        envelope = json.loads(data.decode("utf-8"))
        if envelope.get("version") != cls.VERSION:
            raise ValueError("Unsupported oauth token envelope")
        nonce = IntegrationConfigEncryption._b64decode(str(envelope["nonce"]))
        ciphertext = IntegrationConfigEncryption._b64decode(str(envelope["ciphertext"]))
        plain = AESGCM(cls._derive_key(secret)).decrypt(nonce, ciphertext, INFO)
        return plain.decode("utf-8")

    @classmethod
    def decrypt_legacy_or_encrypted(cls, data: Optional[bytes], secret: str) -> Optional[str]:
        """Return the plaintext token from an envelope or a legacy raw row."""
        if data is None:
            return None
        if cls.is_encrypted(data):
            return cls.decrypt(data, secret)
        return data.decode("utf-8")


def encrypt_provider_token(token: Optional[str]) -> Optional[bytes]:
    """Encrypt a provider token for storage.

    Falls back to legacy plaintext storage (with a warning) when
    INTEGRATION_CONFIG_SECRET is not configured, so OAuth login keeps working
    in environments that have not set the secret yet.
    """
    from app.config import settings

    if not token:
        return None
    secret = settings.INTEGRATION_CONFIG_SECRET
    if not secret or len(secret) < IntegrationConfigEncryption.MIN_SECRET_LENGTH:
        logger.warning(
            "INTEGRATION_CONFIG_SECRET is not configured; storing OAuth provider "
            "token without at-rest encryption"
        )
        return token.encode("utf-8")
    return OAuthTokenEncryption.encrypt(token, secret)
