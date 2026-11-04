"""Vercel Integration Provider

Syncs secrets with Vercel project environment variables.
Contract: https://openapi.vercel.sh/ (createProjectEnv, filterProjectEnvs,
getProjectEnv, getProject).
"""

import httpx

from app.strategies.integrations.base import (
    IntegrationProvider,
    ProviderError,
    ensure_ok,
    register_provider,
)

VERCEL_TARGETS = ("production", "preview", "development")


@register_provider
class VercelProvider(IntegrationProvider):
    """Vercel integration for environment variable sync.

    Config: ``api_token`` and ``project_id`` (id or name); ``team_id`` is
    required when the project belongs to a team.
    """

    provider_name = "vercel"
    api_base_url = "https://api.vercel.com"
    required_config = ("api_token", "project_id")

    def _client(self, config: dict) -> httpx.AsyncClient:
        params = {"teamId": config["team_id"]} if config.get("team_id") else None
        return httpx.AsyncClient(
            base_url=self.api_base_url,
            headers={"Authorization": f"Bearer {config['api_token']}"},
            params=params,
            timeout=30.0,
        )

    @staticmethod
    def _require(config: dict) -> str:
        if not config.get("api_token") or not config.get("project_id"):
            raise ValueError("Vercel config requires 'api_token' and 'project_id'")
        return config["project_id"]

    @staticmethod
    def _check_target(environment: str) -> None:
        if environment not in VERCEL_TARGETS:
            raise ProviderError(
                f"Vercel environment must be one of {', '.join(VERCEL_TARGETS)}, got '{environment}'"
            )

    async def push_secrets(
        self,
        secrets: list[dict],
        config: dict,
        environment: str
    ) -> bool:
        """Create or overwrite the secrets for one Vercel target in a single request."""
        project_id = self._require(config)
        self._check_target(environment)

        payload = [
            {
                "key": secret["key"],
                "value": secret["value"],
                "type": "encrypted",
                "target": [environment],
            }
            for secret in secrets
        ]

        async with self._client(config) as client:
            # upsert=true overwrites existing values instead of answering 409 (same as `vercel env add --force`).
            response = await client.post(
                f"/v10/projects/{project_id}/env",
                params={"upsert": "true"},
                json=payload,
            )
            ensure_ok(response, "Vercel")

        failed = response.json().get("failed") or []
        if failed:
            details = ", ".join(
                f"{item.get('error', {}).get('envVarKey') or item.get('error', {}).get('key', '?')}: "
                f"{item.get('error', {}).get('message', 'failed')}"
                for item in failed
            )
            raise ProviderError(f"Vercel rejected {len(failed)} variable(s): {details}")
        return True

    async def pull_secrets(
        self,
        config: dict,
        environment: str
    ) -> list[dict]:
        """Read the variables that apply to one Vercel target.

        Branch-specific and ``sensitive`` variables are skipped: the first do
        not belong to the whole target, the second can never be read back.
        """
        project_id = self._require(config)
        self._check_target(environment)

        async with self._client(config) as client:
            envs: list[dict] = []
            params: dict = {}
            while True:
                page = ensure_ok(
                    await client.get(f"/v10/projects/{project_id}/env", params=params), "Vercel"
                ).json()
                envs.extend(page.get("envs", []))
                # Vercel lists page by timestamp: pagination.next is passed back as `until`.
                next_cursor = (page.get("pagination") or {}).get("next")
                if not next_cursor:
                    break
                if next_cursor == params.get("until"):
                    raise ProviderError("Vercel repeated a page; pull aborted to avoid a partial result")
                params = {"until": next_cursor}

            secrets = []
            for env in envs:
                target = env.get("target") or []
                targets = [target] if isinstance(target, str) else target
                if (
                    not env.get("key")
                    or environment not in targets
                    or env.get("gitBranch")
                    or env.get("type") == "sensitive"
                ):
                    continue

                value = env.get("value")
                if env.get("type") != "plain" and not env.get("decrypted"):
                    # The list returns encrypted values; the single-variable route decrypts them.
                    detail = ensure_ok(
                        await client.get(f"/v1/projects/{project_id}/env/{env['id']}"),
                        "Vercel",
                    )
                    value = detail.json().get("value")
                if value is not None:
                    secrets.append({"key": env["key"], "value": value})
            return secrets

    async def validate_connection(self, config: dict) -> bool:
        """Fetch the configured project, proving token, team and project id together."""
        project_id = self._require(config)
        async with self._client(config) as client:
            ensure_ok(await client.get(f"/v9/projects/{project_id}"), "Vercel")
        return True

    def get_environments(self, config: dict) -> list[str]:
        """Return Vercel's standard environments."""
        return list(VERCEL_TARGETS)
