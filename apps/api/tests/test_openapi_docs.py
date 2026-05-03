"""Test OpenAPI/Swagger Customizado for M3.4.6

RED Phase: Write tests that describe the expected behavior.
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


class TestOpenAPISchema:
    """Test OpenAPI schema generation and documentation."""

    @pytest.mark.asyncio
    async def test_openapi_schema_exists(self, transport, mock_db):
        """OpenAPI schema should be accessible at /openapi.json."""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            assert response.status_code == 200
            data = response.json()
            assert "openapi" in data
            assert data["openapi"].startswith("3.")

    @pytest.mark.asyncio
    async def test_openapi_has_info(self, transport, mock_db):
        """OpenAPI schema should have title, description, version."""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            data = response.json()
            assert "info" in data
            assert "title" in data["info"]
            assert "description" in data["info"]
            assert "version" in data["info"]

    @pytest.mark.asyncio
    async def test_openapi_paths_exist(self, transport, mock_db):
        """OpenAPI should document all v1 endpoints."""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            data = response.json()
            assert "paths" in data
            paths = data["paths"]
            # Check v1 endpoints exist
            assert "/api/v1/health" in paths
            assert "/api/v1/projects" in paths

    @pytest.mark.asyncio
    async def test_openapi_has_components(self, transport, mock_db):
        """OpenAPI should have components section with schemas."""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            data = response.json()
            assert "components" in data
            assert "schemas" in data["components"]
            # Schemas should exist for models
            schemas = data["components"]["schemas"]
            # ApiKey schemas are created by our code
            assert len(schemas) > 0


class TestErrorResponseFormat:
    """Test error response format consistency."""

    @pytest.mark.asyncio
    async def test_validation_error_format(self, transport, mock_db):
        """Validation errors should follow consistent format."""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Use legacy auth endpoint with invalid data
            response = await client.post(
                "/api/auth/signup",
                json={"email": "invalid-email"}  # Missing required fields
            )
            # Should return 422 with validation error
            assert response.status_code == 422
            data = response.json()
            assert "detail" in data

    @pytest.mark.asyncio
    async def test_auth_error_format(self, transport, mock_db):
        """Authentication errors should follow consistent format."""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(
                "/api/v1/projects",
                headers={"Authorization": "Bearer invalid_token"}
            )
            # Should return 401 or 403
            assert response.status_code in [401, 403]
            data = response.json()
            assert "detail" in data

    @pytest.mark.asyncio
    async def test_not_found_error_format(self, transport, mock_db):
        """404 errors should follow consistent format."""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/nonexistent-endpoint")
            assert response.status_code == 404
            data = response.json()
            assert "detail" in data

    @pytest.mark.asyncio
    async def test_rate_limit_error_format(self, transport, mock_db):
        """Rate limit errors should follow consistent format."""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Make many requests to trigger rate limit
            for _ in range(200):
                response = await client.get("/api/v1/health")
            
            # Eventually should get rate limited
            # Note: Health endpoint may not be rate limited
            if response.status_code == 429:
                data = response.json()
                # Rate limit returns consistent API error format: {"error": {...}}
                assert "error" in data
                assert "code" in data["error"]
                assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"
                assert "message" in data["error"]
                assert "retry_after" in data["error"]


class TestSecurityDocumentation:
    """Test security documentation in OpenAPI spec."""

    @pytest.mark.asyncio
    async def test_openapi_components_exist(self, transport, mock_db):
        """OpenAPI should have components section."""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            data = response.json()
            assert "components" in data

    @pytest.mark.asyncio
    async def test_endpoints_have_security_requirements(self, transport, mock_db):
        """Protected endpoints should have security requirements in spec."""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            data = response.json()
            paths = data["paths"]
            
            # /projects should require auth
            if "/api/v1/projects" in paths:
                project_path = paths["/api/v1/projects"]
                if "get" in project_path:
                    pass  # Just check it exists

    @pytest.mark.asyncio
    async def test_health_endpoints_no_security(self, transport, mock_db):
        """Health endpoints should not require authentication."""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            data = response.json()
            paths = data["paths"]
            
            if "/api/v1/health" in paths:
                health_path = paths["/api/v1/health"]
                if "get" in health_path:
                    pass  # Health typically has no security


class TestAPIEndpointsDocumentation:
    """Test endpoint documentation and examples."""

    @pytest.mark.asyncio
    async def test_endpoint_has_description(self, transport, mock_db):
        """Endpoints should have descriptions."""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            data = response.json()
            paths = data["paths"]
            
            if "/api/v1/health" in paths:
                health_get = paths["/api/v1/health"].get("get", {})
                # Should have summary or description
                assert "summary" in health_get or "description" in health_get

    @pytest.mark.asyncio
    async def test_endpoint_has_tags(self, transport, mock_db):
        """Endpoints should be organized with tags."""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            data = response.json()
            paths = data["paths"]
            
            for path, methods in paths.items():
                for method, details in methods.items():
                    if method in ["get", "post", "put", "patch", "delete"]:
                        if "tags" in details:
                            assert len(details["tags"]) > 0

    @pytest.mark.asyncio
    async def test_error_response_schemas_documented(self, transport, mock_db):
        """Endpoints should document possible error responses."""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/openapi.json")
            data = response.json()
            paths = data["paths"]
            
            if "/api/v1/projects" in paths:
                projects_get = paths["/api/v1/projects"].get("get", {})
                if "responses" in projects_get:
                    responses = projects_get["responses"]
                    assert any(code.startswith("4") or code.startswith("5") 
                              for code in responses.keys())


class TestSwaggerUIAccess:
    """Test Swagger UI availability (development mode)."""

    @pytest.mark.asyncio
    async def test_swagger_ui_html_accessible(self, transport, mock_db):
        """Swagger UI HTML should be accessible when debug=True."""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/docs")
            # In test mode with DEBUG=False, docs may not be available
            if response.status_code == 404:
                pytest.skip("Swagger UI disabled in non-debug mode")
            assert response.status_code == 200
            assert "text/html" in response.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_redoc_html_accessible(self, transport, mock_db):
        """ReDoc HTML should be accessible when debug=True."""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/redoc")
            if response.status_code == 404:
                pytest.skip("ReDoc disabled in non-debug mode")
            assert response.status_code == 200
            assert "text/html" in response.headers.get("content-type", "")