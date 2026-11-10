"""Integration Service

Business logic for managing external service integrations.
"""

from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.crypto.integration_config import (
    IntegrationConfigEncryption,
    IntegrationConfigEncryptionError,
)
from app.models.environment import Environment
from app.models.integration import Integration
from app.strategies.integrations.base import ProviderError, get_provider, list_providers


# A deploy fires this long after the last push, so a burst of saves is one deploy.
DEPLOY_DEBOUNCE = timedelta(seconds=60)


class IntegrationConfigError(ValueError):
    """The requested provider or its config is invalid (maps to HTTP 422)."""


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
        return sanitized[:1000]

    def _encrypt_config(self, config: dict) -> dict:
        """Encrypt provider config before persistence."""
        return IntegrationConfigEncryption.encrypt(
            config,
            settings.INTEGRATION_CONFIG_SECRET,
        )

    def _decrypt_config_for_use(self, integration: Integration) -> tuple[dict, bool]:
        """Return provider config and upgrade legacy plaintext config if needed."""
        config = IntegrationConfigEncryption.decrypt_legacy_or_encrypted(
            integration.config,
            settings.INTEGRATION_CONFIG_SECRET,
        )
        if IntegrationConfigEncryption.is_encrypted(integration.config):
            return config, False

        integration.config = self._encrypt_config(config)
        return config, True

    def _clean_config(self, provider: str, config: dict) -> dict:
        """Reject unknown providers and missing config keys before anything is stored."""
        provider_impl = self._get_provider(provider)
        if not provider_impl:
            raise IntegrationConfigError(
                f"Unsupported provider '{provider}'. Available: {', '.join(list_providers())}"
            )

        cleaned = {key: value for key, value in config.items() if value not in (None, "")}
        missing = [
            key for key in provider_impl.required_config
            if not isinstance(cleaned.get(key), str) or not cleaned[key].strip()
        ]
        if missing:
            raise IntegrationConfigError(
                f"{provider} config requires: {', '.join(missing)}"
            )
        return cleaned

    async def create_integration(
        self,
        project_id: UUID,
        provider: str,
        name: str,
        config: dict,
        redeploy: bool = False,
    ) -> Integration:
        """Create a new integration.

        Raises:
            IntegrationConfigError: unknown provider or missing required config.
        """
        integration = Integration(
            project_id=project_id,
            provider=provider,
            name=name,
            config=self._encrypt_config(self._clean_config(provider, config)),
            status="active",
            redeploy=redeploy,
        )

        self.db.add(integration)
        await self.db.flush()
        await self.db.refresh(integration)

        return integration

    async def get_integration(
        self, integration_id: UUID, *, project_id: UUID
    ) -> Optional[Integration]:
        """Get an integration by ID, scoped to its owning project.

        The project scope is a required keyword argument on purpose: resolving an
        integration by primary key alone would let a caller who legitimately
        administers one project operate on another tenant's integration.
        """
        result = await self.db.execute(
            select(Integration).where(
                Integration.id == integration_id,
                Integration.project_id == project_id,
            )
        )
        return result.scalar_one_or_none()

    async def update_settings(
        self,
        integration_id: UUID,
        *,
        project_id: UUID,
        auto_sync_targets: Optional[dict[str, str]] = None,
        redeploy: Optional[bool] = None,
    ) -> Optional[Integration]:
        """Set the auto-sync binding ({environment id: provider target}) and the deploy option.

        ``None`` leaves a field as it is. Plan checks belong to the caller.

        Raises:
            IntegrationConfigError: a key is not a live environment of the project,
                or a target is not one the provider accepts.
        """
        integration = await self.get_integration(integration_id, project_id=project_id)
        if not integration:
            return None

        if auto_sync_targets:
            provider = self._get_provider(integration.provider)
            config, _ = self._decrypt_config_for_use(integration)
            allowed = provider.get_environments(config) if provider else []
            unknown = sorted(set(auto_sync_targets.values()) - set(allowed))
            if unknown:
                raise IntegrationConfigError(
                    f"{integration.provider} target must be one of {', '.join(allowed)}, got '{unknown[0]}'"
                )
            live = await self.db.execute(
                select(Environment.id).where(
                    Environment.project_id == project_id, Environment.archived.is_(False)
                )
            )
            live_ids = {str(environment_id) for environment_id in live.scalars()}
            if not set(auto_sync_targets) <= live_ids:
                raise IntegrationConfigError("auto_sync_targets must name environments of this project")

        if auto_sync_targets is not None:
            integration.auto_sync_targets = dict(auto_sync_targets)
        if redeploy is not None:
            integration.redeploy = redeploy
        await self.db.flush()
        return integration

    async def list_integrations(self, project_id: UUID) -> list[Integration]:
        """List all integrations for a project."""
        result = await self.db.execute(
            select(Integration)
            .where(Integration.project_id == project_id)
            .order_by(Integration.created_at.desc())
        )
        return list(result.scalars().all())

    async def delete_integration(
        self, integration_id: UUID, *, project_id: UUID
    ) -> bool:
        """Delete an integration scoped to ``project_id``.

        Returns:
            True if deleted, False if not found
        """
        integration = await self.get_integration(
            integration_id, project_id=project_id
        )
        if not integration:
            return False

        await self.db.delete(integration)
        return True

    async def _record_failure(self, integration: Integration, error: Exception) -> str:
        """Persist a redacted error on the integration and return it."""
        if isinstance(error, IntegrationConfigEncryptionError):
            message = str(error)
        elif isinstance(error, httpx.HTTPError):
            # httpx network errors often have an empty str(); name the failure instead.
            message = f"Could not reach {integration.provider}: {type(error).__name__}"
        else:
            try:
                config = IntegrationConfigEncryption.decrypt_legacy_or_encrypted(
                    integration.config,
                    settings.INTEGRATION_CONFIG_SECRET,
                )
            except IntegrationConfigEncryptionError:
                config = None
            message = self._sanitize_error(str(error) or type(error).__name__, config)
        integration.status = "error"
        integration.last_error = message
        await self.db.flush()
        return message

    async def validate_integration(
        self, integration_id: UUID, *, project_id: UUID
    ) -> tuple[bool, Optional[str]]:
        """Validate an integration by testing provider connection.

        Returns:
            (is_valid, error_message)
        """
        integration = await self.get_integration(
            integration_id, project_id=project_id
        )
        if not integration:
            return False, "Integration not found"

        provider = self._get_provider(integration.provider)
        if not provider:
            return False, f"Unknown provider: {integration.provider}"

        try:
            config, _ = self._decrypt_config_for_use(integration)
            is_valid = await provider.validate_connection(config)
        except (IntegrationConfigEncryptionError, ProviderError, ValueError, httpx.HTTPError) as e:
            return False, await self._record_failure(integration, e)

        if is_valid:
            integration.status = "active"
            integration.last_error = None
        else:
            integration.status = "error"
            integration.last_error = "Connection validation failed"

        await self.db.flush()
        return is_valid, None if is_valid else "Connection validation failed"

    async def sync_integration(
        self,
        integration_id: UUID,
        *,
        project_id: UUID,
        direction: str,  # "push" or "pull"
        secrets: Optional[list[dict]] = None,
        environment: str = "production",
        delete_keys: Optional[list[str]] = None,
    ) -> tuple[bool, Optional[str], list[dict]]:
        """Sync secrets with an integration owned by ``project_id``.

        Args:
            integration_id: Integration UUID
            project_id: Owning project UUID (mandatory tenant scope)
            direction: "push" (criptenv -> provider) or "pull" (provider -> criptenv)
            secrets: For push, list of {key, value, kind?} dicts. For pull, ignored.
            environment: Target/source environment in the provider
            delete_keys: For push, keys to remove from the provider (never a full
                mirror: only what the caller names). A key also in ``secrets`` is kept.

        Returns:
            (success, error_message, result). On pull, ``result`` holds the
            plaintext values read from the provider; the caller encrypts them
            client-side before they reach the vault. On push, it lists the keys
            the provider removed and created again with another kind.
        """
        integration = await self.get_integration(
            integration_id, project_id=project_id
        )
        if not integration:
            return False, "Integration not found", []

        provider = self._get_provider(integration.provider)
        if not provider:
            return False, f"Unknown provider: {integration.provider}", []

        delete_keys = self.keys_to_delete(secrets, delete_keys)
        if direction == "push" and not secrets and not delete_keys:
            return False, "No secrets provided for push", []
        if direction == "pull" and not provider.supports_pull:
            return False, f"{integration.provider} does not support pull", []
        if direction not in ("push", "pull"):
            return False, f"Invalid direction: {direction}", []

        try:
            config, _ = self._decrypt_config_for_use(integration)
            if direction == "push":
                if secrets and await provider.push_secrets(secrets, config, environment) is False:
                    raise ProviderError("Sync failed: push")
                pulled: list = list(provider.recreated_keys)
                if delete_keys:
                    await provider.delete_secrets(delete_keys, config, environment)
            else:
                pulled = await provider.pull_secrets(config, environment)
        except Exception as e:
            return False, await self._record_failure(integration, e), []

        integration.last_sync_at = datetime.now(timezone.utc)
        integration.last_error = None
        integration.status = "active"
        await self.db.flush()
        return True, None, pulled

    @staticmethod
    def keys_to_delete(secrets: Optional[list[dict]], delete_keys: Optional[list[str]]) -> list[str]:
        """The keys a push removes from the provider: a key being pushed is never deleted."""
        pushed = {secret["key"] for secret in secrets or []}
        return [key for key in dict.fromkeys(delete_keys or []) if key not in pushed]

    async def schedule_deploy(self, integration_id: UUID, *, project_id: UUID, environment: str) -> bool:
        """Ask for a deploy DEPLOY_DEBOUNCE from now; a later push moves it instead of adding one.

        False (nothing scheduled) when the integration has the option off or the
        provider needs no deploy for this target. Plan checks belong to the caller.
        """
        integration = await self.get_integration(integration_id, project_id=project_id)
        provider = self._get_provider(integration.provider) if integration else None
        if not provider or not integration.redeploy or not provider.deploys_on(environment):
            return False
        integration.deploy_due_at = datetime.now(timezone.utc) + DEPLOY_DEBOUNCE
        await self.db.flush()
        return True

    def get_available_providers(self) -> list[str]:
        """Get list of registered provider names."""
        return list_providers()
