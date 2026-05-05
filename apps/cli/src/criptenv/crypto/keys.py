"""Key derivation functions for CriptEnv."""

import os
from typing import Any

from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

from criptenv.config import PBKDF2_ITERATIONS, SALT_LENGTH, KEY_LENGTH
from criptenv.crypto.core import encrypt, decrypt
from criptenv.crypto.utils import from_base64, to_base64


VAULT_VERIFIER_PLAINTEXT = b"criptenv-vault-verifier-v1"


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


def derive_vault_proof(
    password: str,
    proof_salt_base64: str,
    iterations: int = PBKDF2_ITERATIONS,
) -> str:
    """Derive a non-decryption proof for API authorization."""
    proof = derive_master_key(password, from_base64(proof_salt_base64), iterations)
    return to_base64(proof)


def build_project_vault_config(
    password: str,
    iterations: int = PBKDF2_ITERATIONS,
) -> tuple[dict[str, Any], str]:
    """Create public project vault config plus API proof for a password."""
    project_salt = generate_salt()
    proof_salt = generate_salt()
    project_master_key = derive_master_key(password, project_salt, iterations)
    ciphertext, iv, auth_tag, _ = encrypt(VAULT_VERIFIER_PLAINTEXT, project_master_key)

    config = {
        "version": 1,
        "kdf": "PBKDF2-SHA256",
        "iterations": iterations,
        "salt": to_base64(project_salt),
        "proof_salt": to_base64(proof_salt),
        "verifier_iv": to_base64(iv),
        "verifier_ciphertext": to_base64(ciphertext),
        "verifier_auth_tag": to_base64(auth_tag),
    }
    return config, derive_vault_proof(password, config["proof_salt"], iterations)


def verify_project_vault_password(password: str, vault_config: dict[str, Any]) -> bool:
    """Validate a project vault password locally without server round-trip."""
    try:
        project_master_key = derive_master_key(
            password,
            from_base64(vault_config["salt"]),
            int(vault_config.get("iterations", PBKDF2_ITERATIONS)),
        )
        plaintext = decrypt(
            from_base64(vault_config["verifier_ciphertext"]),
            from_base64(vault_config["verifier_iv"]),
            from_base64(vault_config["verifier_auth_tag"]),
            project_master_key,
        )
    except Exception:
        return False

    return plaintext == VAULT_VERIFIER_PLAINTEXT


def derive_project_env_key(password: str, vault_config: dict[str, Any], env_id: str) -> bytes:
    """Derive the environment key for a project vault password."""
    project_master_key = derive_master_key(
        password,
        from_base64(vault_config["salt"]),
        int(vault_config.get("iterations", PBKDF2_ITERATIONS)),
    )
    return derive_env_key(project_master_key, env_id)
