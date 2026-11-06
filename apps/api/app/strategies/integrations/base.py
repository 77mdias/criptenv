"""Integration Provider Base Interface

Strategy pattern for external deploy providers (Vercel, Render, Cloudflare Workers).
Each provider implements this interface to enable secret sync.
"""

from abc import ABC, abstractmethod
from typing import Optional

import httpx


class ProviderError(Exception):
    """A provider call failed.

    The message is shown to the user and persisted as ``last_error``; the
    integration service redacts config values (tokens) before storing it.
    """


def ensure_ok(response: httpx.Response, provider_label: str) -> httpx.Response:
    """Return the response if it is 2xx, otherwise raise ProviderError with the provider's own message."""
    if response.is_success:
        return response
    try:
        body = response.json()
    except ValueError:
        body = None

    detail = None
    if isinstance(body, dict):
        error = body.get("error")
        errors = body.get("errors")
        detail = (
            (error.get("message") if isinstance(error, dict) else None)
            or body.get("message")
            or (errors[0].get("message") if isinstance(errors, list) and errors and isinstance(errors[0], dict) else None)
        )
    suffix = f": {detail}" if detail else ""
    raise ProviderError(f"{provider_label} API returned {response.status_code}{suffix}")


class IntegrationProvider(ABC):
    """Abstract base class for external service integrations.

    Each provider implements this interface so the service can push/pull
    secrets the same way. Failures raise ``ProviderError`` (or
    ``httpx.HTTPError`` for network problems) instead of returning False, so
    the caller can tell the user *why* a sync failed.

    Usage:
        provider = get_provider("vercel")
        await provider.push_secrets(secrets, config, environment)
    """

    # Config keys that must be present (non-empty strings) when an integration is created.
    required_config: tuple[str, ...] = ()
    # False when the provider never exposes secret values (e.g. Cloudflare Workers).
    supports_pull: bool = True
    # Keys a push removed from an existing record and created again with another kind.
    recreated_keys: tuple[str, ...] = ()

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return provider identifier (e.g., 'vercel', 'render')."""
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
        """Create or update secrets in the provider.

        Args:
            secrets: List of dicts with 'key' and 'value'
            config: Provider-specific config (API token, project ID, etc.)
            environment: Target environment (production, preview, development)

        Returns:
            True when every secret was written; raises ProviderError otherwise.
        """
        ...

    @abstractmethod
    async def pull_secrets(
        self,
        config: dict,
        environment: str
    ) -> list[dict]:
        """Read secrets from the provider.

        Returns:
            List of dicts with 'key' and 'value'; raises ProviderError on failure.
        """
        ...

    @abstractmethod
    async def validate_connection(self, config: dict) -> bool:
        """Check that the token can reach the configured project/service.

        Returns:
            True if the connection works; raises ProviderError with the reason otherwise.
        """
        ...

    @abstractmethod
    def get_environments(self, config: dict) -> list[str]:
        """List the environments the provider accepts as sync targets."""
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
    """Get provider instance by name, or None if it is not registered."""
    provider_class = _PROVIDERS.get(name.lower())
    if provider_class:
        return provider_class()
    return None


def list_providers() -> list[str]:
    """List all registered provider names."""
    return list(_PROVIDERS.keys())
