"""Encryption helpers for external integration configuration.

Provider tokens are operational secrets owned by the API, so they are encrypted
at rest with a server-side key separate from the auth signing secret.
"""

from __future__ import annotations

import base64
import json
import os
from typing import Any

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


class IntegrationConfigEncryptionError(ValueError):
    """Raised when integration config encryption or decryption fails."""


class IntegrationConfigEncryption:
    """AES-256-GCM envelope encryption for integration config JSON."""

    ENVELOPE_MARKER = "_criptenv_encrypted"
    VERSION = 1
    ALGORITHM = "AES-256-GCM"
    KDF = "HKDF-SHA256"
    INFO = b"criptenv-integration-config-v1"
    SALT = b"criptenv-integration-config-salt-v1"
    MIN_SECRET_LENGTH = 32

    @classmethod
    def encrypt(cls, config: dict[str, Any], secret: str) -> dict[str, Any]:
        """Encrypt a provider config dict into a JSONB-safe envelope."""
        cls._validate_secret(secret)
        key = cls._derive_key(secret)
        nonce = os.urandom(12)
        plaintext = json.dumps(
            config,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        ciphertext = AESGCM(key).encrypt(nonce, plaintext, cls.INFO)

        return {
            cls.ENVELOPE_MARKER: True,
            "version": cls.VERSION,
            "algorithm": cls.ALGORITHM,
            "kdf": cls.KDF,
            "nonce": cls._b64encode(nonce),
            "ciphertext": cls._b64encode(ciphertext),
        }

    @classmethod
    def decrypt(cls, data: dict[str, Any], secret: str) -> dict[str, Any]:
        """Decrypt an encrypted config envelope."""
        cls._validate_secret(secret)
        if not cls.is_encrypted(data):
            raise IntegrationConfigEncryptionError("Integration config is not encrypted")

        if data.get("version") != cls.VERSION or data.get("algorithm") != cls.ALGORITHM:
            raise IntegrationConfigEncryptionError("Unsupported integration config envelope")

        try:
            nonce = cls._b64decode(str(data["nonce"]))
            ciphertext = cls._b64decode(str(data["ciphertext"]))
            plaintext = AESGCM(cls._derive_key(secret)).decrypt(
                nonce,
                ciphertext,
                cls.INFO,
            )
            decoded = json.loads(plaintext.decode("utf-8"))
        except (InvalidTag, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise IntegrationConfigEncryptionError(
                "Unable to decrypt integration config"
            ) from exc

        if not isinstance(decoded, dict):
            raise IntegrationConfigEncryptionError("Integration config payload is invalid")
        return decoded

    @classmethod
    def decrypt_legacy_or_encrypted(
        cls,
        data: dict[str, Any],
        secret: str,
    ) -> dict[str, Any]:
        """Return plaintext config from either legacy JSONB or encrypted envelope."""
        if cls.is_encrypted(data):
            return cls.decrypt(data, secret)
        if isinstance(data, dict):
            return dict(data)
        raise IntegrationConfigEncryptionError("Integration config payload is invalid")

    @classmethod
    def is_encrypted(cls, data: Any) -> bool:
        """Return whether a JSONB value is an encrypted integration envelope."""
        return isinstance(data, dict) and data.get(cls.ENVELOPE_MARKER) is True

    @classmethod
    def _derive_key(cls, secret: str) -> bytes:
        return HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=cls.SALT,
            info=cls.INFO,
        ).derive(secret.encode("utf-8"))

    @classmethod
    def _validate_secret(cls, secret: str) -> None:
        if not secret or len(secret) < cls.MIN_SECRET_LENGTH:
            raise IntegrationConfigEncryptionError(
                "INTEGRATION_CONFIG_SECRET must be configured with at least 32 characters"
            )

    @staticmethod
    def _b64encode(value: bytes) -> str:
        return base64.b64encode(value).decode("ascii")

    @staticmethod
    def _b64decode(value: str) -> bytes:
        return base64.b64decode(value.encode("ascii"))
