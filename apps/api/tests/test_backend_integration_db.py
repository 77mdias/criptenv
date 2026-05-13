import os
from urllib.parse import urlparse

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

pytestmark = pytest.mark.skipif(
    os.getenv("CRIPTENV_RUN_DB_INTEGRATION") != "1",
    reason="Set CRIPTENV_RUN_DB_INTEGRATION=1 to run database integration tests.",
)


def _assert_safe_database_url() -> None:
    parsed = urlparse(os.environ["DATABASE_URL"])
    assert parsed.hostname in {"localhost", "127.0.0.1"}
    assert "test" in parsed.path.rsplit("/", 1)[-1]


@pytest_asyncio.fixture(autouse=True)
async def reset_database():
    _assert_safe_database_url()

    from app.database import Base, engine
    from app.models import (  # noqa: F401
        APIKey,
        AuditLog,
        CIToken,
        CISession,
        EmailVerificationToken,
        Environment,
        Project,
        ProjectInvite,
        ProjectMember,
        Session,
        User,
        VaultBlob,
    )
    from app.models.integration import Integration  # noqa: F401
    from app.models.oauth_account import OAuthAccount  # noqa: F401
    from app.models.secret_expiration import SecretExpiration, SecretRotation  # noqa: F401

    async with engine.begin() as conn:
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "citext"'))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield

    await engine.dispose()


def vault_payload(name: str = "db-integration"):
    return {
        "name": name,
        "description": "Created by API integration test",
        "vault_config": {
            "version": 1,
            "kdf": "PBKDF2-SHA256",
            "iterations": 100000,
            "salt": "salt",
            "proof_salt": "proof-salt",
            "verifier_iv": "iv",
            "verifier_ciphertext": "ciphertext",
            "verifier_auth_tag": "auth-tag",
        },
        "vault_proof": "proof",
    }


@pytest.mark.asyncio
async def test_signup_create_project_and_default_environments_against_postgres():
    from main import app

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="https://test",
    ) as client:
        signup = await client.post(
            "/api/auth/signup",
            json={
                "email": "db@example.com",
                "password": "Passw0rd!",
                "name": "DB User",
            },
        )
        assert signup.status_code == 201
        # No session cookie after signup — email must be verified first
        assert "session_token" not in signup.cookies

        # Verify email
        verify = await client.post(
            "/api/auth/verify-email",
            json={"token": signup.json()["dev_token"]},
        )
        assert verify.status_code == 200

        # Sign in to get session
        signin = await client.post(
            "/api/auth/signin",
            json={
                "email": "db@example.com",
                "password": "Passw0rd!",
            },
        )
        assert signin.status_code == 200
        assert "session_token" in signin.cookies

        project = await client.post("/api/v1/projects", json=vault_payload())
        assert project.status_code == 201
        project_id = project.json()["id"]

        environments = await client.get(f"/api/v1/projects/{project_id}/environments")
        assert environments.status_code == 200
        assert sorted(env["name"] for env in environments.json()["environments"]) == [
            "development",
            "production",
            "staging",
        ]


@pytest.mark.asyncio
async def test_project_create_requires_vault_proof_against_postgres():
    from main import app

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="https://test",
    ) as client:
        signup = await client.post(
            "/api/auth/signup",
            json={
                "email": "proof@example.com",
                "password": "Passw0rd!",
                "name": "Proof User",
            },
        )
        # Verify email and signin to get session
        await client.post(
            "/api/auth/verify-email",
            json={"token": signup.json()["dev_token"]},
        )
        await client.post(
            "/api/auth/signin",
            json={
                "email": "proof@example.com",
                "password": "Passw0rd!",
            },
        )

        payload = vault_payload("missing-proof")
        payload.pop("vault_proof")

        response = await client.post("/api/v1/projects", json=payload)

        assert response.status_code == 422
