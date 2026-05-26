"""Tests for remote project vault interoperability."""

import hashlib

import pytest

from criptenv.crypto import derive_project_env_key
from criptenv.crypto.core import encrypt
from criptenv.crypto.utils import to_base64
from criptenv.remote_vault import RemoteVault


def _web_checksum(key_id: str, iv: str, ciphertext: str, auth_tag: str) -> str:
    """Checksum format produced by the web dashboard."""
    return hashlib.sha256(
        f"{key_id}:{iv}:{ciphertext}:{auth_tag}".encode("utf-8")
    ).hexdigest()


def _encrypted_blob(client, key_id: str, plaintext: bytes, checksum: str | None = None) -> dict:
    env_key = derive_project_env_key(
        client.vault_password,
        client.vault_config,
        client.environment_id,
    )
    ciphertext, iv, auth_tag, plaintext_checksum = encrypt(plaintext, env_key)
    blob = {
        "key_id": key_id,
        "iv": to_base64(iv),
        "ciphertext": to_base64(ciphertext),
        "auth_tag": to_base64(auth_tag),
        "version": 1,
        "checksum": checksum or plaintext_checksum,
    }
    return blob


@pytest.mark.asyncio
async def test_decrypts_web_checksum_blob(remote_vault_client):
    blob = _encrypted_blob(remote_vault_client, "API_KEY", b"secret123")
    blob["checksum"] = _web_checksum(
        blob["key_id"],
        blob["iv"],
        blob["ciphertext"],
        blob["auth_tag"],
    )

    vault = RemoteVault(remote_vault_client, remote_vault_client.project_id)

    assert await vault.decrypt_blob(blob, remote_vault_client.environment_id) == b"secret123"


@pytest.mark.asyncio
async def test_encrypt_blob_uses_web_checksum(remote_vault_client):
    vault = RemoteVault(remote_vault_client, remote_vault_client.project_id)

    blob = await vault.encrypt_blob("API_KEY", b"secret123", remote_vault_client.environment_id, 1)

    assert blob["checksum"] == _web_checksum(
        blob["key_id"],
        blob["iv"],
        blob["ciphertext"],
        blob["auth_tag"],
    )


@pytest.mark.asyncio
async def test_decrypts_legacy_plaintext_checksum_blob(remote_vault_client):
    blob = _encrypted_blob(remote_vault_client, "API_KEY", b"secret123")
    vault = RemoteVault(remote_vault_client, remote_vault_client.project_id)

    assert await vault.decrypt_blob(blob, remote_vault_client.environment_id) == b"secret123"
