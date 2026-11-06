"""Vercel Integration Provider

Syncs secrets with Vercel project environment variables.
Contract: https://openapi.vercel.sh/ (createProjectEnv, filterProjectEnvs,
getProjectEnv, editProjectEnv, removeProjectEnv, getProject).
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
        """Create or overwrite the secrets for one Vercel target in a single request.

        A secret with an explicit ``kind`` goes as Secret (``sensitive``) or Config
        (``encrypted``). When Vercel already holds that key for this target with the
        other kind, the old record is first taken off this target (PATCH when it also
        covers other targets, DELETE otherwise) and then created again. Secrets
        without ``kind`` keep the pre-kind behaviour: no listing, no conversion.
        """
        project_id = self._require(config)
        self._check_target(environment)
        self.recreated_keys = ()

        payload = [self._env_payload(secret, environment) for secret in secrets]

        async with self._client(config) as client:
            removed: list[str] = []
            explicit = {secret["key"]: secret["kind"] for secret in secrets if secret.get("kind")}
            if explicit:
                conflicts = self._kind_conflicts(await self._list_envs(client, project_id), explicit, environment)
                # Detaching from shared records first: if one is refused, no record was deleted yet.
                for env, others in conflicts:
                    if not others:
                        continue
                    response = await client.patch(f"/v9/projects/{project_id}/env/{env['id']}", json={"target": others})
                    if not response.is_success:
                        raise ProviderError(
                            f"Vercel refused to take {env['key']} off {environment}; that record also covers "
                            f"{', '.join(others)}, so nothing was deleted."
                            + self._removed_note(removed, environment)
                        )
                    removed.append(env["key"])
                for env, others in conflicts:
                    if others:
                        continue
                    response = await client.delete(f"/v9/projects/{project_id}/env/{env['id']}")
                    if not response.is_success:
                        raise ProviderError(
                            f"Vercel refused to delete {env['key']} from {environment}."
                            + self._removed_note(removed, environment)
                        )
                    removed.append(env["key"])

            # upsert=true overwrites existing values instead of answering 409 (same as `vercel env add --force`).
            response = await client.post(
                f"/v10/projects/{project_id}/env",
                params={"upsert": "true"},
                json=payload,
            )
            try:
                ensure_ok(response, "Vercel")
            except ProviderError as exc:
                raise ProviderError(str(exc) + self._removed_note(removed, environment)) from exc

        failed = response.json().get("failed") or []
        if failed:
            failed_keys = [
                item.get("error", {}).get("envVarKey") or item.get("error", {}).get("key", "?") for item in failed
            ]
            details = ", ".join(
                f"{key}: {item.get('error', {}).get('message', 'failed')}" for key, item in zip(failed_keys, failed)
            )
            missing = [key for key in removed if key in failed_keys]
            prefix = f"Removed from Vercel {environment} and not recreated: {', '.join(missing)}. " if missing else ""
            raise ProviderError(f"{prefix}Vercel rejected {len(failed)} variable(s): {details}")
        self.recreated_keys = tuple(removed)
        return True

    @staticmethod
    def _env_payload(secret: dict, environment: str) -> dict:
        item = {"key": secret["key"], "value": secret["value"], "type": "encrypted", "target": [environment]}
        if secret.get("kind") == "secret":
            item.update(type="sensitive", visibility="secret")
        elif secret.get("kind") == "config":
            item["visibility"] = "config"
        return item

    @staticmethod
    def _targets(env: dict) -> list[str]:
        target = env.get("target") or []
        return [target] if isinstance(target, str) else list(target)

    @classmethod
    def _kind_conflicts(cls, envs: list[dict], kinds: dict[str, str], environment: str) -> list[tuple[dict, list[str]]]:
        """Records holding a pushed key on this target with the other kind, with their remaining targets."""
        conflicts = []
        for env in envs:
            key = env.get("key")
            targets = cls._targets(env)
            if key not in kinds or environment not in targets or env.get("gitBranch"):
                continue
            if (env.get("type") == "sensitive") != (kinds[key] == "secret"):
                conflicts.append((env, [t for t in targets if t != environment]))
        return conflicts

    @staticmethod
    def _removed_note(removed: list[str], environment: str) -> str:
        if not removed:
            return ""
        return f" Removed from Vercel {environment} and not recreated: {', '.join(removed)}."

    async def _list_envs(self, client: httpx.AsyncClient, project_id: str) -> list[dict]:
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
                return envs
            if next_cursor == params.get("until"):
                raise ProviderError("Vercel repeated a page; listing aborted to avoid a partial result")
            params = {"until": next_cursor}

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
            envs = await self._list_envs(client, project_id)

            secrets = []
            for env in envs:
                targets = self._targets(env)
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
