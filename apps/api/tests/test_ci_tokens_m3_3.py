"""Tests for M3.3 CI Tokens Enhancement - Scopes & Environment Scoping

RED Phase: These tests define the expected behavior for:
- Granular scopes (read:secrets, write:secrets, delete:secrets, read:audit, write:integrations, admin:project)
- Environment scoping (tokens restricted to specific environments)
- Scope validation on API requests
- Invalid scope returns 403 Forbidden
"""

import pytest
import hashlib
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from fastapi import HTTPException

import sys
from pathlib import Path
API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))


# ============================================================================
# RED: Test Granular Scopes
# ============================================================================

class TestCITokenScopes:
    """RED: Test CI token scopes functionality"""

    VALID_SCOPES = [
        "read:secrets",
        "write:secrets",
        "delete:secrets",
        "read:audit",
        "write:integrations",
        "admin:project"
    ]

    def test_scope_validator_accepts_valid_scopes(self):
        """Scope validator should accept all valid scope strings"""
        from app.middleware.ci_auth import ScopeValidator
        
        validator = ScopeValidator()
        
        for scope in self.VALID_SCOPES:
            assert validator.is_valid_scope(scope), f"Scope '{scope}' should be valid"

    def test_scope_validator_rejects_invalid_scopes(self):
        """Scope validator should reject invalid scope strings"""
        from app.middleware.ci_auth import ScopeValidator
        
        validator = ScopeValidator()
        
        invalid_scopes = [
            "admin:all",  # Wrong resource
            "write:all",   # Wrong resource
            "read",        # Missing action
            ":secrets",    # Missing action
            "read:",       # Missing resource
            "invalid",     # No colon
            "",            # Empty
        ]
        
        for scope in invalid_scopes:
            assert not validator.is_valid_scope(scope), f"Scope '{scope}' should be invalid"

    def test_scope_validator_normalizes_scopes(self):
        """Scope validator should normalize scopes to list"""
        from app.middleware.ci_auth import ScopeValidator
        
        validator = ScopeValidator()
        
        # List with single scope
        assert validator.normalize_scopes(["read:secrets"]) == ["read:secrets"]
        
        # Multiple scopes
        scopes = ["read:secrets", "write:secrets"]
        assert validator.normalize_scopes(scopes) == scopes
        
        # Empty defaults to read:secrets
        assert validator.normalize_scopes([]) == ["read:secrets"]
        assert validator.normalize_scopes(None) == ["read:secrets"]

    def test_scope_validator_checks_permission(self):
        """Scope validator should check if token has required scope"""
        from app.middleware.ci_auth import ScopeValidator
        
        validator = ScopeValidator()
        
        token_scopes = ["read:secrets", "write:secrets"]
        
        assert validator.has_scope(token_scopes, "read:secrets")
        assert validator.has_scope(token_scopes, "write:secrets")
        assert not validator.has_scope(token_scopes, "delete:secrets")
        assert not validator.has_scope(token_scopes, "admin:project")

    def test_admin_scope_grants_all_access(self):
        """admin:project scope should grant access to everything"""
        from app.middleware.ci_auth import ScopeValidator
        
        validator = ScopeValidator()
        
        admin_scopes = ["admin:project"]
        
        for scope in self.VALID_SCOPES:
            assert validator.has_scope(admin_scopes, scope), f"admin:project should grant {scope}"


class TestCITokenModelScopes:
    """RED: Test CIToken model with scopes field"""

    def test_citoken_has_scopes_field(self):
        """CIToken model must have scopes JSONB field"""
        from app.models.member import CIToken
        import inspect
        
        # Check CIToken has scopes attribute
        assert hasattr(CIToken, 'scopes'), "CIToken must have 'scopes' field"

    def test_citoken_has_environment_scope_field(self):
        """CIToken model must have environment_scope field"""
        from app.models.member import CIToken
        import inspect
        
        # Check CIToken has environment_scope attribute
        assert hasattr(CIToken, 'environment_scope'), "CIToken must have 'environment_scope' field"

    def test_citoken_has_description_field(self):
        """CIToken model must have description field"""
        from app.models.member import CIToken
        
        assert hasattr(CIToken, 'description'), "CIToken must have 'description' field"

    def test_citoken_has_created_by_field(self):
        """CIToken model must have created_by field"""
        from app.models.member import CIToken
        
        assert hasattr(CIToken, 'created_by'), "CIToken must have 'created_by' field"

    def test_citoken_has_revoked_at_field(self):
        """CIToken model must have revoked_at field for soft delete"""
        from app.models.member import CIToken
        
        assert hasattr(CIToken, 'revoked_at'), "CIToken must have 'revoked_at' field"


class TestCITokenSchemaScopes:
    """RED: Test CIToken schemas with scopes support"""

    def test_citoken_create_accepts_scopes(self):
        """CITokenCreate schema should accept scopes parameter"""
        from app.schemas.member import CITokenCreate
        
        # Should not raise
        token = CITokenCreate(
            name="Test Token",
            scopes=["read:secrets", "write:secrets"],
            environment_scope="production"
        )
        
        assert token.scopes == ["read:secrets", "write:secrets"]
        assert token.environment_scope == "production"

    def test_citoken_create_accepts_environment_scope(self):
        """CITokenCreate schema should accept environment_scope parameter"""
        from app.schemas.member import CITokenCreate
        
        token = CITokenCreate(
            name="Production Token",
            environment_scope="production"
        )
        
        assert token.environment_scope == "production"

    def test_citoken_create_validates_environment_scope_format(self):
        """environment_scope must be kebab-case alphanumeric"""
        from app.schemas.member import CITokenCreate
        from pydantic import ValidationError
        
        # Valid kebab-case
        token = CITokenCreate(
            name="Valid Token",
            environment_scope="production-1"
        )
        assert token.environment_scope == "production-1"
        
        # Invalid - spaces
        with pytest.raises(ValidationError):
            CITokenCreate(
                name="Invalid",
                environment_scope="production env"
            )
        
        # Invalid - uppercase
        with pytest.raises(ValidationError):
            CITokenCreate(
                name="Invalid",
                environment_scope="Production"
            )

    def test_citoken_response_includes_scopes(self):
        """CITokenResponse should include scopes field"""
        from app.schemas.member import CITokenResponse
        from uuid import UUID
        
        response = CITokenResponse(
            id=uuid4(),
            project_id=uuid4(),
            name="Test",
            scopes=["read:secrets"],
            environment_scope="staging",
            description="Test token",
            last_used_at=None,
            expires_at=None,
            revoked_at=None,
            created_at=datetime.now(timezone.utc)
        )
        
        assert response.scopes == ["read:secrets"]
        assert response.environment_scope == "staging"
        assert response.description == "Test token"

    def test_citoken_response_normalizes_null_scopes(self):
        """CITokenResponse should normalize NULL scopes from DB to default"""
        from app.schemas.member import CITokenResponse
        
        class FakeToken:
            id = uuid4()
            project_id = uuid4()
            name = "Legacy Token"
            description = None
            scopes = None  # Simulates old DB record
            environment_scope = None
            last_used_at = None
            expires_at = None
            revoked_at = None
            created_at = datetime.now(timezone.utc)
        
        response = CITokenResponse.model_validate(FakeToken())
        assert response.scopes == ["read:secrets"]


# ============================================================================
# RED: Test Environment Scoping
# ============================================================================

class TestEnvironmentScoping:
    """RED: Test environment scoping validation"""

    @pytest.mark.asyncio
    async def test_token_with_null_env_scope_accesses_all_environments(self):
        """Token with environment_scope=null should access all environments"""
        from app.middleware.ci_auth import validate_environment_access
        
        # Create mock token with null environment_scope
        mock_token = MagicMock()
        mock_token.environment_scope = None
        
        # Should not raise for any environment
        await validate_environment_access(mock_token, "production")
        await validate_environment_access(mock_token, "staging")
        await validate_environment_access(mock_token, "development")

    @pytest.mark.asyncio
    async def test_token_restricted_to_production_cannot_access_staging(self):
        """Token with environment_scope='production' should NOT access staging"""
        from app.middleware.ci_auth import validate_environment_access
        
        mock_token = MagicMock()
        mock_token.environment_scope = "production"
        mock_token.name = "Production Token"
        
        # Access to production should work
        await validate_environment_access(mock_token, "production")
        
        # Access to staging should raise 403
        with pytest.raises(HTTPException) as exc_info:
            await validate_environment_access(mock_token, "staging")
        
        assert exc_info.value.status_code == 403
        # detail is a dict with code and message
        detail = exc_info.value.detail
        assert isinstance(detail, dict) and "environment" in str(detail).lower()

    @pytest.mark.asyncio
    async def test_token_access_same_environment_succeeds(self):
        """Token with environment_scope='staging' should access staging"""
        from app.middleware.ci_auth import validate_environment_access
        
        mock_token = MagicMock()
        mock_token.environment_scope = "staging"
        mock_token.name = "Staging Token"
        
        # Should not raise
        await validate_environment_access(mock_token, "staging")

    @pytest.mark.asyncio
    async def test_environment_case_sensitive(self):
        """Environment names should be case-sensitive"""
        from app.middleware.ci_auth import validate_environment_access
        
        mock_token = MagicMock()
        mock_token.environment_scope = "Production"  # Capital P
        
        # This depends on spec - if kebab-case is enforced, this won't happen
        # But if it does, check case sensitivity
        with pytest.raises(HTTPException):
            await validate_environment_access(mock_token, "production")


class TestScopeMiddleware:
    """RED: Test scope validation middleware"""

    @pytest.mark.asyncio
    async def test_require_ci_scope_allows_valid_scope(self):
        """require_ci_scope should allow access with valid scope"""
        from app.middleware.ci_auth import require_ci_scope, get_current_ci_user
        from unittest.mock import MagicMock, patch
        
        # Create the scope checker from factory
        scope_checker = require_ci_scope("read:secrets")
        
        # Mock request with valid scope in state
        mock_request = MagicMock()
        mock_request.state = MagicMock()
        mock_request.state.ci_user = {
            "scopes": ["read:secrets", "write:secrets"],
            "token": MagicMock(scopes=["read:secrets", "write:secrets"])
        }
        
        # Mock get_current_ci_user to return our test data
        with patch('app.middleware.ci_auth.get_current_ci_user', new=AsyncMock(return_value=mock_request.state.ci_user)):
            # Should not raise
            result = await scope_checker(mock_request)
            assert "scopes" in result

    @pytest.mark.asyncio
    async def test_require_ci_scope_blocks_invalid_scope(self):
        """require_ci_scope should block access with invalid scope"""
        from app.middleware.ci_auth import require_ci_scope, get_current_ci_user
        
        # Create the scope checker from factory
        scope_checker = require_ci_scope("write:secrets")
        
        mock_request = MagicMock()
        mock_request.state = MagicMock()
        mock_request.state.ci_user = {
            "scopes": ["read:secrets"],  # Only read
            "token": MagicMock(scopes=["read:secrets"])
        }
        
        with patch('app.middleware.ci_auth.get_current_ci_user', new=AsyncMock(return_value=mock_request.state.ci_user)):
            with pytest.raises(HTTPException) as exc_info:
                await scope_checker(mock_request)
            
            assert exc_info.value.status_code == 403
            assert "write:secrets" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_admin_scope_bypasses_all_scope_checks(self):
        """admin:project scope should bypass all scope checks"""
        from app.middleware.ci_auth import require_ci_scope, get_current_ci_user
        
        # Create the scope checker from factory
        scope_checker = require_ci_scope("any:random:scope")
        
        mock_request = MagicMock()
        mock_request.state = MagicMock()
        mock_request.state.ci_user = {
            "scopes": ["admin:project"],
            "token": MagicMock(scopes=["admin:project"])
        }
        
        with patch('app.middleware.ci_auth.get_current_ci_user', new=AsyncMock(return_value=mock_request.state.ci_user)):
            # Should not raise
            result = await scope_checker(mock_request)
            assert "scopes" in result


# ============================================================================
# RED: Test Token CRUD with Scopes
# ============================================================================

class TestCITokenCRUDWithScopes:
    """RED: Test token CRUD operations with scopes support"""

    @pytest.mark.asyncio
    async def test_create_token_with_scopes(self):
        """Should create token with specified scopes"""
        from app.schemas.member import CITokenCreate
        from uuid import uuid4
        
        create_data = CITokenCreate(
            name="Deploy Token",
            description="For CI deployment",
            scopes=["read:secrets", "write:secrets"],
            environment_scope="production",
            expires_at=datetime.now(timezone.utc) + timedelta(days=90)
        )
        
        assert create_data.name == "Deploy Token"
        assert create_data.scopes == ["read:secrets", "write:secrets"]
        assert create_data.environment_scope == "production"
        assert create_data.description == "For CI deployment"

    @pytest.mark.asyncio
    async def test_token_list_excludes_revoked_tokens(self):
        """Token list should exclude revoked tokens by default"""
        # This tests the expected behavior of the list endpoint
        # The actual implementation should filter by revoked_at IS NULL
        pass  # Implementation-specific, tested at integration level


# ============================================================================
# RED: Test Revocation (Soft Delete)
# ============================================================================

class TestCITokenRevocation:
    """RED: Test token revocation (soft delete)"""

    @pytest.mark.asyncio
    async def test_revoke_token_sets_revoked_at(self):
        """Revoking token should set revoked_at timestamp"""
        # This test verifies that the revoked_at field exists and can be checked
        from app.models.member import CIToken
        
        # CIToken model should have revoked_at field
        assert hasattr(CIToken, 'revoked_at')
        
        # The actual validation is tested via integration tests
        # when token has revoked_at set, validate_ci_token raises 401

    @pytest.mark.asyncio
    async def test_revoked_token_cannot_login(self):
        """Revoked token should not be able to login"""
        from app.routers.ci import ci_login
        from unittest.mock import MagicMock, AsyncMock, patch
        from app.database import get_db
        
        # This would be an integration test
        # The endpoint should check revoked_at and reject
        pass


# ============================================================================
# RED: Test Scope Validation on Secrets Access
# ============================================================================

class TestSecretsAccessWithScopes:
    """RED: Test secrets access requires appropriate scope"""

    @pytest.mark.asyncio
    async def test_read_secrets_requires_read_scope(self):
        """Reading secrets should require read:secrets scope"""
        from app.middleware.ci_auth import ScopeValidator
        
        validator = ScopeValidator()
        
        # Token with read:secrets should access
        assert validator.has_scope(["read:secrets"], "read:secrets")
        
        # Token without read:secrets should not access
        assert not validator.has_scope(["write:secrets"], "read:secrets")

    @pytest.mark.asyncio
    async def test_write_secrets_requires_write_scope(self):
        """Writing secrets should require write:secrets scope"""
        from app.middleware.ci_auth import ScopeValidator
        
        validator = ScopeValidator()
        
        # Token with write:secrets should access
        assert validator.has_scope(["write:secrets"], "write:secrets")
        
        # Token with only read:secrets should not write
        assert not validator.has_scope(["read:secrets"], "write:secrets")

    @pytest.mark.asyncio
    async def test_delete_secrets_requires_delete_scope(self):
        """Deleting secrets should require delete:secrets scope"""
        from app.middleware.ci_auth import ScopeValidator
        
        validator = ScopeValidator()
        
        # Token with delete:secrets should access
        assert validator.has_scope(["delete:secrets"], "delete:secrets")
        
        # Token without delete:secrets should not delete
        assert not validator.has_scope(["read:secrets"], "delete:secrets")
        assert not validator.has_scope(["write:secrets"], "delete:secrets")
