"""AES-256-GCM encryption/decryption for CriptEnv."""

import os
import hashlib
from typing import Tuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from criptenv.config import IV_LENGTH, AUTH_TAG_LENGTH


def encrypt(plaintext: bytes, key: bytes) -> Tuple[bytes, bytes, bytes, str]:
    """
    Encrypt plaintext using AES-256-GCM.

    Args:
        plaintext: Data to encrypt
        key: 32-byte encryption key

    Returns:
        Tuple of (ciphertext, iv, auth_tag, checksum)
        - ciphertext: Encrypted data (without auth tag)
        - iv: 12-byte initialization vector
        - auth_tag: 16-byte authentication tag
        - checksum: SHA-256 hex digest of plaintext for integrity verification
    """
    iv = os.urandom(IV_LENGTH)

    aesgcm = AESGCM(key)
    # AESGCM.encrypt returns ciphertext + auth_tag concatenated
    ciphertext_with_tag = aesgcm.encrypt(iv, plaintext, None)

    # Split: everything except last 16 bytes is ciphertext
    ciphertext = ciphertext_with_tag[:-AUTH_TAG_LENGTH]
    auth_tag = ciphertext_with_tag[-AUTH_TAG_LENGTH:]

    # Compute checksum of plaintext for integrity verification
    checksum = hashlib.sha256(plaintext).hexdigest()

    return ciphertext, iv, auth_tag, checksum


def decrypt(
    ciphertext: bytes,
    iv: bytes,
    auth_tag: bytes,
    key: bytes,
    expected_checksum: str | None = None,
) -> bytes:
    """
    Decrypt ciphertext using AES-256-GCM.

    Args:
        ciphertext: Encrypted data (without auth tag)
        iv: 12-byte initialization vector
        auth_tag: 16-byte authentication tag
        key: 32-byte decryption key
        expected_checksum: Optional SHA-256 checksum to verify

    Returns:
        Decrypted plaintext

    Raises:
        ValueError: If auth tag invalid or checksum mismatch
    """
    # Reconstruct full ciphertext with auth tag
    full_ct = ciphertext + auth_tag

    aesgcm = AESGCM(key)

    try:
        plaintext = aesgcm.decrypt(iv, full_ct, None)
    except Exception as e:
        raise ValueError(f"Decryption failed: {e}")

    # Verify checksum if provided
    if expected_checksum:
        actual = hashlib.sha256(plaintext).hexdigest()
        if actual != expected_checksum:
            raise ValueError("Checksum mismatch - data may be corrupted")

    return plaintext
