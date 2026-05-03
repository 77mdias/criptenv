"""Test Dual Authentication (Session + API Key) for M3.4 Public API

Tests that read endpoints accept both session tokens (JWT) and API keys (cek_ prefix).
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
from app.middleware.auth import get_current_user, get_current_user_or_api_key


@contextmanager
def override_dual_auth(user):
    """Override dual auth dependency to return mock user."""
    async def _get_dual_auth():
        return user

    app.dependency_overrides[get_current_user_or_api_key] = _get_dual_auth
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_current_user_or_api_key, None)


@pytest.fixture
def mock_user():
    """Create a mock authenticated user."""
    user = MagicMock()
    user.id = uuid4()
    user.email = "api-user@example.com"
    user.name = "API User"
    return user


@pytest.fixture
def mock_project():
    """Create a mock project."""
    project = MagicMock()
    project.id = uuid4()
    project.name = "API Test Project"
    project.slug = "api-test-project"
    project.owner_id = uuid4()
    project.description = "Test project for API"
    project.encryption_key_id = "key-123"
    project.settings = {}
    project.archived = False
    project.created_at = datetime.now(timezone.utc)
    project.updated_at = datetime.now(timezone.utc)
    return project


@pytest.fixture
def mock_environment(mock_project):
    """Create a mock environment."""
    env = MagicMock()
    env.id = uuid4()
    env.project_id = mock_project.id
    env.name = "production"
    env.display_name = "Production"
    env.is_default = True
    env.secrets_version = 1
    env.archived = False
    env.archived_at = None
    env.created_at = datetime.now(timezone.utc)
    env.updated_at = datetime.now(timezone.utc)
    return env


@pytest.fixture
def transport():
    """ASGI transport for AsyncClient."""
    return ASGITransport(app=app)


@pytest.mark.asyncio
async def test_vault_pull_with_api_key(transport, mock_user, mock_project, mock_environment):
    """GET /api/v1/projects/:id/environments/:env/vault/pull must accept API key."""
    with override_dual_auth(mock_user):
        with patch('app.services.project_service.ProjectService.check_user_access', new_callable=AsyncMock) as mock_access:
            mock_access.return_value = MagicMock(role="developer")
            
            with patch('app.services.vault_service.VaultService.pull_blobs', new_callable=AsyncMock) as mock_pull:
                mock_pull.return_value = ([], 1)
                
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    response = await client.get(
                        f"/api/v1/projects/{mock_project.id}/environments/{mock_environment.id}/vault/pull",
                        headers={"Authorization": "Bearer cek_live_testkey123"}
                    )
                
                assert response.status_code == 200
                data = response.json()
                assert "blobs" in data
                assert "version" in data
                # Rate limit headers should be present
                assert "X-RateLimit-Limit" in response.headers


@pytest.mark.asyncio
async def test_vault_version_with_api_key(transport, mock_user, mock_project, mock_environment):
    """GET /api/v1/projects/:id/environments/:env/vault/version must accept API key."""
    with override_dual_auth(mock_user):
        with patch('app.services.project_service.ProjectService.check_user_access', new_callable=AsyncMock) as mock_access:
            mock_access.return_value = MagicMock(role="developer")
            
            with patch('app.services.vault_service.VaultService.get_environment_version', new_callable=AsyncMock) as mock_version:
                mock_version.return_value = 5
                with patch('app.services.vault_service.VaultService.get_blob_count', new_callable=AsyncMock) as mock_count:
                    mock_count.return_value = 3
                    
                    async with AsyncClient(transport=transport, base_url="http://test") as client:
                        response = await client.get(
                            f"/api/v1/projects/{mock_project.id}/environments/{mock_environment.id}/vault/version",
                            headers={"Authorization": "Bearer cek_live_testkey123"}
                        )
                    
                    assert response.status_code == 200
                    data = response.json()
                    assert data["version"] == 5
                    assert data["blob_count"] == 3


@pytest.mark.asyncio
async def test_projects_list_with_api_key(transport, mock_user):
    """GET /api/v1/projects must accept API key."""
    with override_dual_auth(mock_user):
        with patch('app.services.project_service.ProjectService.list_user_projects', new_callable=AsyncMock) as mock_list:
            mock_list.return_value = []
            
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get(
                    "/api/v1/projects",
                    headers={"Authorization": "Bearer cek_live_testkey123"}
                )
            
            assert response.status_code == 200
            data = response.json()
            assert "projects" in data
            assert "total" in data


@pytest.mark.asyncio
async def test_projects_get_with_api_key(transport, mock_user, mock_project):
    """GET /api/v1/projects/:id must accept API key."""
    with override_dual_auth(mock_user):
        with patch('app.services.project_service.ProjectService.check_user_access', new_callable=AsyncMock) as mock_access:
            mock_access.return_value = MagicMock(role="developer")
            
            with patch('app.services.project_service.ProjectService.get_project', new_callable=AsyncMock) as mock_get:
                mock_get.return_value = mock_project
                
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    response = await client.get(
                        f"/api/v1/projects/{mock_project.id}",
                        headers={"Authorization": "Bearer cek_live_testkey123"}
                    )
                
                assert response.status_code == 200
                data = response.json()
                assert data["name"] == "API Test Project"


@pytest.mark.asyncio
async def test_environments_list_with_api_key(transport, mock_user, mock_project, mock_environment):
    """GET /api/v1/projects/:id/environments must accept API key."""
    from app.database import get_db
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_environment]
    
    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    
    async def _mock_get_db():
        yield mock_session
    
    app.dependency_overrides[get_db] = _mock_get_db
    
    with override_dual_auth(mock_user):
        with patch('app.services.project_service.ProjectService.check_user_access', new_callable=AsyncMock) as mock_access:
            mock_access.return_value = MagicMock(role="developer")
            
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get(
                    f"/api/v1/projects/{mock_project.id}/environments",
                    headers={"Authorization": "Bearer cek_live_testkey123"}
                )
            
            # Should return 200 with environments
            assert response.status_code == 200
            data = response.json()
            assert "environments" in data
    
    app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_unauthorized_without_auth(transport):
    """Endpoints with dual auth must return 401 without any auth."""
    # Remove any overrides
    app.dependency_overrides.pop(get_current_user_or_api_key, None)
    
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/projects")
    
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_rate_limit_middleware_registered(transport):
    """Rate limit middleware must be active and add headers."""
    with override_dual_auth(MagicMock(id=uuid4(), email="test@example.com")):
        with patch('app.services.project_service.ProjectService.list_user_projects', new_callable=AsyncMock) as mock_list:
            mock_list.return_value = []
            
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get(
                    "/api/v1/projects",
                    headers={"Authorization": "Bearer cek_live_testkey123"}
                )
            
            assert response.status_code == 200
            # Verify rate limit headers are present
            assert "X-RateLimit-Limit" in response.headers
            assert "X-RateLimit-Remaining" in response.headers
            assert "X-RateLimit-Reset" in response.headers
