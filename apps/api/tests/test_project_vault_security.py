from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.database import get_db
from app.middleware.auth import get_current_user
from app.routers.vault import router as vault_router
from app.schemas.project import ProjectCreate, ProjectResponse
from app.services.vault_service import ConflictError


def make_vault_settings(proof_hash: str = "hashed-proof") -> dict:
    return {
        "vault": {
            "version": 1,
            "kdf": "PBKDF2-SHA256",
            "iterations": 100000,
            "salt": "project-salt",
            "proof_salt": "proof-salt",
            "verifier_iv": "iv",
            "verifier_ciphertext": "ciphertext",
            "verifier_auth_tag": "tag",
            "proof_hash": proof_hash,
        }
    }


def make_project():
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=uuid4(),
        owner_id=uuid4(),
        name="Vault Project",
        slug="vault-project",
        description=None,
        encryption_key_id=None,
        settings=make_vault_settings(),
        archived=False,
        created_at=now,
        updated_at=now,
    )


def make_vault_config() -> dict:
    config = dict(make_vault_settings()["vault"])
    config.pop("proof_hash")
    return config


def test_project_response_sanitizes_vault_proof_hash():
    response = ProjectResponse.from_project(make_project())

    assert response.vault_config.model_dump() == make_vault_config()
    assert response.settings is None or response.settings.get("vault", {}).get("proof_hash") is None
    assert "proof_hash" not in response.model_dump_json()


def test_project_create_requires_vault_config_and_proof():
    with pytest.raises(ValidationError):
        ProjectCreate(name="Missing Vault")


async def fake_db():
    yield object()


@pytest.mark.asyncio
async def test_vault_push_rejects_project_v1_without_proof():
    app = FastAPI()
    app.include_router(vault_router)
    user = SimpleNamespace(id=uuid4(), email="dev@example.com")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = fake_db

    payload = {
        "blobs": [
            {
                "key_id": "API_KEY",
                "iv": "iv",
                "ciphertext": "ciphertext",
                "auth_tag": "tag",
                "checksum": "checksum",
                "version": 1,
            }
        ]
    }

    with patch("app.services.project_service.ProjectService.check_user_access", new_callable=AsyncMock) as access:
        access.return_value = MagicMock(role="developer")
        with patch("app.services.project_service.ProjectService.get_project", new_callable=AsyncMock) as get_project:
            get_project.return_value = make_project()
            with patch("app.services.vault_service.VaultService.push_blobs", new_callable=AsyncMock) as push:
                push.return_value = ([], False)

                async with AsyncClient(
                    transport=ASGITransport(app=app),
                    base_url="http://test",
                ) as client:
                    response = await client.post(
                        f"/api/v1/projects/{uuid4()}/environments/{uuid4()}/vault/push",
                        json=payload,
                    )

    assert response.status_code == 403
    assert push.await_count == 0


@pytest.mark.asyncio
async def test_vault_push_passes_expected_version_to_service():
    app = FastAPI()
    app.include_router(vault_router)
    user = SimpleNamespace(id=uuid4(), email="dev@example.com")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = fake_db

    payload = {
        "vault_proof": "proof",
        "expected_version": 3,
        "blobs": [
            {
                "key_id": "API_KEY",
                "iv": "iv",
                "ciphertext": "ciphertext",
                "auth_tag": "tag",
                "checksum": "checksum",
                "version": 1,
            }
        ],
    }

    with patch("app.services.project_service.ProjectService.check_user_access", new_callable=AsyncMock) as access:
        access.return_value = MagicMock(role="developer")
        with patch("app.services.project_service.ProjectService.get_project", new_callable=AsyncMock) as get_project:
            get_project.return_value = make_project()
            with patch("app.services.project_service.ProjectService.verify_vault_proof", return_value=True):
                with patch("app.services.vault_service.VaultService.push_blobs", new_callable=AsyncMock) as push:
                    push.return_value = ([], False)
                    with patch("app.services.vault_service.VaultService.get_environment_version", new_callable=AsyncMock) as version:
                        version.return_value = 4
                        with patch("app.services.audit_service.AuditService.log", new_callable=AsyncMock):
                            async with AsyncClient(
                                transport=ASGITransport(app=app),
                                base_url="http://test",
                            ) as client:
                                response = await client.post(
                                    f"/api/v1/projects/{uuid4()}/environments/{uuid4()}/vault/push",
                                    json=payload,
                                )

    assert response.status_code == 201
    assert push.await_args.kwargs["expected_version"] == 3


@pytest.mark.asyncio
async def test_vault_push_returns_409_for_expected_version_conflict():
    app = FastAPI()
    app.include_router(vault_router)
    user = SimpleNamespace(id=uuid4(), email="dev@example.com")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = fake_db

    payload = {
        "vault_proof": "proof",
        "expected_version": 2,
        "blobs": [
            {
                "key_id": "API_KEY",
                "iv": "iv",
                "ciphertext": "ciphertext",
                "auth_tag": "tag",
                "checksum": "checksum",
                "version": 1,
            }
        ],
    }

    with patch("app.services.project_service.ProjectService.check_user_access", new_callable=AsyncMock) as access:
        access.return_value = MagicMock(role="developer")
        with patch("app.services.project_service.ProjectService.get_project", new_callable=AsyncMock) as get_project:
            get_project.return_value = make_project()
            with patch("app.services.project_service.ProjectService.verify_vault_proof", return_value=True):
                with patch("app.services.vault_service.VaultService.push_blobs", new_callable=AsyncMock) as push:
                    push.side_effect = ConflictError(current_version=3, expected_version=2)
                    async with AsyncClient(
                        transport=ASGITransport(app=app),
                        base_url="http://test",
                    ) as client:
                        response = await client.post(
                            f"/api/v1/projects/{uuid4()}/environments/{uuid4()}/vault/push",
                            json=payload,
                        )

    assert response.status_code == 409
    assert response.json()["detail"]["current_version"] == 3
    assert response.json()["detail"]["expected_version"] == 2
