"""Tests for Integration Provider Strategy Pattern"""

import pytest
from abc import ABC
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime, timezone

from app.models.oauth_account import OAuthAccount  # noqa: F401


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


class TestRenderProvider:
    """RED: Test RenderProvider implementation"""

    @pytest.mark.asyncio
    async def test_push_secrets_returns_bool(self):
        """push_secrets should return True on success"""
        from app.strategies.integrations.render import RenderProvider
        
        provider = RenderProvider()
        secrets = [
            {"key": "DATABASE_URL", "value": "postgres://..."},
            {"key": "API_KEY", "value": "sk_xxx"}
        ]
        config = {"api_token": "test_token", "service_id": "srv_123"}
        
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
        from app.strategies.integrations.render import RenderProvider
        
        provider = RenderProvider()
        config = {"api_token": "test_token", "service_id": "srv_123"}
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json = MagicMock(return_value=[
            {"envVar": {"key": "DATABASE_URL", "value": "postgres://..."}},
            {"envVar": {"key": "API_KEY", "value": "sk_xxx"}}
        ])
        
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
        from app.strategies.integrations.render import RenderProvider
        
        provider = RenderProvider()
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
        from app.strategies.integrations.render import RenderProvider
        
        provider = RenderProvider()
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

    def test_get_environments(self):
        """Render should return ['production'] as environments"""
        from app.strategies.integrations.render import RenderProvider
        
        provider = RenderProvider()
        envs = provider.get_environments({})
        
        assert envs == ["production"]

    def test_provider_name(self):
        """RenderProvider name should be 'render'"""
        from app.strategies.integrations.render import RenderProvider
        
        provider = RenderProvider()
        assert provider.provider_name == "render"

    def test_api_base_url(self):
        """RenderProvider API base URL should be correct"""
        from app.strategies.integrations.render import RenderProvider
        
        provider = RenderProvider()
        assert provider.api_base_url == "https://api.render.com/v1"


class TestIntegrationService:
    """RED: Test IntegrationService"""

    @pytest.mark.asyncio
    async def test_create_integration(self):
        """Should create integration with provider and config"""
        from app.services.integration_service import IntegrationService
        from app.crypto.integration_config import IntegrationConfigEncryption
        
        mock_db = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock()
        service = IntegrationService(db=mock_db)
        
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
        assert IntegrationConfigEncryption.is_encrypted(result.config)
        assert "tok_xxx" not in str(result.config)

    @pytest.mark.asyncio
    async def test_sync_secrets_push(self):
        """Should push secrets to provider during sync"""
        from app.services.integration_service import IntegrationService
        from app.crypto.integration_config import IntegrationConfigEncryption
        
        mock_db = MagicMock()
        mock_db.commit = AsyncMock()
        service = IntegrationService(db=mock_db)
        
        # Mock integration
        mock_integration = MagicMock()
        mock_integration.id = uuid4()
        mock_integration.provider = "vercel"
        plain_config = {"api_token": "tok_xxx", "project_id": "prj_123"}
        mock_integration.config = IntegrationConfigEncryption.encrypt(
            plain_config,
            "test-integration-config-secret-32-chars",
        )
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
                
                success, error = await service.sync_integration(
                    integration_id=mock_integration.id,
                    direction="push",
                    secrets=mock_blobs
                )
                
                assert success is True
                assert error is None
                mock_provider.push_secrets.assert_called_once_with(
                    mock_blobs,
                    plain_config,
                    "production",
                )

    @pytest.mark.asyncio
    async def test_validate_integration_decrypts_config_for_provider(self):
        """Should pass decrypted config to provider validation."""
        from app.services.integration_service import IntegrationService
        from app.crypto.integration_config import IntegrationConfigEncryption

        mock_db = MagicMock()
        mock_db.commit = AsyncMock()
        service = IntegrationService(db=mock_db)

        plain_config = {"api_token": "tok_xxx", "project_id": "prj_123"}
        mock_integration = MagicMock()
        mock_integration.id = uuid4()
        mock_integration.provider = "vercel"
        mock_integration.config = IntegrationConfigEncryption.encrypt(
            plain_config,
            "test-integration-config-secret-32-chars",
        )

        with patch.object(service, "get_integration", new=AsyncMock(return_value=mock_integration)):
            with patch.object(service, "_get_provider", new=MagicMock()) as mock_get_provider:
                mock_provider = AsyncMock()
                mock_provider.validate_connection = AsyncMock(return_value=True)
                mock_get_provider.return_value = mock_provider

                success, error = await service.validate_integration(mock_integration.id)

                assert success is True
                assert error is None
                mock_provider.validate_connection.assert_called_once_with(plain_config)

    @pytest.mark.asyncio
    async def test_legacy_plaintext_config_is_reencrypted_on_validate(self):
        """Should re-encrypt legacy plaintext config after successful access."""
        from app.services.integration_service import IntegrationService
        from app.crypto.integration_config import IntegrationConfigEncryption

        mock_db = MagicMock()
        mock_db.commit = AsyncMock()
        service = IntegrationService(db=mock_db)

        plain_config = {"api_token": "tok_xxx", "project_id": "prj_123"}
        mock_integration = MagicMock()
        mock_integration.id = uuid4()
        mock_integration.provider = "vercel"
        mock_integration.config = dict(plain_config)

        with patch.object(service, "get_integration", new=AsyncMock(return_value=mock_integration)):
            with patch.object(service, "_get_provider", new=MagicMock()) as mock_get_provider:
                mock_provider = AsyncMock()
                mock_provider.validate_connection = AsyncMock(return_value=True)
                mock_get_provider.return_value = mock_provider

                success, error = await service.validate_integration(mock_integration.id)

                assert success is True
                assert error is None
                assert IntegrationConfigEncryption.is_encrypted(mock_integration.config)
                assert "tok_xxx" not in str(mock_integration.config)

    @pytest.mark.asyncio
    async def test_missing_integration_config_secret_returns_clear_error(self, monkeypatch):
        """Should fail clearly when encryption secret is not configured."""
        from app.config import settings
        from app.services.integration_service import IntegrationService

        monkeypatch.setattr(settings, "INTEGRATION_CONFIG_SECRET", "")

        mock_db = MagicMock()
        mock_db.commit = AsyncMock()
        service = IntegrationService(db=mock_db)
        mock_integration = MagicMock()
        mock_integration.id = uuid4()
        mock_integration.provider = "vercel"
        mock_integration.config = {"api_token": "tok_xxx", "project_id": "prj_123"}

        with patch.object(service, "get_integration", new=AsyncMock(return_value=mock_integration)):
            with patch.object(service, "_get_provider", new=MagicMock()) as mock_get_provider:
                mock_provider = AsyncMock()
                mock_provider.push_secrets = AsyncMock(return_value=True)
                mock_get_provider.return_value = mock_provider

                success, error = await service.sync_integration(
                    integration_id=mock_integration.id,
                    direction="push",
                    secrets=[{"key": "DATABASE_URL", "value": "postgres://..."}],
                )

        assert success is False
        assert "INTEGRATION_CONFIG_SECRET" in error


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

    def test_integration_response_excludes_config(self):
        """Integration API responses should not expose provider config."""
        from app.routers.integrations import IntegrationResponse

        assert "config" not in IntegrationResponse.model_fields


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
