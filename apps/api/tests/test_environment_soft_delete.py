import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.routers.environments import delete_environment, get_environment, list_environments
from app.services.audit_service import AuditService
from app.services.project_service import ProjectService
from app.services.vault_service import VaultService


class FakeScalarResult:
    def __init__(self, value=None):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeListResult:
    def __init__(self, values):
        self.values = values

    def scalars(self):
        return self

    def all(self):
        return self.values


class FakeDb:
    def __init__(self, execute_results=None):
        self.execute_results = list(execute_results or [])
        self.deleted = []
        self.flushed = False
        self.refreshed = []

    async def execute(self, query):
        if self.execute_results:
            return self.execute_results.pop(0)
        return FakeScalarResult(None)

    async def delete(self, value):
        self.deleted.append(value)

    async def flush(self):
        self.flushed = True

    async def refresh(self, value):
        self.refreshed.append(value)


def run(coro):
    return asyncio.run(coro)


def make_user():
    return SimpleNamespace(id=uuid4(), email="dev@example.com")


def make_request():
    return SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), headers={"User-Agent": "pytest"})


def make_environment(**overrides):
    now = datetime.now(timezone.utc)
    values = {
        "id": uuid4(),
        "project_id": uuid4(),
        "name": "staging",
        "display_name": "Staging",
        "is_default": False,
        "secrets_version": 2,
        "created_at": now,
        "updated_at": now,
        "archived": False,
        "archived_at": None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


@pytest.fixture(autouse=True)
def allow_project_access(monkeypatch):
    async def fake_check_user_access(self, user_id, project_id, required_role=None):
        return object()

    async def fake_log(self, **kwargs):
        return None

    monkeypatch.setattr(ProjectService, "check_user_access", fake_check_user_access)
    monkeypatch.setattr(AuditService, "log", fake_log)


def test_delete_environment_archives_instead_of_deleting():
    environment = make_environment()
    db = FakeDb(execute_results=[FakeScalarResult(environment)])

    run(
        delete_environment(
            project_id=str(environment.project_id),
            environment_id=str(environment.id),
            request=make_request(),
            current_user=make_user(),
            db=db,
        )
    )

    assert environment.archived is True
    assert environment.archived_at is not None
    assert db.deleted == []
    assert db.flushed


def test_list_environments_hides_archived_entries():
    active = make_environment(name="production")
    archived = make_environment(name="old", archived=True, archived_at=datetime.now(timezone.utc))
    db = FakeDb(execute_results=[FakeListResult([active, archived])])

    response = run(
        list_environments(
            project_id=str(active.project_id),
            current_user=make_user(),
            db=db,
        )
    )

    assert response.total == 1
    assert [env.name for env in response.environments] == ["production"]


def test_get_environment_returns_404_for_archived_environment():
    environment = make_environment(archived=True, archived_at=datetime.now(timezone.utc))
    db = FakeDb(execute_results=[FakeScalarResult(environment)])

    with pytest.raises(HTTPException) as exc:
        run(
            get_environment(
                project_id=str(environment.project_id),
                environment_id=str(environment.id),
                current_user=make_user(),
                db=db,
            )
        )

    assert exc.value.status_code == 404


def test_vault_service_rejects_archived_environment():
    environment = make_environment(archived=True, archived_at=datetime.now(timezone.utc))
    db = FakeDb(execute_results=[FakeScalarResult(environment), FakeListResult([])])
    service = VaultService(db)

    with pytest.raises(ValueError, match="Environment not found"):
        run(
            service.pull_blobs(
                project_id=environment.project_id,
                environment_id=environment.id,
            )
        )
