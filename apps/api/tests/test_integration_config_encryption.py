"""Tests for encrypted integration provider configuration."""

import pytest


def test_encrypt_decrypt_config_roundtrip():
    from app.crypto.integration_config import IntegrationConfigEncryption

    secret = "test-integration-config-secret-32-chars"
    config = {
        "api_token": "tok_secret_123456789",
        "project_id": "prj_123",
        "service_id": "srv_456",
    }

    encrypted = IntegrationConfigEncryption.encrypt(config, secret)
    decrypted = IntegrationConfigEncryption.decrypt(encrypted, secret)

    assert decrypted == config


def test_encrypted_envelope_does_not_contain_plaintext_values():
    from app.crypto.integration_config import IntegrationConfigEncryption

    secret = "test-integration-config-secret-32-chars"
    config = {
        "api_token": "tok_secret_123456789",
        "project_id": "prj_123",
        "service_id": "srv_456",
    }

    encrypted = IntegrationConfigEncryption.encrypt(config, secret)
    serialized = str(encrypted)

    assert "tok_secret_123456789" not in serialized
    assert "prj_123" not in serialized
    assert "srv_456" not in serialized
    assert IntegrationConfigEncryption.is_encrypted(encrypted)


def test_decrypt_with_wrong_secret_fails():
    from app.crypto.integration_config import (
        IntegrationConfigEncryption,
        IntegrationConfigEncryptionError,
    )

    encrypted = IntegrationConfigEncryption.encrypt(
        {"api_token": "tok_secret_123456789"},
        "test-integration-config-secret-32-chars",
    )

    with pytest.raises(IntegrationConfigEncryptionError):
        IntegrationConfigEncryption.decrypt(
            encrypted,
            "different-integration-config-secret",
        )


def test_plaintext_config_is_detected_as_legacy():
    from app.crypto.integration_config import IntegrationConfigEncryption

    legacy = {"api_token": "tok_secret_123456789", "project_id": "prj_123"}

    assert IntegrationConfigEncryption.is_encrypted(legacy) is False
    assert IntegrationConfigEncryption.decrypt_legacy_or_encrypted(
        legacy,
        "test-integration-config-secret-32-chars",
    ) == legacy


def test_missing_secret_fails_clearly():
    from app.crypto.integration_config import (
        IntegrationConfigEncryption,
        IntegrationConfigEncryptionError,
    )

    with pytest.raises(IntegrationConfigEncryptionError, match="INTEGRATION_CONFIG_SECRET"):
        IntegrationConfigEncryption.encrypt({"api_token": "tok_secret_123456789"}, "")
