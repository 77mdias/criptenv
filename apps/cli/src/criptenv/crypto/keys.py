"""Key derivation functions for CriptEnv."""

import os
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

from criptenv.config import PBKDF2_ITERATIONS, SALT_LENGTH, KEY_LENGTH


def generate_salt() -> bytes:
    """Generate a random salt for PBKDF2 key derivation."""
    return os.urandom(SALT_LENGTH)


def derive_master_key(
    password: str, salt: bytes, iterations: int = PBKDF2_ITERATIONS
) -> bytes:
    """
    Derive master key from password using PBKDF2-SHA256.

    Args:
        password: User's master password (never stored)
        salt: Random salt (32 bytes recommended)
        iterations: PBKDF2 iterations (default: 100,000)

    Returns:
        32-byte master key
    """
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=KEY_LENGTH,
        salt=salt,
        iterations=iterations,
    )
    return kdf.derive(password.encode("utf-8"))


def derive_env_key(master_key: bytes, env_id: str) -> bytes:
    """
    Derive environment-specific key from master key using HKDF-SHA256.

    Each environment gets a unique key derived from the master key,
    so compromising one environment doesn't affect others.

    Args:
        master_key: 32-byte master key
        env_id: Environment identifier (UUID string)

    Returns:
        32-byte environment-specific key
    """
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=KEY_LENGTH,
        salt=env_id.encode("utf-8"),
        info=b"criptenv-vault-v1",
    )
    return hkdf.derive(master_key)
