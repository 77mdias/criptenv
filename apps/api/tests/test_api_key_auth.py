"""Test API Key Auth Middleware for M3.4 Public API

HELL TDD - RED phase: Tests for API key authentication middleware.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch, PropertyMock
from uuid import uuid4
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture
def mock_api_key():
    """Create a mock valid API key."""
    from app.models.api_key import APIKey
    key = MagicMock(spec=APIKey)
    key.id = uuid4()
    key.user_id = uuid4()
    key.project_id = uuid4()
    key.key_hash = "hash123"
    key.prefix = "cek_live_"
    key.scopes = ["read:secrets", "write:secrets"]
    key.last_used_at = None
    key.is_valid.return_value = True
    key.is_expired.return_value = False
    key.is_revoked.return_value = False
    return key


@pytest.fixture
def mock_user():
    """Create a mock user."""
    from app.models.user import User
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.email = "test@example.com"
    return user


def test_api_key_prefix_check():
    """API key must start with 'cek_' to be recognized."""
    from app.middleware.api_key_auth import is_api_key_format
    
    # Valid API keys
    assert is_api_key_format("cek_live_abc123") is True
    assert is_api_key_format("cek_test_xyz789") is True
    assert is_api_key_format("cek_dev_debug") is True
    
    # Invalid formats
    assert is_api_key_format("ci_token_abc") is False  # CI token format
    assert is_api_key_format("Bearer abc123") is False  # Bearer token
    assert is_api_key_format("") is False
    assert is_api_key_format("sek_live_abc") is False  # Wrong prefix


def test_extract_api_key_from_header():
    """Extract API key from Authorization header."""
    from app.middleware.api_key_auth import extract_api_key_from_auth
    
    # Valid Bearer with API key
    header = "Bearer cek_live_abc123xyz"
    key = extract_api_key_from_auth(header)
    assert key == "cek_live_abc123xyz"
    
    # CI token format (should return None, let CI auth handle it)
    header = "Bearer ci_token_abc"
    key = extract_api_key_from_auth(header)
    assert key is None
    
    # No Bearer prefix
    header = "cek_live_abc123"
    key = extract_api_key_from_auth(header)
    assert key is None
    
    # Empty header
    key = extract_api_key_from_auth(None)
    assert key is None


def test_expired_api_key_raises_401():
    """Expired API key should raise HTTPException 401."""
    from app.middleware.api_key_auth import ExpiredApiKeyError
    
    error = ExpiredApiKeyError()
    
    assert isinstance(error, HTTPException)
    assert error.status_code == 401
    assert "expired" in error.detail.lower()


def test_revoked_api_key_raises_401():
    """Revoked API key should raise HTTPException 401."""
    from app.middleware.api_key_auth import RevokedApiKeyError
    
    error = RevokedApiKeyError()
    
    assert isinstance(error, HTTPException)
    assert error.status_code == 401
    assert "revoked" in error.detail.lower()


def test_invalid_api_key_raises_401():
    """Invalid API key should raise HTTPException 401."""
    from app.middleware.api_key_auth import InvalidApiKeyError
    
    error = InvalidApiKeyError()
    
    assert isinstance(error, HTTPException)
    assert error.status_code == 401
    assert "invalid" in error.detail.lower()


@pytest.mark.asyncio
async def test_validate_api_key_finds_valid_key(mock_api_key, mock_user):
    """Valid API key should return associated user."""
    from app.middleware.api_key_auth import validate_api_key
    
    mock_api_key.user = mock_user
    mock_api_key.is_valid.return_value = True
    mock_api_key.is_expired.return_value = False
    mock_api_key.is_revoked.return_value = False
    
    # Mock the async context manager for session
    mock_session = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()
    mock_session.close = AsyncMock()
    
    # Mock the context manager __aenter__ and __aexit__
    mock_cm = AsyncMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
    mock_cm.__aexit__ = AsyncMock(return_value=None)
    
    with patch('app.middleware.api_key_auth.async_session_factory', return_value=mock_cm):
        with patch('app.middleware.api_key_auth.get_db_api_key', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_api_key
            
            result = await validate_api_key("cek_live_abc123")
            
            assert result == mock_user


@pytest.mark.asyncio
async def test_validate_api_key_updates_last_used(mock_api_key, mock_user):
    """Validating API key should update last_used_at."""
    from app.middleware.api_key_auth import validate_api_key
    
    mock_api_key.user = mock_user
    mock_api_key.is_valid.return_value = True
    mock_api_key.is_expired.return_value = False
    mock_api_key.is_revoked.return_value = False
    mock_api_key.last_used_at = None
    
    mock_session = AsyncMock()
    mock_session.commit = AsyncMock()
    
    mock_cm = AsyncMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
    mock_cm.__aexit__ = AsyncMock(return_value=None)
    
    with patch('app.middleware.api_key_auth.async_session_factory', return_value=mock_cm):
        with patch('app.middleware.api_key_auth.get_db_api_key', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_api_key
            
            await validate_api_key("cek_live_abc123")
            
            # Verify last_used_at was updated
            assert mock_api_key.last_used_at is not None


@pytest.mark.asyncio
async def test_validate_expired_key_raises(mock_api_key):
    """Expired API key should raise ExpiredApiKeyError."""
    from app.middleware.api_key_auth import validate_api_key, ExpiredApiKeyError
    
    mock_api_key.is_valid.return_value = False
    mock_api_key.is_expired.return_value = True
    mock_api_key.is_revoked.return_value = False
    
    mock_session = AsyncMock()
    mock_session.commit = AsyncMock()
    
    mock_cm = AsyncMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
    mock_cm.__aexit__ = AsyncMock(return_value=None)
    
    with patch('app.middleware.api_key_auth.async_session_factory', return_value=mock_cm):
        with patch('app.middleware.api_key_auth.get_db_api_key', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_api_key
            
            with pytest.raises(ExpiredApiKeyError):
                await validate_api_key("cek_live_expired")


@pytest.mark.asyncio
async def test_validate_revoked_key_raises(mock_api_key):
    """Revoked API key should raise RevokedApiKeyError."""
    from app.middleware.api_key_auth import validate_api_key, RevokedApiKeyError
    
    mock_api_key.is_valid.return_value = False
    mock_api_key.is_expired.return_value = False
    mock_api_key.is_revoked.return_value = True
    
    mock_session = AsyncMock()
    mock_session.commit = AsyncMock()
    
    mock_cm = AsyncMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
    mock_cm.__aexit__ = AsyncMock(return_value=None)
    
    with patch('app.middleware.api_key_auth.async_session_factory', return_value=mock_cm):
        with patch('app.middleware.api_key_auth.get_db_api_key', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_api_key
            
            with pytest.raises(RevokedApiKeyError):
                await validate_api_key("cek_live_revoked")


@pytest.mark.asyncio
async def test_validate_nonexistent_key_raises():
    """Non-existent API key should raise InvalidApiKeyError."""
    from app.middleware.api_key_auth import validate_api_key, InvalidApiKeyError
    
    mock_session = AsyncMock()
    mock_session.commit = AsyncMock()
    
    mock_cm = AsyncMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
    mock_cm.__aexit__ = AsyncMock(return_value=None)
    
    with patch('app.middleware.api_key_auth.async_session_factory', return_value=mock_cm):
        with patch('app.middleware.api_key_auth.get_db_api_key', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None  # Key not found
            
            with pytest.raises(InvalidApiKeyError):
                await validate_api_key("cek_live_nonexistent")


def test_scope_check_with_admin():
    """admin:project scope grants all permissions."""
    from app.middleware.api_key_auth import check_api_key_scope
    
    # Admin scope can do anything
    assert check_api_key_scope(["admin:project"], "read:secrets") is True
    assert check_api_key_scope(["admin:project"], "write:secrets") is True
    assert check_api_key_scope(["admin:project"], "delete:secrets") is True
    assert check_api_key_scope(["admin:project"], "admin:project") is True


def test_scope_check_specific():
    """Specific scope only grants that permission."""
    from app.middleware.api_key_auth import check_api_key_scope
    
    assert check_api_key_scope(["read:secrets"], "read:secrets") is True
    assert check_api_key_scope(["read:secrets"], "write:secrets") is False
    assert check_api_key_scope(["write:secrets"], "read:secrets") is False


def test_scope_check_empty_scopes():
    """Empty scopes deny everything."""
    from app.middleware.api_key_auth import check_api_key_scope
    
    assert check_api_key_scope([], "read:secrets") is False
    assert check_api_key_scope(None, "read:secrets") is False


def test_scope_check_multiple_scopes():
    """Multiple scopes grant all listed permissions."""
    from app.middleware.api_key_auth import check_api_key_scope
    
    scopes = ["read:secrets", "write:secrets", "read:audit"]
    assert check_api_key_scope(scopes, "read:secrets") is True
    assert check_api_key_scope(scopes, "write:secrets") is True
    assert check_api_key_scope(scopes, "delete:secrets") is False


def test_get_request_api_key_identifier():
    """Extract identifier for rate limiting from request."""
    from app.middleware.api_key_auth import get_request_api_key_id
    
    # Create mock request with API key
    request = MagicMock()
    request.headers = {"Authorization": "Bearer cek_live_abc123xyz"}
    
    identifier = get_request_api_key_id(request)
    
    # Should return the key prefix for rate limiting
    assert identifier.startswith("cek_live_")


def test_get_request_api_key_identifier_no_key():
    """When no API key, return None (uses IP instead)."""
    from app.middleware.api_key_auth import get_request_api_key_id
    
    request = MagicMock()
    request.headers = {"Authorization": "Bearer ci_token_abc"}
    
    identifier = get_request_api_key_id(request)
    
    # CI tokens go to CI auth, not API key auth
    assert identifier is None