"""Remote zero-knowledge vault helpers for CLI commands."""

from __future__ import annotations

import getpass
import os
from dataclasses import dataclass
from typing import Any

import click

from criptenv.api.client import CriptEnvAPIError
from criptenv.crypto import (
    decrypt,
    derive_project_env_key,
    derive_vault_proof,
    encrypt,
    verify_project_vault_password,
)
from criptenv.crypto.utils import from_base64, to_base64


def get_vault_password() -> str:
    """Read the project vault password from env or an interactive prompt."""
    password = os.getenv("CRIPTENV_VAULT_PASSWORD")
    if password:
        return password
    return getpass.getpass("Vault password: ")


@dataclass
class RemoteEnvironment:
    id: str
    name: str
    is_default: bool = False


@dataclass
class RemoteVaultState:
    project_id: str
    environment: RemoteEnvironment
    blobs: list[dict[str, Any]]
    version: int


class RemoteVault:
    """Read, decrypt, mutate, and write project vault blobs remotely."""

    def __init__(self, client, project_id: str):
        self.client = client
        self.project_id = project_id
        self._project: dict[str, Any] | None = None
        self._vault_config: dict[str, Any] | None = None
        self._vault_password: str | None = None

    async def get_project(self) -> dict[str, Any]:
        if self._project is None:
            self._project = await self.client.get_project(self.project_id)
        return self._project

    async def get_vault_config(self) -> dict[str, Any]:
        if self._vault_config is None:
            project = await self.get_project()
            vault_config = project.get("vault_config")
            if not vault_config:
                raise click.ClickException(
                    "Project does not have vault password configuration."
                )
            self._vault_config = vault_config
        return self._vault_config

    async def unlock(self) -> tuple[dict[str, Any], str]:
        vault_config = await self.get_vault_config()
        if self._vault_password is None:
            password = get_vault_password()
            if not verify_project_vault_password(password, vault_config):
                raise click.ClickException("Invalid vault password.")
            self._vault_password = password
        return vault_config, self._vault_password

    async def vault_proof(self) -> str:
        vault_config, password = await self.unlock()
        return derive_vault_proof(
            password,
            vault_config["proof_salt"],
            int(vault_config.get("iterations", 100000)),
        )

    async def environment_key(self, environment_id: str) -> bytes:
        vault_config, password = await self.unlock()
        return derive_project_env_key(password, vault_config, environment_id)

    async def resolve_environment(
        self, env_name_or_id: str | None
    ) -> RemoteEnvironment:
        response = await self.client.list_environments(self.project_id)
        if isinstance(response, dict):
            environments = response.get("environments", [])
        elif isinstance(response, list):
            environments = response
        else:
            environments = []

        if env_name_or_id:
            for env in environments:
                if env.get("id") == env_name_or_id or env.get("name") == env_name_or_id:
                    return RemoteEnvironment(
                        id=env["id"],
                        name=env.get("name", env["id"]),
                        is_default=bool(env.get("is_default")),
                    )
            raise click.ClickException(
                f"Environment '{env_name_or_id}' not found in project '{self.project_id}'. "
                f"Run 'criptenv env list --project {self.project_id}' to see available environments."
            )

        default_env = next((env for env in environments if env.get("is_default")), None)
        production_env = next((env for env in environments if env.get("name") == "production"), None)
        selected = default_env or production_env or (environments[0] if environments else None)
        if selected and selected.get("id"):
            return RemoteEnvironment(
                id=selected["id"],
                name=selected.get("name", selected["id"]),
                is_default=bool(selected.get("is_default")),
            )

        raise click.ClickException(
            f"No environments found in project '{self.project_id}'. "
            f"Run 'criptenv env create production --project {self.project_id}' first."
        )

    async def load_state(self, env_name_or_id: str | None) -> RemoteVaultState:
        environment = await self.resolve_environment(env_name_or_id)
        result = await self.client.pull_vault(self.project_id, environment.id)
        return RemoteVaultState(
            project_id=self.project_id,
            environment=environment,
            blobs=list(result.get("blobs", [])),
            version=int(result.get("version", 0)),
        )

    async def decrypt_blob(self, blob: dict[str, Any], environment_id: str) -> bytes:
        env_key = await self.environment_key(environment_id)
        return decrypt(
            from_base64(blob["ciphertext"]),
            from_base64(blob["iv"]),
            from_base64(blob["auth_tag"]),
            env_key,
            blob.get("checksum"),
        )

    async def encrypt_blob(
        self,
        key_id: str,
        plaintext: bytes,
        environment_id: str,
        version: int,
    ) -> dict[str, Any]:
        env_key = await self.environment_key(environment_id)
        ciphertext, iv, auth_tag, checksum = encrypt(plaintext, env_key)
        return {
            "key_id": key_id,
            "iv": to_base64(iv),
            "ciphertext": to_base64(ciphertext),
            "auth_tag": to_base64(auth_tag),
            "version": version,
            "checksum": checksum,
        }

    def push_shape(self, blob: dict[str, Any]) -> dict[str, Any]:
        return {
            "key_id": blob["key_id"],
            "iv": blob["iv"],
            "ciphertext": blob["ciphertext"],
            "auth_tag": blob["auth_tag"],
            "version": int(blob.get("version", 1)),
            "checksum": blob["checksum"],
        }

    async def push_state(
        self,
        state: RemoteVaultState,
        blobs: list[dict[str, Any]],
    ) -> dict[str, Any]:
        try:
            return await self.client.push_vault(
                self.project_id,
                state.environment.id,
                [self.push_shape(blob) for blob in blobs],
                vault_proof=await self.vault_proof(),
                expected_version=state.version,
            )
        except CriptEnvAPIError as exc:
            if exc.status_code == 409:
                raise click.ClickException(
                    "Remote vault changed while this command was running. "
                    "Run the command again to apply it on the latest version."
                ) from exc
            raise

    async def decrypt_all(self, state: RemoteVaultState) -> dict[str, str]:
        entries: dict[str, str] = {}
        for blob in state.blobs:
            plaintext = await self.decrypt_blob(blob, state.environment.id)
            entries[blob["key_id"]] = plaintext.decode("utf-8")
        return entries
