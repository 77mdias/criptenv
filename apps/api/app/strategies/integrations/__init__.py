"""Integration Strategies Package

Strategy pattern implementations for external deploy providers.
"""

from app.strategies.integrations.base import (
    IntegrationProvider,
    ProviderError,
    register_provider,
    get_provider,
    list_providers
)

# Import providers to trigger registration
from app.strategies.integrations.vercel import VercelProvider
from app.strategies.integrations.render import RenderProvider
from app.strategies.integrations.cloudflare import CloudflareWorkersProvider

__all__ = [
    "IntegrationProvider",
    "ProviderError",
    "register_provider",
    "get_provider",
    "list_providers",
    "VercelProvider",
    "RenderProvider",
    "CloudflareWorkersProvider",
]
