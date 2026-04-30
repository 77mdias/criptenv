"""Tests for the encryption module."""

import pytest
import os

from criptenv.crypto.core import encrypt, decrypt
from criptenv.crypto.keys import generate_salt, derive_master_key, derive_env_key
from criptenv.crypto.utils import to_base64, from_base64, compute_checksum, generate_id


class TestKeyDerivation:
    """Tests for key derivation functions."""

    def test_generate_salt_length(self):
        """Salt should be 32 bytes."""
        salt = generate_salt()
        assert len(salt) == 32

    def test_generate_salt_unique(self):
        """Each salt should be unique."""
        salt1 = generate_salt()
        salt2 = generate_salt()
        assert salt1 != salt2

    def test_derive_master_key_deterministic(self):
        """Same password + salt should produce same key."""
        salt = generate_salt()
        key1 = derive_master_key("test-password", salt)
        key2 = derive_master_key("test-password", salt)
        assert key1 == key2

    def test_derive_master_key_length(self):
        """Master key should be 32 bytes."""
        salt = generate_salt()
        key = derive_master_key("test-password", salt)
        assert len(key) == 32

    def test_derive_master_key_different_passwords(self):
        """Different passwords should produce different keys."""
        salt = generate_salt()
        key1 = derive_master_key("password1", salt)
        key2 = derive_master_key("password2", salt)
        assert key1 != key2

    def test_derive_master_key_different_salts(self):
        """Different salts should produce different keys."""
        key1 = derive_master_key("test-password", os.urandom(32))
        key2 = derive_master_key("test-password", os.urandom(32))
        assert key1 != key2

    def test_derive_env_key_deterministic(self):
        """Same master key + env_id should produce same env key."""
        salt = generate_salt()
        master = derive_master_key("test-password", salt)
        env_key1 = derive_env_key(master, "env-123")
        env_key2 = derive_env_key(master, "env-123")
        assert env_key1 == env_key2

    def test_derive_env_key_length(self):
        """Environment key should be 32 bytes."""
        salt = generate_salt()
        master = derive_master_key("test-password", salt)
        env_key = derive_env_key(master, "env-123")
        assert len(env_key) == 32

    def test_derive_env_key_different_envs(self):
        """Different env_ids should produce different keys."""
        salt = generate_salt()
        master = derive_master_key("test-password", salt)
        key1 = derive_env_key(master, "env-staging")
        key2 = derive_env_key(master, "env-production")
        assert key1 != key2


class TestEncryptDecrypt:
    """Tests for AES-256-GCM encrypt/decrypt."""

    def _get_key(self) -> bytes:
        """Helper to derive a test key."""
        salt = generate_salt()
        return derive_master_key("test-password", salt)

    def test_round_trip(self):
        """Encrypt then decrypt should return original plaintext."""
        key = self._get_key()
        plaintext = b"Hello, CriptEnv!"

        ciphertext, iv, auth_tag, checksum = encrypt(plaintext, key)
        result = decrypt(ciphertext, iv, auth_tag, key)

        assert result == plaintext

    def test_round_trip_empty(self):
        """Should handle empty plaintext."""
        key = self._get_key()
        plaintext = b""

        ciphertext, iv, auth_tag, checksum = encrypt(plaintext, key)
        result = decrypt(ciphertext, iv, auth_tag, key)

        assert result == plaintext

    def test_round_trip_large(self):
        """Should handle large plaintext."""
        key = self._get_key()
        plaintext = os.urandom(1024 * 100)  # 100KB

        ciphertext, iv, auth_tag, checksum = encrypt(plaintext, key)
        result = decrypt(ciphertext, iv, auth_tag, key)

        assert result == plaintext

    def test_round_trip_unicode(self):
        """Should handle unicode plaintext."""
        key = self._get_key()
        plaintext = "Chave secreta: 🔐 测试".encode("utf-8")

        ciphertext, iv, auth_tag, checksum = encrypt(plaintext, key)
        result = decrypt(ciphertext, iv, auth_tag, key)

        assert result == plaintext

    def test_iv_length(self):
        """IV should be 12 bytes."""
        key = self._get_key()
        _, iv, _, _ = encrypt(b"test", key)
        assert len(iv) == 12

    def test_auth_tag_length(self):
        """Auth tag should be 16 bytes."""
        key = self._get_key()
        _, _, auth_tag, _ = encrypt(b"test", key)
        assert len(auth_tag) == 16

    def test_checksum_correct(self):
        """Checksum should be SHA-256 of plaintext."""
        key = self._get_key()
        plaintext = b"test data"
        _, _, _, checksum = encrypt(plaintext, key)

        expected = compute_checksum(plaintext)
        assert checksum == expected

    def test_iv_unique(self):
        """Each encryption should produce a unique IV."""
        key = self._get_key()
        _, iv1, _, _ = encrypt(b"test", key)
        _, iv2, _, _ = encrypt(b"test", key)
        assert iv1 != iv2

    def test_ciphertext_differs_with_different_iv(self):
        """Same plaintext encrypted twice should produce different ciphertext."""
        key = self._get_key()
        ct1, _, _, _ = encrypt(b"test", key)
        ct2, _, _, _ = encrypt(b"test", key)
        assert ct1 != ct2

    def test_decrypt_wrong_key(self):
        """Decrypting with wrong key should raise ValueError."""
        key1 = self._get_key()
        key2 = self._get_key()

        ciphertext, iv, auth_tag, _ = encrypt(b"test", key1)
        with pytest.raises(ValueError, match="Decryption failed"):
            decrypt(ciphertext, iv, auth_tag, key2)

    def test_decrypt_wrong_checksum(self):
        """Decrypting with wrong checksum should raise ValueError."""
        key = self._get_key()
        ciphertext, iv, auth_tag, _ = encrypt(b"test", key)

        with pytest.raises(ValueError, match="Checksum mismatch"):
            decrypt(ciphertext, iv, auth_tag, key, expected_checksum="wrong")

    def test_decrypt_correct_checksum(self):
        """Decrypting with correct checksum should succeed."""
        key = self._get_key()
        plaintext = b"test data"
        ciphertext, iv, auth_tag, checksum = encrypt(plaintext, key)

        result = decrypt(ciphertext, iv, auth_tag, key, expected_checksum=checksum)
        assert result == plaintext

    def test_decrypt_tampered_ciphertext(self):
        """Tampered ciphertext should fail auth tag verification."""
        key = self._get_key()
        ciphertext, iv, auth_tag, _ = encrypt(b"test", key)

        # Tamper with ciphertext
        tampered = bytearray(ciphertext)
        tampered[0] ^= 0xFF

        with pytest.raises(ValueError, match="Decryption failed"):
            decrypt(bytes(tampered), iv, auth_tag, key)


class TestEnvKeyEncryption:
    """Test encryption with environment-specific keys."""

    def test_env_key_round_trip(self):
        """Encrypt with env key, decrypt with same env key."""
        salt = generate_salt()
        master = derive_master_key("test-password", salt)
        env_key = derive_env_key(master, "env-staging")

        plaintext = b"staging secret"
        ciphertext, iv, auth_tag, checksum = encrypt(plaintext, env_key)
        result = decrypt(ciphertext, iv, auth_tag, env_key, checksum)

        assert result == plaintext

    def test_env_key_cannot_decrypt_with_different_env(self):
        """Cannot decrypt env A's data with env B's key."""
        salt = generate_salt()
        master = derive_master_key("test-password", salt)
        key_a = derive_env_key(master, "env-a")
        key_b = derive_env_key(master, "env-b")

        ciphertext, iv, auth_tag, _ = encrypt(b"secret", key_a)

        with pytest.raises(ValueError):
            decrypt(ciphertext, iv, auth_tag, key_b)


class TestUtils:
    """Tests for crypto utility functions."""

    def test_base64_round_trip(self):
        """to_base64 then from_base64 should return original."""
        data = os.urandom(64)
        assert from_base64(to_base64(data)) == data

    def test_base64_encoding(self):
        """Base64 should produce ASCII string."""
        data = b"\x00\x01\x02\xff"
        encoded = to_base64(data)
        assert isinstance(encoded, str)
        assert encoded.isascii()

    def test_compute_checksum_deterministic(self):
        """Same input should produce same checksum."""
        assert compute_checksum(b"test") == compute_checksum(b"test")

    def test_compute_checksum_different_inputs(self):
        """Different inputs should produce different checksums."""
        assert compute_checksum(b"a") != compute_checksum(b"b")

    def test_generate_id_prefix(self):
        """Generated ID should have the specified prefix."""
        id_str = generate_id("sec")
        assert id_str.startswith("sec_")

    def test_generate_id_unique(self):
        """Each generated ID should be unique."""
        ids = {generate_id() for _ in range(100)}
        assert len(ids) == 100
