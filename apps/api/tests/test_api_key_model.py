"""Test API Key Model for M3.4 Public API

HELL TDD - RED phase: These tests define the expected behavior
for API key management.
"""

import pytest
import hashlib
from uuid import uuid4
from datetime import datetime, timezone, timedelta
from pydantic import ValidationError

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture
def user_id():
    """Sample user ID."""
    return uuid4()


@pytest.fixture
def project_id():
    """Sample project ID."""
    return uuid4()


def test_api_key_prefix():
    """API key must start with 'cek_' prefix."""
    from app.models.api_key import API_KEY_PREFIX
    assert API_KEY_PREFIX == "cek_"


def test_hash_api_key():
    """Hash API key using SHA-256."""
    from app.models.api_key import hash_api_key
    
    key = "cek_live_abc123"
    expected_hash = hashlib.sha256(key.encode()).hexdigest()
    
    assert hash_api_key(key) == expected_hash


def test_hash_api_key_consistency():
    """Same key must produce same hash."""
    from app.models.api_key import hash_api_key
    
    key = "cek_live_abc123"
    assert hash_api_key(key) == hash_api_key(key)


def test_different_keys_different_hashes():
    """Different keys must produce different hashes."""
    from app.models.api_key import hash_api_key
    
    key1 = "cek_live_abc123"
    key2 = "cek_live_xyz789"
    
    assert hash_api_key(key1) != hash_api_key(key2)


def test_generate_api_key():
    """Generate a new API key with cek_ prefix."""
    from app.models.api_key import generate_api_key
    
    key = generate_api_key()
    
    assert key.startswith("cek_")
    assert len(key) > 10  # Must have random portion


def test_generate_api_key_uniqueness():
    """Generated keys must be unique."""
    from app.models.api_key import generate_api_key
    
    keys = [generate_api_key() for _ in range(100)]
    
    # All keys should be unique
    assert len(set(keys)) == 100


def test_valid_scopes():
    """Valid scopes as per M3.4 specification."""
    from app.models.api_key import VALID_API_KEY_SCOPES
    
    expected_scopes = [
        "read:secrets",
        "write:secrets",
        "delete:secrets",
        "read:audit",
        "write:integrations",
        "admin:project"
    ]
    
    for scope in expected_scopes:
        assert scope in VALID_API_KEY_SCOPES


def test_scope_validator_has_scope():
    """ScopeValidator.has_scope() must check permissions correctly."""
    from app.models.api_key import ScopeValidator
    
    validator = ScopeValidator()
    
    # Direct match
    assert validator.has_scope(["read:secrets"], "read:secrets") is True
    
    # No match
    assert validator.has_scope(["read:secrets"], "write:secrets") is False
    
    # Admin grants all
    assert validator.has_scope(["admin:project"], "write:secrets") is True
    assert validator.has_scope(["admin:project"], "delete:secrets") is True


def test_scope_validator_empty_scopes():
    """Empty scopes should deny all."""
    from app.models.api_key import ScopeValidator
    
    validator = ScopeValidator()
    
    assert validator.has_scope([], "read:secrets") is False
    assert validator.has_scope(None, "read:secrets") is False


def test_scope_validator_normalize():
    """normalize_scopes() must return default ['read:secrets'] for empty."""
    from app.models.api_key import ScopeValidator
    
    validator = ScopeValidator()
    
    # None/empty should default to read:secrets
    assert validator.normalize_scopes(None) == ["read:secrets"]
    assert validator.normalize_scopes([]) == ["read:secrets"]


def test_api_key_create_schema_validation():
    """ApiKeyCreate must validate required fields."""
    from app.schemas.api_key import ApiKeyCreate
    
    # Empty name should fail
    with pytest.raises(ValidationError):
        ApiKeyCreate(name="", scopes=["read:secrets"])
    
    # Empty scopes should fail
    with pytest.raises(ValidationError):
        ApiKeyCreate(name="CI Pipeline", scopes=[])


def test_api_key_create_schema_defaults():
    """ApiKeyCreate must have sensible defaults."""
    from app.schemas.api_key import ApiKeyCreate
    
    schema = ApiKeyCreate(name="CI Pipeline")
    
    # Default scope should be read:secrets
    assert schema.scopes == ["read:secrets"]
    
    # No expiration by default
    assert schema.expires_in_days is None


def test_api_key_create_with_expiration():
    """ApiKeyCreate must support expiration in days."""
    from app.schemas.api_key import ApiKeyCreate
    
    schema = ApiKeyCreate(name="CI Pipeline", expires_in_days=90)
    
    assert schema.expires_in_days == 90


def test_api_key_create_with_scopes():
    """ApiKeyCreate must support custom scopes."""
    from app.schemas.api_key import ApiKeyCreate
    
    schema = ApiKeyCreate(
        name="CI Pipeline",
        scopes=["read:secrets", "write:secrets"]
    )
    
    assert "read:secrets" in schema.scopes
    assert "write:secrets" in schema.scopes


def test_api_key_response_schema():
    """ApiKeyResponse must not expose key_hash or key."""
    from app.schemas.api_key import ApiKeyResponse
    
    response = ApiKeyResponse(
        id=uuid4(),
        name="CI Pipeline",
        prefix="cek_live_",
        scopes=["read:secrets"],
        last_used_at=None,
        expires_at=None,
        created_at=datetime.now(timezone.utc)
    )
    
    # Should have prefix but not the full key
    assert response.prefix == "cek_live_"
    
    # Should not have these fields
    assert not hasattr(response, "key")
    assert not hasattr(response, "key_hash")


def test_api_key_create_response():
    """ApiKeyCreateResponse must include the plaintext key ONCE."""
    from app.schemas.api_key import ApiKeyCreateResponse
    
    response = ApiKeyCreateResponse(
        id=uuid4(),
        name="CI Pipeline",
        key="cek_live_abc123xyz",  # Plaintext shown only here
        prefix="cek_live_",
        scopes=["read:secrets"],
        expires_at=datetime.now(timezone.utc) + timedelta(days=90),
        created_at=datetime.now(timezone.utc)
    )
    
    # Plaintext key is only available in create response
    assert response.key.startswith("cek_")
    
    # Response model must have key field for one-time display
    assert hasattr(response, "key")