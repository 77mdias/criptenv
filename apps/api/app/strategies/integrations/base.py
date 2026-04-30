"""Integration Provider Base Interface

Strategy pattern for external CI/CD providers (Vercel, Railway, Render).
Each provider implements this interface to enable secret sync.
"""

from abc import ABC, abstractmethod
from typing import Optional


class IntegrationProvider(ABC):
    """Abstract base class for external service integrations.
    
    Each provider (Vercel, Railway, Render) implements this interface
    to enable consistent secret push/pull operations.
    
    Usage:
        provider = get_provider("vercel")
        provider.push_secrets(secrets, config, environment)
    """
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return provider identifier (e.g., 'vercel', 'railway')."""
        ...
    
    @property
    @abstractmethod
    def api_base_url(self) -> str:
        """Return provider API base URL."""
        ...
    
    @abstractmethod
    async def push_secrets(
        self,
        secrets: list[dict],
        config: dict,
        environment: str
    ) -> bool:
        """Push secrets to external provider.
        
        Args:
            secrets: List of dicts with 'key' and 'value' (and optionally 'encrypted')
            config: Provider-specific config (API token, project ID, etc.)
            environment: Target environment (production, preview, development)
            
        Returns:
            True if push succeeded, False otherwise
        """
        ...
    
    @abstractmethod
    async def pull_secrets(
        self,
        config: dict,
        environment: str
    ) -> list[dict]:
        """Pull secrets from external provider.
        
        Args:
            config: Provider-specific config (API token, project ID, etc.)
            environment: Source environment
            
        Returns:
            List of dicts with 'key' and 'value'
        """
        ...
    
    @abstractmethod
    async def validate_connection(self, config: dict) -> bool:
        """Validate that the connection is still active.
        
        Args:
            config: Provider-specific config
            
        Returns:
            True if connection is valid, False otherwise
        """
        ...
    
    @abstractmethod
    def get_environments(self, config: dict) -> list[str]:
        """List available environments in provider.
        
        Args:
            config: Provider-specific config
            
        Returns:
            List of environment names
        """
        ...


# Provider registry for dynamic lookup
_PROVIDERS: dict[str, type[IntegrationProvider]] = {}


def register_provider(provider_class: type[IntegrationProvider]) -> type[IntegrationProvider]:
    """Decorator to register a provider implementation.
    
    Usage:
        @register_provider
        class VercelProvider(IntegrationProvider):
            ...
    """
    instance = provider_class()
    _PROVIDERS[instance.provider_name] = provider_class
    return provider_class


def get_provider(name: str) -> Optional[IntegrationProvider]:
    """Get provider instance by name.
    
    Args:
        name: Provider name (vercel, railway, render)
        
    Returns:
        Provider instance or None if not found
    """
    provider_class = _PROVIDERS.get(name.lower())
    if provider_class:
        return provider_class()
    return None


def list_providers() -> list[str]:
    """List all registered provider names."""
    return list(_PROVIDERS.keys())