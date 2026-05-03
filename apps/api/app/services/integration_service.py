"""Integration Service

Business logic for managing external service integrations.
"""

from typing import Optional
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.integration import Integration
from app.strategies.integrations.base import get_provider, list_providers


class IntegrationService:
    """Service for managing external integrations.
    
    Handles CRUD operations for integrations and coordinates
    sync operations with external providers.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db

    def _get_provider(self, provider: str):
        """Return registered provider by name."""
        return get_provider(provider)

    def _sanitize_error(self, message: str, config: Optional[dict] = None) -> str:
        """Remove provider secret values from errors before persisting or returning them."""
        sanitized = message
        for value in (config or {}).values():
            if isinstance(value, str) and len(value) >= 8:
                sanitized = sanitized.replace(value, "[redacted]")
        return sanitized
    
    async def create_integration(
        self,
        project_id: UUID,
        provider: str,
        name: str,
        config: dict
    ) -> Integration:
        """Create a new integration.
        
        Args:
            project_id: Project UUID
            provider: Provider name (vercel, railway, render)
            name: Human-readable name
            config: Provider-specific configuration
            
        Returns:
            Created integration
        """
        integration = Integration(
            project_id=project_id,
            provider=provider,
            name=name,
            config=config,
            status="active"
        )
        
        self.db.add(integration)
        await self.db.flush()
        await self.db.refresh(integration)
        
        return integration
    
    async def get_integration(self, integration_id: UUID) -> Optional[Integration]:
        """Get integration by ID."""
        result = await self.db.execute(
            select(Integration).where(Integration.id == integration_id)
        )
        return result.scalar_one_or_none()
    
    async def list_integrations(self, project_id: UUID) -> list[Integration]:
        """List all integrations for a project."""
        result = await self.db.execute(
            select(Integration)
            .where(Integration.project_id == project_id)
            .order_by(Integration.created_at.desc())
        )
        return list(result.scalars().all())
    
    async def delete_integration(self, integration_id: UUID) -> bool:
        """Delete an integration.
        
        Returns:
            True if deleted, False if not found
        """
        integration = await self.get_integration(integration_id)
        if not integration:
            return False
        
        await self.db.delete(integration)
        return True
    
    async def validate_integration(self, integration_id: UUID) -> tuple[bool, Optional[str]]:
        """Validate an integration by testing provider connection.
        
        Returns:
            (is_valid, error_message)
        """
        integration = await self.get_integration(integration_id)
        if not integration:
            return False, "Integration not found"
        
        provider = self._get_provider(integration.provider)
        if not provider:
            return False, f"Unknown provider: {integration.provider}"
        
        is_valid = await provider.validate_connection(integration.config)
        
        if is_valid:
            integration.status = "active"
            integration.last_error = None
        else:
            integration.status = "error"
            integration.last_error = "Connection validation failed"
        
        await self.db.commit()
        return is_valid, None if is_valid else "Connection validation failed"
    
    async def sync_integration(
        self,
        integration_id: UUID,
        direction: str,  # "push" or "pull"
        secrets: Optional[list[dict]] = None,
        environment: str = "production"
    ) -> tuple[bool, Optional[str]]:
        """Sync secrets with an integration.
        
        Args:
            integration_id: Integration UUID
            direction: "push" (criptenv -> provider) or "pull" (provider -> criptenv)
            secrets: For push, list of {key, value} dicts. For pull, ignored.
            environment: Target/source environment
            
        Returns:
            (success, error_message)
        """
        integration = await self.get_integration(integration_id)
        if not integration:
            return False, "Integration not found"
        
        provider = self._get_provider(integration.provider)
        if not provider:
            return False, f"Unknown provider: {integration.provider}"
        
        try:
            if direction == "push":
                if not secrets:
                    return False, "No secrets provided for push"
                
                success = await provider.push_secrets(
                    secrets, integration.config, environment
                )
            elif direction == "pull":
                secrets = await provider.pull_secrets(
                    integration.config, environment
                )
                success = True
            else:
                return False, f"Invalid direction: {direction}"
            
            if success:
                integration.last_sync_at = datetime.now(timezone.utc)
                integration.last_error = None
                integration.status = "active"
            else:
                integration.status = "error"
                integration.last_error = f"Sync failed: {direction}"
            
            await self.db.commit()
            return success, None if success else f"Sync failed: {direction}"
            
        except Exception as e:
            error_message = self._sanitize_error(str(e), integration.config)
            integration.status = "error"
            integration.last_error = error_message
            await self.db.commit()
            return False, error_message
    
    def get_available_providers(self) -> list[str]:
        """Get list of registered provider names."""
        return list_providers()
