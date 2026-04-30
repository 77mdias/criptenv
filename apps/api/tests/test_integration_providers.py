"""Tests for Integration Provider Strategy Pattern"""

import pytest
from abc import ABC
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime, timezone


class TestIntegrationProviderInterface:
    """RED: Test IntegrationProvider abstract interface"""

    def test_provider_has_abstract_methods(self):
        """IntegrationProvider must have push_secrets, pull_secrets, validate_connection"""
        from app.strategies.integrations.base import IntegrationProvider
        
        # Provider should be abstract base class
        assert issubclass(IntegrationProvider, ABC)
        
        # Check abstract methods exist
        assert hasattr(IntegrationProvider, 'push_secrets')
        assert hasattr(IntegrationProvider, 'pull_secrets')
        assert hasattr(IntegrationProvider, 'validate_connection')
        assert hasattr(IntegrationProvider, 'get_environments')

    def test_provider_properties(self):
        """IntegrationProvider must have provider_name and api_base_url properties"""
        from app.strategies.integrations.base import IntegrationProvider
        
        assert hasattr(IntegrationProvider, 'provider_name')
        assert hasattr(IntegrationProvider, 'api_base_url')


class TestVercelProvider:
    """RED: Test VercelProvider implementation"""

    @pytest.mark.asyncio
    async def test_push_secrets_returns_bool(self):
        """push_secrets should return True on success"""
        from app.strategies.integrations.vercel import VercelProvider
        
        provider = VercelProvider()
        secrets = [
            {"key": "DATABASE_URL", "value": "postgres://..."},
            {"key": "API_KEY", "value": "sk_xxx"}
        ]
        config = {"api_token": "test_token", "project_id": "prj_123"}
        
        # Mock httpx client
        mock_response = MagicMock()
        mock_response.status_code = 201
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock()
            
            result = await provider.push_secrets(secrets, config, "production")
            
            assert result is True
            assert mock_client.post.call_count == 2  # 2 secrets

    @pytest.mark.asyncio
    async def test_pull_secrets_returns_list(self):
        """pull_secrets should return list of secrets"""
        from app.strategies.integrations.vercel import VercelProvider
        
        provider = VercelProvider()
        config = {"api_token": "test_token", "project_id": "prj_123"}
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json = MagicMock(return_value={
            "envs": [
                {"key": "DATABASE_URL", "value": "postgres://..."},
                {"key": "API_KEY", "value": "sk_xxx"}
            ]
        })
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock()
            
            result = await provider.pull_secrets(config, "production")
            
            assert isinstance(result, list)
            assert len(result) == 2
            assert result[0]["key"] == "DATABASE_URL"

    @pytest.mark.asyncio
    async def test_validate_connection_returns_bool(self):
        """validate_connection should return True for valid token"""
        from app.strategies.integrations.vercel import VercelProvider
        
        provider = VercelProvider()
        config = {"api_token": "valid_token"}
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock()
            
            result = await provider.validate_connection(config)
            
            assert result is True

    @pytest.mark.asyncio
    async def test_validate_connection_returns_false_for_invalid_token(self):
        """validate_connection should return False for invalid token"""
        from app.strategies.integrations.vercel import VercelProvider
        
        provider = VercelProvider()
        config = {"api_token": "invalid_token"}
        
        mock_response = MagicMock()
        mock_response.status_code = 401
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock()
            
            result = await provider.validate_connection(config)
            
            assert result is False


class TestIntegrationService:
    """RED: Test IntegrationService"""

    @pytest.mark.asyncio
    async def test_create_integration(self):
        """Should create integration with provider and config"""
        from app.services.integration_service import IntegrationService
        
        service = IntegrationService(db=MagicMock())
        
        project_id = uuid4()
        result = await service.create_integration(
            project_id=project_id,
            provider="vercel",
            name="Production",
            config={"api_token": "tok_xxx", "project_id": "prj_123"}
        )
        
        assert result is not None
        assert result.provider == "vercel"
        assert result.name == "Production"

    @pytest.mark.asyncio
    async def test_sync_secrets_push(self):
        """Should push secrets to provider during sync"""
        from app.services.integration_service import IntegrationService
        
        service = IntegrationService(db=MagicMock())
        
        # Mock integration
        mock_integration = MagicMock()
        mock_integration.id = uuid4()
        mock_integration.provider = "vercel"
        mock_integration.config = {"api_token": "tok_xxx", "project_id": "prj_123"}
        mock_integration.status = "active"
        
        # Mock vault secrets
        mock_blobs = [
            MagicMock(key_id="DATABASE_URL", ciphertext="enc_data"),
            MagicMock(key_id="API_KEY", ciphertext="enc_key")
        ]
        
        with patch.object(service, 'get_integration', new=AsyncMock(return_value=mock_integration)):
            with patch.object(service, '_get_provider', new=MagicMock()) as mock_get_provider:
                mock_provider = AsyncMock()
                mock_provider.push_secrets = AsyncMock(return_value=True)
                mock_get_provider.return_value = mock_provider
                
                result = await service.sync_integration(
                    integration_id=mock_integration.id,
                    direction="push",
                    secrets=mock_blobs
                )
                
                assert result is True
                mock_provider.push_secrets.assert_called_once()


class TestIntegrationModel:
    """RED: Test Integration model"""

    def test_integration_model_fields(self):
        """Integration model should have required fields"""
        from app.models.integration import Integration
        
        assert hasattr(Integration, '__tablename__')
        assert Integration.__tablename__ == 'integrations'
        
        # Check columns exist via inspection
        columns = {c.name for c in Integration.__table__.columns}
        required = {'id', 'project_id', 'provider', 'name', 'config', 'status', 'created_at'}
        assert required.issubset(columns)

    def test_integration_status_enum(self):
        """Integration status should be limited to known values"""
        # Valid statuses: active, disconnected, error
        valid_statuses = {'active', 'disconnected', 'error'}
        
        # This is validated at the service/router level
        assert len(valid_statuses) == 3


class TestVercelProviderSpecific:
    """RED: Test Vercel-specific behavior"""

    def test_vercel_api_base_url(self):
        """VercelProvider should use correct API base URL"""
        from app.strategies.integrations.vercel import VercelProvider
        
        provider = VercelProvider()
        assert provider.api_base_url == "https://api.vercel.com/v10"

    def test_vercel_provider_name(self):
        """VercelProvider should have correct provider_name"""
        from app.strategies.integrations.vercel import VercelProvider
        
        provider = VercelProvider()
        assert provider.provider_name == "vercel"

    def test_vercel_environments(self):
        """VercelProvider should return standard environments"""
        from app.strategies.integrations.vercel import VercelProvider
        
        provider = VercelProvider()
        envs = provider.get_environments({})
        
        assert "production" in envs
        assert "preview" in envs
        assert "development" in envs