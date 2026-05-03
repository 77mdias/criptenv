"""Integration Strategies Package

Strategy pattern implementations for external CI/CD providers.
"""

from app.strategies.integrations.base import (
    IntegrationProvider,
    register_provider,
    get_provider,
    list_providers
)

# Import providers to trigger registration
from app.strategies.integrations.vercel import VercelProvider
from app.strategies.integrations.render import RenderProvider

__all__ = [
    "IntegrationProvider",
    "register_provider",
    "get_provider",
    "list_providers",
    "VercelProvider",
    "RenderProvider"
]