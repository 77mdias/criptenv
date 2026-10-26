"""Audit log responses carry the actor and the auth origin (UX.1).

The web feed shows "who did what" without one users request per row, and
CI-session actions (logged with user_id = None) are labelled as CI.
"""

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
import pytest_asyncio

pytest.importorskip("aiosqlite")

from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.dialects.postgresql import CITEXT, JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import app
from app.database import Base, get_db
from app.middleware.auth import get_current_user
from app.models.audit import AuditLog
from app.models.user import User


@compiles(CITEXT, "sqlite")
def _compile_citext_sqlite(element, compiler, **kw):
    return "TEXT"


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(element, compiler, **kw):
    return "JSON"


@pytest_asyncio.fixture
async def engine():
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def seeded(engine):
    factory = async_sessionmaker(engine, expire_on_commit=False)
    project_id = uuid4()
    user = User(
        id=uuid4(),
        email="ana@example.com",
        name="Ana",
        password_hash="",
        kdf_salt="salt",
        email_verified=True,
        avatar_url="https://cdn.example.com/ana.png",
    )
    async with factory() as db:
        db.add(user)
        db.add_all([
            AuditLog(id=uuid4(), user_id=user.id, project_id=project_id,
                     action="project.created", resource_type="project", meta={}),
            AuditLog(id=uuid4(), user_id=user.id, project_id=project_id,
                     action="vault.pushed", resource_type="vault", meta={"auth_type": "session"}),
            AuditLog(id=uuid4(), user_id=None, project_id=project_id,
                     action="vault.pushed", resource_type="vault",
                     meta={"auth_type": "ci_session", "ci_token_id": str(uuid4())}),
        ])
        await db.commit()
    return factory, project_id, user


@pytest.mark.asyncio
async def test_audit_logs_include_actor_and_auth_type(engine, seeded):
    factory, project_id, user = seeded
    users_queries = []

    @event.listens_for(engine.sync_engine, "before_cursor_execute")
    def _count(conn, cursor, statement, params, context, executemany):
        if "FROM users" in statement:
            users_queries.append(statement)

    async def _get_db():
        async with factory() as db:
            yield db

    current = MagicMock(id=user.id)
    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_user] = lambda: current
    try:
        with patch(
            "app.services.project_service.ProjectService.check_user_access",
            new_callable=AsyncMock,
            return_value=MagicMock(role="owner"),
        ):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.get(
                    f"/api/v1/projects/{project_id}/audit",
                    headers={"Authorization": "Bearer test"},
                )
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200, response.text
    logs = response.json()["logs"]
    assert len(logs) == 3

    by_user = [log for log in logs if log["user_id"]]
    assert all(log["actor"] == {
        "id": str(user.id),
        "name": "Ana",
        "email": "ana@example.com",
        "avatar_url": "https://cdn.example.com/ana.png",
    } for log in by_user)
    assert all(log["auth_type"] == "session" for log in by_user)

    ci_log = next(log for log in logs if log["user_id"] is None)
    assert ci_log["actor"] is None
    assert ci_log["auth_type"] == "ci_session"

    # Actors resolved in a single users query for the whole page (no N+1)
    assert len(users_queries) == 1
