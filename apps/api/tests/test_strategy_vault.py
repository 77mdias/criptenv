import asyncio
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.services.vault_service import ConflictError, VaultService
from app.strategies.vault_push import ReplaceAllVaultBlobsStrategy


class FakeResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeDb:
    def __init__(self, execute_results=None):
        self.execute_results = list(execute_results or [])
        self.executed = []
        self.added = []
        self.flushed = False
        self.refreshed = []

    async def execute(self, query):
        self.executed.append(query)
        if self.execute_results:
            return self.execute_results.pop(0)
        return FakeResult(None)

    def add(self, value):
        self.added.append(value)

    async def flush(self):
        self.flushed = True

    async def refresh(self, value):
        self.refreshed.append(value)


def run(coro):
    return asyncio.run(coro)


def make_blob_data(suffix):
    return {
        "key_id": f"key-{suffix}",
        "iv": f"iv-{suffix}",
        "ciphertext": f"ciphertext-{suffix}",
        "auth_tag": f"auth-{suffix}",
        "checksum": "a" * 64,
    }


def test_replace_all_vault_blobs_strategy_deletes_and_creates_blobs():
    db = FakeDb()
    project_id = uuid4()
    environment_id = uuid4()

    blobs = run(
        ReplaceAllVaultBlobsStrategy().push(
            db=db,
            project_id=project_id,
            environment_id=environment_id,
            blobs=[make_blob_data("one"), make_blob_data("two")],
            version=7,
        )
    )

    assert len(db.executed) == 1
    assert len(db.added) == 2
    assert blobs == db.added
    assert {blob.version for blob in blobs} == {7}
    assert {blob.project_id for blob in blobs} == {project_id}
    assert {blob.environment_id for blob in blobs} == {environment_id}


def test_vault_service_push_uses_replace_all_strategy_and_increments_version():
    environment = SimpleNamespace(secrets_version=2)
    db = FakeDb(execute_results=[FakeResult(environment)])
    service = VaultService(db)

    blobs, conflict = run(
        service.push_blobs(
            project_id=uuid4(),
            environment_id=uuid4(),
            blobs=[make_blob_data("one")],
        )
    )

    assert conflict is False
    assert environment.secrets_version == 3
    assert len(blobs) == 1
    assert blobs[0].version == 3
    assert db.flushed
    assert db.refreshed == blobs


def test_vault_service_preserves_version_conflict_behavior():
    environment = SimpleNamespace(secrets_version=3)
    db = FakeDb(execute_results=[FakeResult(environment)])
    service = VaultService(db)

    with pytest.raises(ConflictError) as exc:
        run(
            service.push_blobs(
                project_id=uuid4(),
                environment_id=uuid4(),
                blobs=[make_blob_data("one")],
                expected_version=2,
            )
        )

    assert exc.value.current_version == 3
    assert exc.value.expected_version == 2

