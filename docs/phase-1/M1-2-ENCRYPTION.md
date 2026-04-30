# M1.2: Encryption Module

**Milestone**: M1.2
**Duration**: Week 2
**Goal**: AES-256-GCM encryption working with round-trip verified
**Status**: ✅ COMPLETE (2026-04-30)

---

## Overview

Implement client-side encryption using AES-256-GCM with PBKDF2 key derivation. All secrets are encrypted before storage; the backend never sees plaintext.

---

## Algorithm

| Parameter             | Value               |
| --------------------- | ------------------- |
| **Cipher**            | AES-256-GCM         |
| **IV Size**           | 96 bits (12 bytes)  |
| **Auth Tag**          | 128 bits (16 bytes) |
| **Key Derivation**    | PBKDF2-SHA256       |
| **PBKDF2 Iterations** | 100,000             |
| **Salt Size**         | 32 bytes            |
| **Master Key Size**   | 256 bits (32 bytes) |

---

## Key Hierarchy

```
┌─────────────────────────────────────┐
│         User Password               │
└────────────────┬────────────────────┘
                 │ PBKDF2-SHA256 (100k iterations)
                 ▼
        ┌────────────────┐
        │  Master Key   │ (32 bytes)
        └───────┬────────┘
                │
                │ HKDF-SHA256(env_id)
                ▼
        ┌────────────────┐
        │ Environment Key│ (32 bytes)
        └───────┬────────┘
                │
                │ encrypt(plaintext, env_key)
                ▼
        ┌────────────────┐
        │  Ciphertext    │ (IV + CT + AuthTag)
        └────────────────┘
```

---

## File: crypto/keys.py

```python
"""Key derivation functions for CriptEnv"""

import os
import hashlib
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend


def generate_salt() -> bytes:
    """Generate a 32-byte random salt for PBKDF2"""
    return os.urandom(32)


def derive_master_key(password: str, salt: bytes, iterations: int = 100_000) -> bytes:
    """
    Derive master key from password using PBKDF2-SHA256.

    Args:
        password: User's master password (never stored)
        salt: 32-byte random salt
        iterations: PBKDF2 iterations (default: 100k)

    Returns:
        32-byte master key
    """
    kdf = PBKDF2(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=iterations,
        backend=default_backend()
    )
    return kdf.derive(password.encode("utf-8"))


def derive_env_key(master_key: bytes, env_id: str) -> bytes:
    """
    Derive environment-specific key using HKDF.

    Args:
        master_key: 32-byte master key
        env_id: Environment UUID string

    Returns:
        32-byte environment key
    """
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=env_id.encode("utf-8"),
        info=b"criptenv-vault-v1",
        backend=default_backend()
    )
    return hkdf.derive(master_key)
```

---

## File: crypto/core.py

```python
"""AES-256-GCM encryption/decryption for CriptEnv"""

import os
import hashlib
from typing import Tuple


def encrypt(plaintext: bytes, key: bytes) -> Tuple[bytes, bytes, bytes, str]:
    """
    Encrypt plaintext using AES-256-GCM.

    Args:
        plaintext: Data to encrypt
        key: 32-byte encryption key

    Returns:
        Tuple of (ciphertext, iv, auth_tag, checksum)
        - ciphertext: Encrypted data (no auth tag)
        - iv: 12-byte initialization vector
        - auth_tag: 16-byte authentication tag
        - checksum: SHA-256 of plaintext for integrity
    """
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    # Generate random IV
    iv = os.urandom(12)

    # Create AESGCM cipher
    aesgcm = AESGCM(key)

    # Encrypt (adds 16-byte auth tag automatically)
    # Using aad=None for no additional authenticated data
    ciphertext_with_tag = aesgcm.encrypt(iv, plaintext, None)

    # Split ciphertext and auth tag
    ciphertext = ciphertext_with_tag[:-16]
    auth_tag = ciphertext_with_tag[-16:]

    # Compute checksum of plaintext for integrity verification
    checksum = hashlib.sha256(plaintext).hexdigest()

    return ciphertext, iv, auth_tag, checksum


def decrypt(ciphertext: bytes, iv: bytes, auth_tag: bytes, key: bytes, expected_checksum: str = None) -> bytes:
    """
    Decrypt ciphertext using AES-256-GCM.

    Args:
        ciphertext: Encrypted data
        iv: 12-byte initialization vector
        auth_tag: 16-byte authentication tag
        key: 32-byte decryption key
        expected_checksum: Optional checksum to verify

    Returns:
        Decrypted plaintext

    Raises:
        ValueError: If auth tag invalid or checksum mismatch
    """
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    # Reconstruct full ciphertext with auth tag
    full_ct = ciphertext + auth_tag

    # Create AESGCM cipher
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


def verify_integrity(plaintext: bytes, expected_checksum: str) -> bool:
    """Verify plaintext integrity against expected checksum"""
    return hashlib.sha256(plaintext).hexdigest() == expected_checksum
```

---

## File: crypto/utils.py

```python
"""Utility functions for CriptEnv crypto module"""

import os
import base64


def generate_key_id() -> str:
    """Generate a unique key ID"""
    return f"key_{os.urandom(16).hex()}"


def generate_env_id() -> str:
    """Generate a unique environment ID"""
    return f"env_{os.urandom(16).hex()}"


def encode_bytes(data: bytes) -> str:
    """Encode bytes to base64 string for storage"""
    return base64.b64encode(data).decode("utf-8")


def decode_bytes(encoded: str) -> bytes:
    """Decode base64 string back to bytes"""
    return base64.b64decode(encoded)


def bytes_to_hex(data: bytes) -> str:
    """Convert bytes to hex string"""
    return data.hex()


def hex_to_bytes(hex_str: str) -> bytes:
    """Convert hex string to bytes"""
    return bytes.fromhex(hex_str)
```

---

## File: crypto/**init**.py

```python
"""CriptEnv crypto module"""

from criptenv.crypto.core import encrypt, decrypt, verify_integrity
from criptenv.crypto.keys import derive_master_key, derive_env_key, generate_salt
from criptenv.crypto.utils import generate_key_id, encode_bytes, decode_bytes

__all__ = [
    "encrypt",
    "decrypt",
    "verify_integrity",
    "derive_master_key",
    "derive_env_key",
    "generate_salt",
    "generate_key_id",
    "encode_bytes",
    "decode_bytes",
]
```

---

## Usage Example

```python
from criptenv.crypto import (
    generate_salt,
    derive_master_key,
    derive_env_key,
    encrypt,
    decrypt,
)

# First-time setup
salt = generate_salt()  # Store this!
master_key = derive_master_key("user_password", salt)

# Encrypt a secret for environment
env_key = derive_env_key(master_key, "env-123")
ciphertext, iv, auth_tag, checksum = encrypt(b"my-secret-value", env_key)

# Decrypt a secret
plaintext = decrypt(ciphertext, iv, auth_tag, env_key, checksum)
assert plaintext == b"my-secret-value"
```

---

## Test: test_crypto.py

```python
import pytest
from criptenv.crypto import (
    generate_salt,
    derive_master_key,
    derive_env_key,
    encrypt,
    decrypt,
    verify_integrity,
)


def test_key_derivation():
    salt = generate_salt()
    key1 = derive_master_key("password", salt)
    key2 = derive_master_key("password", salt)
    assert key1 == key2  # Same salt = same key

    key3 = derive_master_key("different", salt)
    assert key1 != key3  # Different password = different key


def test_env_key_derivation():
    master = derive_master_key("password", generate_salt())
    env1 = derive_env_key(master, "env-123")
    env2 = derive_env_key(master, "env-123")
    assert env1 == env2  # Same env ID = same key

    env3 = derive_env_key(master, "env-456")
    assert env1 != env3  # Different env = different key


def test_encrypt_decrypt_roundtrip():
    salt = generate_salt()
    master = derive_master_key("password", salt)
    env_key = derive_env_key(master, "env-123")

    plaintext = b"super-secret-value-123"
    ciphertext, iv, auth_tag, checksum = encrypt(plaintext, env_key)

    decrypted = decrypt(ciphertext, iv, auth_tag, env_key, checksum)
    assert decrypted == plaintext


def test_decrypt_with_wrong_key_fails():
    salt = generate_salt()
    master = derive_master_key("password", salt)
    env_key = derive_env_key(master, "env-123")

    wrong_key = derive_env_key(master, "env-456")

    plaintext = b"secret"
    ciphertext, iv, auth_tag, checksum = encrypt(plaintext, env_key)

    with pytest.raises(ValueError):
        decrypt(ciphertext, iv, auth_tag, wrong_key, checksum)


def test_checksum_verification():
    salt = generate_salt()
    master = derive_master_key("password", salt)
    env_key = derive_env_key(master, "env-123")

    plaintext = b"data"
    ciphertext, iv, auth_tag, checksum = encrypt(plaintext, env_key)

    # Correct checksum passes
    assert verify_integrity(plaintext, checksum)

    # Wrong checksum fails
    assert not verify_integrity(plaintext, "wrong_checksum")
```

---

## Verification

```bash
cd apps/cli
pytest tests/test_crypto.py -v

# Expected:
# test_key_derivation PASSED
# test_env_key_derivation PASSED
# test_encrypt_decrypt_roundtrip PASSED
# test_decrypt_with_wrong_key_fails PASSED
# test_checksum_verification PASSED
```

---

## Security Notes

1. **Never log plaintext secrets**
2. **Never store master password**
3. **Use 100k PBKDF2 iterations minimum** (hardware permitting)
4. **Verify auth tag on every decrypt** (prevents tampering)
5. **Unique IV per encryption** (prevents pattern analysis)

---

**Previous**: [M1-1-CLI-SCAFFOLD.md](M1-1-CLI-SCAFFOLD.md)
**Next**: [M1-3-LOCAL-VAULT.md](M1-3-LOCAL-VAULT.md)
