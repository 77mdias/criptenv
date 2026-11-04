"""Cloudflare Workers Integration Provider

Pushes secrets to a Worker script as ``secret_text`` bindings.
Contract: https://github.com/cloudflare/api-schemas (worker-patch-script-secrets-bulk,
worker-list-script-secrets).
"""

import httpx

from app.strategies.integrations.base import (
    IntegrationProvider,
    ProviderError,
    ensure_ok,
    register_provider,
)

# Cloudflare accepts at most 100 operations per secrets-bulk request.
BULK_LIMIT = 100


@register_provider
class CloudflareWorkersProvider(IntegrationProvider):
    """Cloudflare Workers integration (push only).

    Config: ``api_token`` (needs "Workers Scripts: Edit"), ``account_id`` and
    ``script_name``. A Wrangler environment is its own script
    (``<name>-<env>``), so connect one integration per script.
    """

    provider_name = "cloudflare"
    api_base_url = "https://api.cloudflare.com/client/v4"
    required_config = ("api_token", "account_id", "script_name")
    # Cloudflare never returns secret values once written.
    supports_pull = False

    def _client(self, config: dict) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.api_base_url,
            headers={"Authorization": f"Bearer {config['api_token']}"},
            timeout=30.0,
        )

    @staticmethod
    def _secrets_path(config: dict) -> str:
        if not all(config.get(key) for key in ("api_token", "account_id", "script_name")):
            raise ValueError(
                "Cloudflare config requires 'api_token', 'account_id' and 'script_name'"
            )
        return f"/accounts/{config['account_id']}/workers/scripts/{config['script_name']}/secrets"

    async def push_secrets(
        self,
        secrets: list[dict],
        config: dict,
        environment: str
    ) -> bool:
        """Create or update secrets in bulk requests of up to 100.

        Each request deploys a new Worker version; if one fails, the batches
        before it stay applied and the error is raised.
        """
        path = self._secrets_path(config)
        async with self._client(config) as client:
            for start in range(0, len(secrets), BULK_LIMIT):
                body = {
                    "secrets": {
                        secret["key"]: {
                            "name": secret["key"],
                            "type": "secret_text",
                            "text": secret["value"],
                        }
                        for secret in secrets[start:start + BULK_LIMIT]
                    }
                }
                ensure_ok(await client.patch(f"{path}-bulk", json=body), "Cloudflare")
        return True

    async def pull_secrets(
        self,
        config: dict,
        environment: str
    ) -> list[dict]:
        raise ProviderError("Cloudflare Workers does not expose secret values, so pull is not supported")

    async def validate_connection(self, config: dict) -> bool:
        """List the script's secrets, proving token, account and script name together."""
        path = self._secrets_path(config)
        async with self._client(config) as client:
            ensure_ok(await client.get(path), "Cloudflare")
        return True

    def get_environments(self, config: dict) -> list[str]:
        """Each Worker script is a single target."""
        return ["production"]
