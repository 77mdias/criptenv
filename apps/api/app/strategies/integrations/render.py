"""Render Integration Provider

Syncs secrets with a Render service's environment variables.
Contract: https://api-docs.render.com/openapi/render-public-api-1.json
(update-env-var, get-env-vars-for-service, retrieve-service).
"""

from urllib.parse import quote

import httpx

from app.strategies.integrations.base import IntegrationProvider, ensure_ok, register_provider

PAGE_SIZE = 100


@register_provider
class RenderProvider(IntegrationProvider):
    """Render integration for environment variable sync.

    Config: ``api_token`` and ``service_id``. Render variables are scoped to a
    service, so the sync environment is not used.
    """

    provider_name = "render"
    api_base_url = "https://api.render.com/v1"
    required_config = ("api_token", "service_id")

    def _client(self, config: dict, timeout: float = 30.0) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.api_base_url,
            headers={"Authorization": f"Bearer {config['api_token']}"},
            timeout=timeout,
        )

    @staticmethod
    def _require(config: dict) -> str:
        if not config.get("api_token") or not config.get("service_id"):
            raise ValueError("Render config requires 'api_token' and 'service_id'")
        return config["service_id"]

    async def push_secrets(
        self,
        secrets: list[dict],
        config: dict,
        environment: str
    ) -> bool:
        """Add or update each variable, leaving the service's other variables untouched.

        PUT on the collection route would replace *all* variables, so each key
        goes through the single-variable route instead.
        """
        service_id = self._require(config)
        async with self._client(config) as client:
            for secret in secrets:
                response = await client.put(
                    f"/services/{service_id}/env-vars/{quote(secret['key'], safe='')}",
                    json={"value": secret["value"]},
                )
                ensure_ok(response, "Render")
        return True

    async def pull_secrets(
        self,
        config: dict,
        environment: str
    ) -> list[dict]:
        """Read every variable of the service, following Render's cursor pagination."""
        service_id = self._require(config)
        secrets: list[dict] = []
        cursor = None
        async with self._client(config) as client:
            while True:
                params = {"limit": PAGE_SIZE}
                if cursor:
                    params["cursor"] = cursor
                response = ensure_ok(
                    await client.get(f"/services/{service_id}/env-vars", params=params),
                    "Render",
                )
                page = response.json()
                for item in page:
                    env_var = item.get("envVar") or {}
                    if env_var.get("key"):
                        secrets.append({"key": env_var["key"], "value": env_var.get("value", "")})
                if len(page) < PAGE_SIZE:
                    return secrets
                cursor = page[-1].get("cursor")
                if not cursor:
                    return secrets

    async def validate_connection(self, config: dict) -> bool:
        """Fetch the configured service, proving the token can reach it."""
        service_id = self._require(config)
        async with self._client(config, timeout=10.0) as client:
            ensure_ok(await client.get(f"/services/{service_id}"), "Render")
        return True

    def get_environments(self, config: dict) -> list[str]:
        """Render variables are service-scoped; production is the only target."""
        return ["production"]
