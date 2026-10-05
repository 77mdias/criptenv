"""Concurrency regression tests for vault optimistic concurrency (Sprint 2).

The old read-then-write version check allowed two concurrent pushes with the
same ``expected_version`` to both succeed (silent lost update). The atomic
conditional UPDATE added in this sprint guarantees exactly one winner.
Rotation must also bump ``environments.secrets_version`` and honour
``expected_version`` (audit P1 #3/#4, 2026-10).
"""

import asyncio
from uuid import uuid4

import pytest
import pytest_asyncio

pytest.importorskip("aiosqlite")

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import CITEXT, JSONB, UUID as PG_UUID
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.database import Base
from app.models.project import Project
from app.models.environment import Environment
from app.services.vault_service import VaultService, ConflictError


@compiles(CITEXT, "sqlite")
def _citext(element, compiler, **kw):
    return "TEXT"


@compiles(JSONB, "sqlite")
def _jsonb(element, compiler, **kw):
    return "JSON"


@compiles(PG_UUID, "sqlite")
def _uuid(element, compiler, **kw):
    return "CHAR(32)"


@pytest_asyncio.fixture
async def session_factory(tmp_path):
    # File-based DB: each session gets its own connection, so transactions
    # from concurrent writers truly interleave (in-memory StaticPool would
    # serialize them on a single connection, where a rollback in one session
    # wipes the other's in-flight writes).
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/vault.db")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    yield factory
    await engine.dispose()


@pytest_asyncio.fixture
async def seeded_env(session_factory):
    async with session_factory() as db:
        project = Project(id=uuid4(), name="p", slug=f"p-{uuid4().hex[:8]}", owner_id=uuid4())
        environment = Environment(
            id=uuid4(),
            project_id=project.id,
            name="production",
            secrets_version=3,
        )
        db.add_all([project, environment])
        await db.commit()
        return project.id, environment.id


async def _push(factory, project_id, environment_id, expected_version, ciphertext):
    async with factory() as db:
        service = VaultService(db)
        blobs, _ = await service.push_blobs(
            project_id,
            environment_id,
            [{"key_id": "API_KEY", "iv": "iv", "ciphertext": ciphertext, "auth_tag": "tag", "checksum": "0" * 64, "version": 1}],
            expected_version=expected_version,
        )
        await db.commit()
        return blobs


@pytest.mark.asyncio
async def test_concurrent_push_only_one_wins(session_factory, seeded_env):
    project_id, environment_id = seeded_env

    results = await asyncio.gather(
        _push(session_factory, project_id, environment_id, 3, "writer-A"),
        _push(session_factory, project_id, environment_id, 3, "writer-B"),
        return_exceptions=True,
    )

    winners = [r for r in results if not isinstance(r, Exception)]
    losers = [r for r in results if isinstance(r, ConflictError)]
    other_errors = [
        r for r in results if isinstance(r, Exception) and not isinstance(r, ConflictError)
    ]

    assert len(winners) == 1, f"exactly one writer must win, got {results}"
    assert len(losers) == 1, "the loser must receive a ConflictError (409)"
    assert not other_errors

    # Final version advanced exactly once
    async with session_factory() as db:
        env = (await db.execute(select(Environment).where(Environment.id == environment_id))).scalar_one()
        assert env.secrets_version == 4


@pytest.mark.asyncio
async def test_stale_expected_version_rejected(session_factory, seeded_env):
    project_id, environment_id = seeded_env

    await _push(session_factory, project_id, environment_id, 3, "writer-A")

    with pytest.raises(ConflictError):
        await _push(session_factory, project_id, environment_id, 3, "late-writer")


@pytest.mark.asyncio
async def test_rotation_bumps_secrets_version_and_honours_expected(session_factory, seeded_env):
    from app.models.vault import VaultBlob
    from app.schemas.secret_expiration import RotationRequest
    from app.services.rotation_service import RotationService

    project_id, environment_id = seeded_env

    async with session_factory() as db:
        db.add(VaultBlob(
            id=uuid4(),
            project_id=project_id,
            environment_id=environment_id,
            key_id="API_KEY",
            iv="iv",
            ciphertext="old",
            auth_tag="tag",
            version=1,
            checksum="0" * 64,
        ))
        await db.commit()

    async with session_factory() as db:
        service = RotationService(db)
        rotation, new_version = await service.rotate_secret(
            project_id,
            environment_id,
            "API_KEY",
            RotationRequest(new_value="new", iv="iv2", auth_tag="tag2", reason="test", expected_version=3),
            user_id=uuid4(),
        )
        await db.commit()
        assert new_version == 2  # blob version

        env = (await db.execute(select(Environment).where(Environment.id == environment_id))).scalar_one()
        assert env.secrets_version == 4  # bumped from 3

    # Stale expected_version must now conflict
    async with session_factory() as db:
        service = RotationService(db)
        with pytest.raises(Exception) as exc_info:
            await service.rotate_secret(
                project_id,
                environment_id,
                "API_KEY",
                RotationRequest(new_value="newer", iv="iv3", auth_tag="tag3", reason="retry", expected_version=3),
                user_id=uuid4(),
            )
        assert hasattr(exc_info.value, "status_code") and exc_info.value.status_code == 409
