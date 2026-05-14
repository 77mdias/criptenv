"""Shared test fixtures for CriptEnv CLI tests."""

import pytest
import tempfile
from pathlib import Path
from contextlib import contextmanager

from criptenv.crypto import build_project_vault_config


@pytest.fixture
def temp_dir():
    """Create a temporary directory for test isolation."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def mock_config_dir(temp_dir, monkeypatch):
    """Override CONFIG_DIR and DB_FILE to use a temporary directory.

    Patches both the config module AND the database module since
    database.py imports DB_FILE directly at module level.
    """
    monkeypatch.setattr("criptenv.config.CONFIG_DIR", temp_dir)
    monkeypatch.setattr("criptenv.config.DB_FILE", temp_dir / "vault.db")
    monkeypatch.setattr("criptenv.config.CONFIG_FILE", temp_dir / "config.toml")
    monkeypatch.setattr("criptenv.config.AUTH_KEY_FILE", temp_dir / "auth.key")
    # Also patch the local bindings in database.py
    monkeypatch.setattr("criptenv.vault.database.CONFIG_DIR", temp_dir)
    monkeypatch.setattr("criptenv.vault.database.DB_FILE", temp_dir / "vault.db")
    # Also patch the local bindings in doctor.py (imports at module level)
    monkeypatch.setattr("criptenv.commands.doctor.CONFIG_DIR", temp_dir)
    monkeypatch.setattr("criptenv.commands.doctor.DB_FILE", temp_dir / "vault.db")
    monkeypatch.setattr("criptenv.session.AUTH_KEY_FILE", temp_dir / "auth.key")
    return temp_dir


class RemoteVaultFakeClient:
    """Stateful fake API client for remote vault CLI tests."""

    def __init__(self, vault_password: str = "vault-password-123"):
        self.vault_password = vault_password
        self.vault_config, _proof = build_project_vault_config(vault_password)
        self.blobs: list[dict] = []
        self.version = 0
        self.project_id = "prj_123"
        self.environment_id = "env_prod"

    async def get_project(self, project_id: str) -> dict:
        return {
            "id": project_id,
            "name": "Remote Project",
            "vault_config": self.vault_config,
        }

    async def list_environments(self, project_id: str) -> dict:
        return {
            "environments": [
                {
                    "id": self.environment_id,
                    "name": "production",
                    "is_default": True,
                }
            ]
        }

    async def pull_vault(self, project_id: str, env_id: str) -> dict:
        return {"blobs": list(self.blobs), "version": self.version}

    async def push_vault(
        self,
        project_id: str,
        env_id: str,
        blobs: list[dict],
        vault_proof: str | None = None,
        expected_version: int | None = None,
    ) -> dict:
        if expected_version is not None and expected_version != self.version:
            raise AssertionError(f"expected_version={expected_version}, current={self.version}")

        self.version += 1
        self.blobs = [
            {
                **blob,
                "id": f"blob_{index}",
                "project_id": project_id,
                "environment_id": env_id,
                "version": self.version,
                "created_at": "2026-05-14T10:00:00Z",
                "updated_at": "2026-05-14T10:00:00Z",
            }
            for index, blob in enumerate(blobs)
        ]
        return {"blobs": list(self.blobs), "version": self.version}


@pytest.fixture
def remote_vault_client(monkeypatch):
    monkeypatch.setenv("CRIPTENV_VAULT_PASSWORD", "vault-password-123")
    return RemoteVaultFakeClient()


def remote_cli_context_for(client):
    @contextmanager
    def fake_cli_context(*_args, **_kwargs):
        yield object(), None, client

    return fake_cli_context
