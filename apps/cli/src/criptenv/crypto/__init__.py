"""CriptEnv encryption module - AES-256-GCM with PBKDF2/HKDF key derivation."""

from criptenv.crypto.core import encrypt, decrypt
from criptenv.crypto.keys import (
    build_project_vault_config,
    derive_env_key,
    derive_master_key,
    derive_project_env_key,
    derive_vault_proof,
    generate_salt,
    verify_project_vault_password,
)
from criptenv.crypto.utils import to_base64, from_base64, compute_checksum

__all__ = [
    "encrypt",
    "decrypt",
    "generate_salt",
    "derive_master_key",
    "derive_env_key",
    "derive_vault_proof",
    "derive_project_env_key",
    "build_project_vault_config",
    "verify_project_vault_password",
    "to_base64",
    "from_base64",
    "compute_checksum",
]
