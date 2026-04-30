"""Tests for CI Token Authentication"""

import pytest
import hashlib
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

import sys
from pathlib import Path
API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))


class TestCITokenHashing:
    """RED: Test CI token hashing"""

    def test_hash_token_sha256(self):
        """Token must be hashed with SHA-256"""
        from app.routers.tokens import hash_token
        
        token = "ci_test_token_123"
        expected_hash = hashlib.sha256(token.encode()).hexdigest()
        
        result = hash_token(token)
        
        assert result == expected_hash
        assert len(result) == 64  # SHA-256 produces 64 hex chars

    def test_hash_token_deterministic(self):
        """Same token must produce same hash"""
        from app.routers.tokens import hash_token
        
        token = "ci_same_token"
        
        hash1 = hash_token(token)
        hash2 = hash_token(token)
        
        assert hash1 == hash2

    def test_different_tokens_different_hashes(self):
        """Different tokens must produce different hashes"""
        from app.routers.tokens import hash_token
        
        hash1 = hash_token("ci_token_1")
        hash2 = hash_token("ci_token_2")
        
        assert hash1 != hash2


class TestCITokenValidation:
    """RED: Test CI token validation"""

    @pytest.mark.asyncio
    async def test_valid_token_returns_ci_token(self):
        """Valid CI token should return CIToken object"""
        from app.middleware.ci_auth import validate_ci_token
        
        token = f"ci_{uuid4().hex}"
        project_id = uuid4()
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        # Mock database
        mock_token = MagicMock()
        mock_token.id = uuid4()
        mock_token.project_id = project_id
        mock_token.token_hash = token_hash
        mock_token.expires_at = None
        mock_token.last_used_at = None
        
        mock_db = AsyncMock(spec=AsyncSession)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_token)
        mock_db.execute = AsyncMock(return_value=mock_result)
        
        with patch('app.middleware.ci_auth.async_session_factory') as mock_factory:
            mock_session = AsyncMock(spec=AsyncSession)
            mock_session.execute = AsyncMock(return_value=mock_result)
            mock_session.commit = AsyncMock()
            mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_factory.return_value.__aexit__ = AsyncMock()
            
            result = await validate_ci_token(token, project_id)
            
            assert result == mock_token

    @pytest.mark.asyncio
    async def test_expired_token_raises_401(self):
        """Expired CI token should raise 401"""
        from app.middleware.ci_auth import validate_ci_token
        
        token = f"ci_{uuid4().hex}"
        project_id = uuid4()
        
        # Expired token
        expired_token = MagicMock()
        expired_token.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=expired_token)
        
        with patch('app.middleware.ci_auth.async_session_factory') as mock_factory:
            mock_session = AsyncMock(spec=AsyncSession)
            mock_session.execute = AsyncMock(return_value=mock_result)
            mock_session.rollback = AsyncMock()
            mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_factory.return_value.__aexit__ = AsyncMock()
            
            with pytest.raises(HTTPException) as exc_info:
                await validate_ci_token(token, project_id)
            
            assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_format_raises_401(self):
        """Token without ci_ prefix should raise 401"""
        from app.middleware.ci_auth import validate_ci_token
        
        token = "invalid_token_no_prefix"
        project_id = uuid4()
        
        with pytest.raises(HTTPException) as exc_info:
            await validate_ci_token(token, project_id)
        
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_nonexistent_token_raises_401(self):
        """Non-existent token should raise 401"""
        from app.middleware.ci_auth import validate_ci_token
        
        token = f"ci_{uuid4().hex}"
        project_id = uuid4()
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)
        
        with patch('app.middleware.ci_auth.async_session_factory') as mock_factory:
            mock_session = AsyncMock(spec=AsyncSession)
            mock_session.execute = AsyncMock(return_value=mock_result)
            mock_session.rollback = AsyncMock()
            mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_factory.return_value.__aexit__ = AsyncMock()
            
            with pytest.raises(HTTPException) as exc_info:
                await validate_ci_token(token, project_id)
            
            assert exc_info.value.status_code == 401


class TestCISessionCreation:
    """RED: Test CI session creation"""

    def test_create_ci_session_returns_token_and_expiry(self):
        """CI session creation should return session token and expiry"""
        from app.middleware.ci_auth import create_ci_session
        
        project_id = uuid4()
        permissions = ["read:secrets"]
        
        session_token, expires_at = create_ci_session(project_id, permissions)
        
        assert session_token.startswith("ci_s_")
        assert len(session_token) > 20
        assert expires_at > datetime.now(timezone.utc)

    def test_ci_session_expires_in_1_hour(self):
        """CI session should expire in 1 hour"""
        from app.middleware.ci_auth import create_ci_session, CI_SESSION_EXPIRE_SECONDS
        
        project_id = uuid4()
        
        before = datetime.now(timezone.utc)
        _, expires_at = create_ci_session(project_id, [])
        after = datetime.now(timezone.utc)
        
        expected_delta = timedelta(seconds=CI_SESSION_EXPIRE_SECONDS)
        
        # Check that expiry is approximately 1 hour from now
        assert expires_at >= before + expected_delta - timedelta(seconds=5)
        assert expires_at <= after + expected_delta + timedelta(seconds=5)


class TestCIMiddlewareIntegration:
    """RED: Test CI middleware integration with FastAPI"""

    @pytest.mark.asyncio
    async def test_get_current_ci_user_extracts_token(self):
        """Middleware should extract CI token from request"""
        from app.middleware.ci_auth import get_current_ci_user
        
        token = f"ci_s_{uuid4().hex}"
        project_id = uuid4()
        
        mock_token = MagicMock()
        mock_token.id = uuid4()
        mock_token.project_id = project_id
        mock_token.token_hash = hashlib.sha256(token.encode()).hexdigest()
        mock_token.expires_at = None
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_token)
        
        mock_request = MagicMock()
        mock_request.headers = {"Authorization": f"Bearer {token}"}
        
        with patch('app.middleware.ci_auth.validate_ci_token', new=AsyncMock(return_value=mock_token)):
            with patch('app.middleware.ci_auth.create_ci_session', return_value=(f"s_{uuid4().hex}", datetime.now(timezone.utc) + timedelta(hours=1))):
                result = await get_current_ci_user(mock_request)
                
                assert result["token"] == mock_token
                assert "session_token" in result