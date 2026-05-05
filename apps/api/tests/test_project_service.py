import asyncio
from uuid import uuid4

from app.schemas.project import ProjectVaultConfig
from app.services.project_service import ProjectService, _generate_slug


class FakeResult:
    def __init__(self, value=None):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeDb:
    def __init__(self, execute_results=None):
        self.execute_results = list(execute_results or [])
        self.added = []
        self.flushed = 0

    async def execute(self, query):
        if self.execute_results:
            return self.execute_results.pop(0)
        return FakeResult(None)

    def add(self, value):
        self.added.append(value)

    async def flush(self):
        self.flushed += 1


def run(coro):
    return asyncio.run(coro)


def vault_config() -> ProjectVaultConfig:
    return ProjectVaultConfig(
        version=1,
        kdf="PBKDF2-SHA256",
        iterations=100000,
        salt="project-salt",
        proof_salt="proof-salt",
        verifier_iv="iv",
        verifier_ciphertext="ciphertext",
        verifier_auth_tag="tag",
    )


def test_generate_slug_falls_back_when_slug_is_too_short():
    assert _generate_slug("A") == "project"


def test_generate_slug_collapses_separators_and_trims_edges():
    assert _generate_slug("  My___Project!!! Name  ") == "my-project-name"


def test_create_project_normalizes_explicit_slug():
    db = FakeDb()
    service = ProjectService(db)

    project = run(
        service.create_project(
            owner_id=uuid4(),
            name="Project Name",
            slug="  My Custom Slug!!!  ",
            vault_config=vault_config(),
            vault_proof="proof",
        )
    )

    assert project.slug == "my-custom-slug"
    assert "proof_hash" in project.settings["vault"]
