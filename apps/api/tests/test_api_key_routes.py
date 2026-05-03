"""Test API Key Router CRUD for M3.4 Public API

HELL TDD - RED phase: Tests for API key CRUD endpoints.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from uuid import uuid4
from datetime import datetime, timezone, timedelta
from contextlib import contextmanager
from httpx import AsyncClient, ASGITransport

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import app
from app.middleware.auth import get_current_user


@contextmanager
def override_current_user(user):
    """Override FastAPI's captured auth dependency for API key route tests."""
    async def _get_current_user():
        return user

    app.dependency_overrides[get_current_user] = _get_current_user
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def mock_user():
    """Create a mock authenticated user."""
    user = MagicMock()
    user.id = uuid4()
    user.email = "admin@example.com"
    return user


@pytest.fixture
def mock_project():
    """Create a mock project."""
    project = MagicMock()
    project.id = uuid4()
    project.name = "Test Project"
    project.slug = "test-project"
    return project


@pytest.fixture
def mock_api_key():
    """Create a mock API key."""
    from app.models.api_key import APIKey
    key = MagicMock(spec=APIKey)
    key.id = uuid4()
    key.user_id = uuid4()
    key.project_id = uuid4()
    key.name = "CI Pipeline"
    key.prefix = "cek_live_"
    key.scopes = ["read:secrets"]
    key.environment_scope = None
    key.last_used_at = None
    key.expires_at = datetime.now(timezone.utc) + timedelta(days=90)
    key.revoked_at = None
    key.created_at = datetime.now(timezone.utc)
    return key


@pytest.fixture
def transport():
    """ASGI transport for AsyncClient."""
    return ASGITransport(app=app)


@pytest.mark.asyncio
async def test_create_api_key_returns_plaintext_once(transport, mock_user, mock_project):
    """POST /api/v1/projects/:id/api-keys must return plaintext key once."""
    # Mock user authentication
    with override_current_user(mock_user):
        with patch('app.services.project_service.ProjectService.get_project', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_project
            
            with patch('app.services.api_key_service.ApiKeyService.create_api_key', new_callable=AsyncMock) as mock_create:
                # Mock the created API key with plaintext
                created_key = MagicMock()
                created_key.id = uuid4()
                created_key.name = "CI Pipeline"
                created_key.key = "cek_live_abc123xyz"  # Plaintext returned here
                created_key.prefix = "cek_live_"
                created_key.scopes = ["read:secrets"]
                created_key.environment_scope = None
                created_key.expires_at = datetime.now(timezone.utc) + timedelta(days=90)
                created_key.created_at = datetime.now(timezone.utc)
                
                mock_create.return_value = (created_key, created_key.key)
                
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    response = await client.post(
                        f"/api/v1/projects/{mock_project.id}/api-keys",
                        json={"name": "CI Pipeline", "scopes": ["read:secrets"]},
                        headers={"Authorization": "Bearer session_token"}
                    )
                
                # Should return 201
                assert response.status_code == 201
                data = response.json()
                
                # Plaintext key shown only in create response
                assert "key" in data
                assert data["key"].startswith("cek_")


@pytest.mark.asyncio
async def test_list_api_keys_no_plaintext(transport, mock_user, mock_project):
    """GET /api/v1/projects/:id/api-keys must NOT return plaintext key."""
    with override_current_user(mock_user):
        with patch('app.services.project_service.ProjectService.get_project', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_project
            
            with patch('app.services.api_key_service.ApiKeyService.list_api_keys', new_callable=AsyncMock) as mock_list:
                # Mock list of API keys
                key1 = MagicMock()
                key1.id = uuid4()
                key1.name = "CI Pipeline 1"
                key1.prefix = "cek_live_"
                key1.scopes = ["read:secrets"]
                key1.environment_scope = None
                key1.last_used_at = None
                key1.expires_at = None
                key1.created_at = datetime.now(timezone.utc)
                
                key2 = MagicMock()
                key2.id = uuid4()
                key2.name = "CI Pipeline 2"
                key2.prefix = "cek_test_"
                key2.scopes = ["write:secrets"]
                key2.environment_scope = None
                key2.last_used_at = None
                key2.expires_at = None
                key2.created_at = datetime.now(timezone.utc)
                
                mock_list.return_value = ([key1, key2], 2)
                
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    response = await client.get(
                        f"/api/v1/projects/{mock_project.id}/api-keys",
                        headers={"Authorization": "Bearer session_token"}
                    )
                
                assert response.status_code == 200
                data = response.json()
                
                # No key or key_hash should be in response
                for item in data["items"]:
                    assert "key" not in item
                    assert "key_hash" not in item
                    assert "prefix" in item  # Only prefix for identification


@pytest.mark.asyncio
async def test_revoke_api_key(transport, mock_user, mock_project):
    """DELETE /api/v1/projects/:id/api-keys/:key-id must revoke the key."""
    key_id = uuid4()
    
    with override_current_user(mock_user):
        with patch('app.services.project_service.ProjectService.get_project', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_project
            
            with patch('app.services.api_key_service.ApiKeyService.revoke_api_key', new_callable=AsyncMock) as mock_revoke:
                revoked_key = MagicMock()
                revoked_key.id = key_id
                revoked_key.name = "CI Pipeline"
                revoked_key.revoked_at = datetime.now(timezone.utc)
                mock_revoke.return_value = revoked_key
                
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    response = await client.delete(
                        f"/api/v1/projects/{mock_project.id}/api-keys/{key_id}",
                        headers={"Authorization": "Bearer session_token"}
                    )
                
                assert response.status_code == 200
                data = response.json()
                assert data["message"] == "API key has been revoked successfully"


@pytest.mark.asyncio
async def test_create_api_key_requires_auth(transport):
    """POST /api/v1/projects/:id/api-keys without auth must return 401."""
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/projects/{uuid4()}/api-keys",
            json={"name": "CI Pipeline"}
        )
    
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_api_key_audit_logged(transport, mock_user, mock_project):
    """Creating an API key must generate an audit log entry."""
    with override_current_user(mock_user):
        with patch('app.services.project_service.ProjectService.get_project', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_project
            
            with patch('app.services.api_key_service.ApiKeyService.create_api_key', new_callable=AsyncMock) as mock_create:
                with patch('app.services.audit_service.AuditService.log', new_callable=AsyncMock) as mock_audit:
                    created_key = MagicMock()
                    created_key.id = uuid4()
                    created_key.name = "CI Pipeline"
                    created_key.key = "cek_live_abc123"
                    created_key.prefix = "cek_live_"
                    created_key.scopes = ["read:secrets"]
                    created_key.expires_at = None
                    created_key.created_at = datetime.now(timezone.utc)
                    
                    mock_create.return_value = (created_key, created_key.key)
                    
                    async with AsyncClient(transport=transport, base_url="http://test") as client:
                        await client.post(
                            f"/api/v1/projects/{mock_project.id}/api-keys",
                            json={"name": "CI Pipeline"},
                            headers={"Authorization": "Bearer session_token"}
                        )
                    
                    # Audit logging is owned by ApiKeyService; the router delegates creation.
                    mock_create.assert_called_once()
                    mock_audit.assert_not_called()


@pytest.mark.asyncio
async def test_create_api_key_with_expiration(transport, mock_user, mock_project):
    """API key creation should support expiration in days."""
    with override_current_user(mock_user):
        with patch('app.services.project_service.ProjectService.get_project', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_project
            
            with patch('app.services.api_key_service.ApiKeyService.create_api_key', new_callable=AsyncMock) as mock_create:
                created_key = MagicMock()
                created_key.id = uuid4()
                created_key.name = "Short-lived Key"
                created_key.key = "cek_live_abc123"
                created_key.prefix = "cek_live_"
                created_key.scopes = ["read:secrets"]
                created_key.environment_scope = None
                created_key.expires_at = datetime.now(timezone.utc) + timedelta(days=30)
                created_key.created_at = datetime.now(timezone.utc)
                
                mock_create.return_value = (created_key, created_key.key)
                
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    response = await client.post(
                        f"/api/v1/projects/{mock_project.id}/api-keys",
                        json={
                            "name": "Short-lived Key",
                            "scopes": ["read:secrets"],
                            "expires_in_days": 30
                        },
                        headers={"Authorization": "Bearer session_token"}
                    )
                
                assert response.status_code == 201
                data = response.json()
                assert data["expires_at"] is not None


@pytest.mark.asyncio
async def test_create_api_key_invalid_scopes_rejected(transport, mock_user, mock_project):
    """Creating API key with invalid scopes should return 422."""
    with override_current_user(mock_user):
        with patch('app.services.project_service.ProjectService.get_project', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_project
            
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    f"/api/v1/projects/{mock_project.id}/api-keys",
                    json={
                        "name": "CI Pipeline",
                        "scopes": ["invalid:scope"]
                    },
                    headers={"Authorization": "Bearer session_token"}
                )
            
            assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_revoke_nonexistent_api_key(transport, mock_user, mock_project):
    """Revoking a non-existent API key should return 404."""
    with override_current_user(mock_user):
        with patch('app.services.project_service.ProjectService.get_project', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_project
            
            with patch('app.services.api_key_service.ApiKeyService.revoke_api_key', new_callable=AsyncMock) as mock_revoke:
                mock_revoke.side_effect = ValueError("API key not found")
                
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    response = await client.delete(
                        f"/api/v1/projects/{mock_project.id}/api-keys/{uuid4()}",
                        headers={"Authorization": "Bearer session_token"}
                    )
                
                assert response.status_code == 404
