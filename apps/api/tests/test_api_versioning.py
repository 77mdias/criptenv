"""Test API Versioning for M3.4 Public API

HELL TDD - RED phase: These tests define the expected behavior
for API versioning with /api/v1/ prefix.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock

# Import app directly for testing
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import app


@pytest.fixture
def mock_db():
    """Mock database session for tests."""
    with patch("app.database.async_session_factory") as mock:
        session = AsyncMock()
        mock.return_value.__aenter__ = AsyncMock(return_value=session)
        mock.return_value.__aexit__ = AsyncMock(return_value=None)
        yield session


@pytest.fixture
def transport():
    """ASGI transport for AsyncClient."""
    return ASGITransport(app=app)


@pytest.mark.asyncio
async def test_v1_health_endpoint_returns_200(transport):
    """GET /api/v1/health must return 200 with version info."""
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/health")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "service" in data


@pytest.mark.asyncio
async def test_v1_health_has_version_header(transport):
    """GET /api/v1/health must include X-API-Version header."""
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/health")
    
    assert "X-API-Version" in response.headers
    assert response.headers["X-API-Version"] == "1.0"


@pytest.mark.asyncio
async def test_v1_projects_requires_auth(transport):
    """GET /api/v1/projects must require authentication (401 if not logged)."""
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/projects")
    
    # Should be 401 (unauthorized) since we don't have a session
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_invalid_version_returns_400(transport):
    """GET /api/v2/health must return 400 Bad Request."""
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v2/health")
    
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_legacy_health_still_works(transport):
    """GET /health (legacy, without version prefix) must still work."""
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
    
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_v1_environments_requires_auth(transport):
    """GET /api/v1/projects/:id/environments must require auth."""
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/projects/some-id/environments")
    
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_v1_vault_endpoint_exists(transport):
    """GET /api/v1/projects/:id/environments/:env/vault/pull must exist (auth required).
    
    The vault router has prefix: /api/v1/projects/{project_id}/environments/{environment_id}/vault
    So the path should be: /api/v1/projects/some-id/environments/some-env/vault/pull
    """
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/projects/some-id/environments/some-env/vault/pull")
    
    # Should be 401 (unauthorized) since we don't have a session
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_v1_health_matches_legacy_format(transport):
    """Response format of /api/v1/health should match /health."""
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        v1_response = await client.get("/api/v1/health")
        legacy_response = await client.get("/health")
    
    # Both should have same status and service
    assert v1_response.json()["status"] == legacy_response.json()["status"]
    assert v1_response.json()["service"] == legacy_response.json()["service"]


@pytest.mark.asyncio
async def test_v1_ready_endpoint(transport):
    """GET /api/v1/health/ready must return database status."""
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/health/ready")
    
    # Should return 200 or 503 based on db connection
    assert response.status_code in (200, 503)
    data = response.json()
    assert "status" in data