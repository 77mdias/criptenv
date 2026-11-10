"""The deploy a push asked for fires once, about a minute after the last push.

Real SQLite DB; the provider is a recording double (no HTTP).
"""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.jobs.deploy_due import create_session_scoped_scheduler_job
from app.models.audit import AuditLog
from app.models.integration import Integration
from app.models.project import Project
from app.models.user import User
from app.services.integration_service import IntegrationService
from app.strategies.integrations.base import ProviderError

pytestmark = pytest.mark.asyncio

TOKEN = "vercel-token-123"


class DeployRecorder:
    provider_name = "vercel"
    required_config = ()

    def __init__(self):
        self.deployed: list[str] = []
        self.fail_for: dict[str, str] = {}

    def deploys_on(self, environment):
        return True

    async def trigger_deploy(self, config):
        if config["project_id"] in self.fail_for:
            raise ProviderError(self.fail_for[config["project_id"]])
        self.deployed.append(config["project_id"])


@pytest.fixture
def provider(monkeypatch):
    recorder = DeployRecorder()
    monkeypatch.setattr(IntegrationService, "_get_provider", lambda self, name: recorder)
    return recorder


async def _integration(db, vercel_project="prj_1", due_in=None):
    """A redeploy-on integration of a fresh project, optionally with a deploy due `due_in` from now."""
    owner = User(id=uuid4(), email=f"{uuid4().hex[:8]}@example.com", name="Ana", password_hash="",
                 kdf_salt="salt", email_verified=True, plan="max")
    project = Project(id=uuid4(), owner_id=owner.id, name=f"p-{uuid4().hex[:6]}", slug=f"p-{uuid4().hex[:6]}")
    db.add_all([owner, project])
    await db.flush()
    integration = await IntegrationService(db).create_integration(
        project_id=project.id, provider="vercel", name="conn",
        config={"api_token": TOKEN, "project_id": vercel_project}, redeploy=True,
    )
    if due_in is not None:
        integration.deploy_due_at = datetime.now(timezone.utc) + due_in
        await db.flush()
    return integration


async def test_due_deploy_fires_once_and_clears(db_session, provider):
    integration = await _integration(db_session, due_in=timedelta(seconds=-1))
    service = IntegrationService(db_session)

    assert await service.run_due_deploys() == 1
    assert await service.run_due_deploys() == 0

    assert provider.deployed == ["prj_1"]
    await db_session.refresh(integration)
    assert integration.deploy_due_at is None


async def test_deploy_not_due_yet_waits(db_session, provider):
    integration = await _integration(db_session, due_in=timedelta(seconds=30))

    assert await IntegrationService(db_session).run_due_deploys() == 0

    assert provider.deployed == []
    await db_session.refresh(integration)
    assert integration.deploy_due_at is not None


async def test_ten_pushes_in_a_minute_make_one_deploy(db_session, provider):
    integration = await _integration(db_session)
    service = IntegrationService(db_session)
    for _ in range(10):
        assert await service.schedule_deploy(
            integration.id, project_id=integration.project_id, environment="production"
        ) is True

    assert await service.run_due_deploys() == 0  # still inside the debounce window
    assert await service.run_due_deploys(now=datetime.now(timezone.utc) + timedelta(seconds=61)) == 1
    assert await service.run_due_deploys(now=datetime.now(timezone.utc) + timedelta(seconds=120)) == 0

    assert provider.deployed == ["prj_1"]


async def test_failed_deploy_is_recorded_and_does_not_stop_the_others(db_session, provider):
    broken = await _integration(db_session, "prj_broken", due_in=timedelta(seconds=-2))
    healthy = await _integration(db_session, "prj_ok", due_in=timedelta(seconds=-1))
    provider.fail_for["prj_broken"] = "boom"

    assert await IntegrationService(db_session).run_due_deploys() == 1

    assert provider.deployed == ["prj_ok"]
    await db_session.refresh(broken)
    await db_session.refresh(healthy)
    assert (broken.status, broken.last_error, broken.deploy_due_at) == ("error", "Deploy failed: boom", None)
    assert (healthy.status, healthy.last_error) == ("active", None)


async def test_deploy_error_never_leaks_the_token(db_session, provider):
    integration = await _integration(db_session, due_in=timedelta(seconds=-1))
    provider.fail_for["prj_1"] = f"rejected token {TOKEN}"

    await IntegrationService(db_session).run_due_deploys()

    await db_session.refresh(integration)
    assert integration.last_error == "Deploy failed: rejected token [redacted]"


async def test_fired_deploy_is_audited_without_a_user(db_session, provider):
    integration = await _integration(db_session, due_in=timedelta(seconds=-1))

    await IntegrationService(db_session).run_due_deploys()

    log = (await db_session.execute(
        select(AuditLog).where(AuditLog.action == "integration.deploy_triggered")
    )).scalar_one()
    assert (log.resource_id, log.project_id, log.user_id) == (integration.id, integration.project_id, None)


async def test_scheduler_job_commits_what_it_fired(factory, provider):
    async with factory() as db:
        integration = await _integration(db, due_in=timedelta(seconds=-1))
        await db.commit()

    await create_session_scoped_scheduler_job(factory)()

    assert provider.deployed == ["prj_1"]
    async with factory() as db:
        assert await db.scalar(select(Integration.deploy_due_at).where(Integration.id == integration.id)) is None
