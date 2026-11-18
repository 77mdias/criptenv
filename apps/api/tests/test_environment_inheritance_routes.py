# ruff: noqa: F811
"""Environment inheritance through the HTTP routes: create with a parent and TTL, delete for real,
diff, cleanup of expired children and the plan limit."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app.jobs.environment_cleanup import run_environment_cleanup
from app.models.api_key import APIKey
from app.models.audit import AuditLog
from app.models.environment import Environment
from app.models.member import CIToken, ProjectMember
from app.models.project import Project
from app.models.vault import VaultBlob
from tests.test_restricted_environments import _as, _drop_overrides, _user, seed, world  # noqa: F401  (fixtures)

pytestmark = pytest.mark.asyncio


def _blob(env, key):
    return VaultBlob(id=uuid4(), project_id=env.project_id, environment_id=env.id, key_id=key,
                     iv="iv", ciphertext=f"ct-{key}", auth_tag="tag", version=1, checksum="0" * 64)


async def _create(client, world, **body):
    return await client.post(world.url, json=body)


async def _rows(factory, model, *where):
    async with factory() as db:
        return list(await db.scalars(select(model).where(*where)))


async def test_create_child_with_parent_and_ttl(client, world):
    _as(world.bia)
    dev = world.envs["development"]

    created = await _create(client, world, name="development/wt-x", parent_id=str(dev.id), ttl_seconds=7 * 86400)

    assert created.status_code == 201, created.text
    body = created.json()
    assert body["parent_id"] == str(dev.id) and body["unset_keys"] == []
    expires = datetime.fromisoformat(body["expires_at"]).replace(tzinfo=timezone.utc)  # SQLite drops the zone
    assert timedelta(days=6, hours=23) < expires - datetime.now(timezone.utc) <= timedelta(days=7)


async def test_name_with_slash_is_accepted_but_other_characters_are_not(client, world):
    _as(world.bia)
    assert (await _create(client, world, name="Dev/WT")).status_code == 422
    assert (await _create(client, world, name="dev//wt")).status_code == 422
    assert (await _create(client, world, name="dev/wt")).status_code == 201


async def test_ttl_without_parent_is_refused(client, world):
    _as(world.bia)
    created = await _create(client, world, name="scratch", ttl_seconds=3600)
    assert (created.status_code, created.json()["detail"]) == (422, "Only a child environment (with a parent) can have a TTL")


async def test_parent_from_another_project_or_unknown_is_refused(client, world, seed):
    _as(world.bia)
    other = Project(id=uuid4(), owner_id=world.ana.id, name="Other", slug=f"o-{uuid4().hex[:6]}")
    foreign = Environment(id=uuid4(), project_id=other.id, name="dev")
    await seed(other, foreign)

    for parent in (foreign.id, uuid4()):
        created = await _create(client, world, name="dev/wt", parent_id=str(parent))
        assert (created.status_code, created.json()["detail"]) == (422, "Parent environment not found")


async def test_child_of_restricted_parent_is_restricted(client, world):
    _as(world.bia)
    created = await _create(client, world, name="db-admin/wt", parent_id=str(world.secret.id))
    assert (created.status_code, created.json()["restricted"]) == (201, True)

    opened = await client.patch(f"{world.url}/{created.json()['id']}", json={"restricted": False})
    assert (opened.status_code, opened.json()["detail"]) == (422, "A child of a restricted environment stays restricted")


async def test_restricting_a_parent_with_open_children_is_refused(client, world):
    _as(world.bia)
    dev = world.envs["development"]
    staging = world.envs["staging"]
    await _create(client, world, name="staging/wt", parent_id=str(staging.id))

    refused = await client.patch(f"{world.url}/{staging.id}", json={"restricted": True})
    # staging is seeded and cannot be restricted anyway; use a custom parent for the real check
    assert refused.status_code == 422
    parent = (await _create(client, world, name="qa")).json()
    await _create(client, world, name="qa/wt", parent_id=parent["id"])
    refused = await client.patch(f"{world.url}/{parent['id']}", json={"restricted": True})
    assert refused.status_code == 422 and "child" in refused.json()["detail"]
    assert dev  # seeded envs untouched


async def test_child_cannot_be_default(client, world):
    _as(world.bia)
    dev = world.envs["development"]
    created = await _create(client, world, name="dev/wt", parent_id=str(dev.id), is_default=True)
    assert (created.status_code, created.json()["detail"]) == (422, "A child environment cannot be the project's default")


async def test_developer_cannot_create_a_child(client, world):
    _as(world.caio)
    created = await _create(client, world, name="dev/wt", parent_id=str(world.envs["development"].id))
    assert created.status_code == 404


async def test_delete_child_is_for_real_and_leaves_parent_untouched(client, world, seed, factory):
    _as(world.bia)
    dev = world.envs["development"]
    child = (await _create(client, world, name="development/wt", parent_id=str(dev.id))).json()
    child_env = Environment(id=child["id"])
    token = CIToken(id=uuid4(), project_id=world.project.id, name="wt", token_hash=uuid4().hex,
                    environment_scope="development/wt")
    key = APIKey(id=uuid4(), user_id=world.ana.id, project_id=world.project.id, name="wt", prefix="cek_live_",
                 key_hash=uuid4().hex, environment_scope="development/wt")
    other_token = CIToken(id=uuid4(), project_id=world.project.id, name="dev", token_hash=uuid4().hex,
                          environment_scope="development")
    child_env.project_id = world.project.id
    from uuid import UUID
    child_env.id = UUID(child["id"])
    await seed(_blob(dev, "DATABASE_URL"), _blob(child_env, "PORT"), token, key, other_token)

    deleted = await client.delete(f"{world.url}/{child['id']}")

    assert deleted.status_code == 204
    assert await _rows(factory, Environment, Environment.id == child_env.id) == []
    assert await _rows(factory, VaultBlob, VaultBlob.environment_id == child_env.id) == []
    assert [b.key_id for b in await _rows(factory, VaultBlob, VaultBlob.environment_id == dev.id)] == ["DATABASE_URL"]
    assert (await _rows(factory, CIToken, CIToken.id == token.id))[0].revoked_at is not None
    assert (await _rows(factory, APIKey, APIKey.id == key.id))[0].revoked_at is not None
    assert (await _rows(factory, CIToken, CIToken.id == other_token.id))[0].revoked_at is None
    audit = await _rows(factory, AuditLog, AuditLog.action == "environment.deleted")
    assert audit[0].meta["environment_name"] == "development/wt"

    # The name is free for the next worktree.
    assert (await _create(client, world, name="development/wt", parent_id=str(dev.id))).status_code == 201


async def test_parent_with_live_children_cannot_be_deleted(client, world):
    _as(world.bia)
    parent = (await _create(client, world, name="qa")).json()
    await _create(client, world, name="qa/wt", parent_id=parent["id"])

    refused = await client.delete(f"{world.url}/{parent['id']}")

    assert refused.status_code == 409
    assert (await client.get(f"{world.url}/{parent['id']}")).status_code == 200


async def test_root_environment_delete_still_archives(client, world, factory):
    _as(world.bia)
    created = (await _create(client, world, name="qa")).json()

    assert (await client.delete(f"{world.url}/{created['id']}")).status_code == 204
    rows = await _rows(factory, Environment, Environment.name == "qa")
    assert len(rows) == 1 and rows[0].archived is True


async def test_expired_child_is_gone_before_cleanup_and_its_name_is_free(client, world, seed):
    _as(world.bia)
    dev = world.envs["development"]
    old = Environment(id=uuid4(), project_id=world.project.id, name="development/old", parent_id=dev.id,
                      expires_at=datetime.now(timezone.utc) - timedelta(minutes=1), unset_keys=[])
    await seed(old, _blob(old, "PORT"))

    assert (await client.get(f"{world.url}/{old.id}")).status_code == 404
    assert "development/old" not in [e["name"] for e in (await client.get(world.url)).json()["environments"]]
    assert (await client.get(f"{world.url}/{old.id}/vault/pull")).status_code == 404
    assert (await _create(client, world, name="development/old", parent_id=str(dev.id))).status_code == 201


async def test_cleanup_job_deletes_expired_children_and_audits(world, seed, factory):
    dev = world.envs["development"]
    now = datetime.now(timezone.utc)
    expired = Environment(id=uuid4(), project_id=world.project.id, name="development/a", parent_id=dev.id,
                          expires_at=now - timedelta(hours=1), unset_keys=[])
    below = Environment(id=uuid4(), project_id=world.project.id, name="development/a/b", parent_id=expired.id,
                        expires_at=now - timedelta(hours=1), unset_keys=[])
    alive = Environment(id=uuid4(), project_id=world.project.id, name="development/c", parent_id=dev.id,
                        expires_at=now + timedelta(days=1), unset_keys=[])
    await seed(expired, below, alive, _blob(dev, "DATABASE_URL"), _blob(expired, "PORT"), _blob(below, "X"))

    async with factory() as db:
        assert await run_environment_cleanup(db) == 2

    names = {e.name for e in await _rows(factory, Environment, Environment.project_id == world.project.id)}
    assert "development/a" not in names and "development/a/b" not in names
    assert {"development", "development/c"} <= names
    assert [b.key_id for b in await _rows(factory, VaultBlob, VaultBlob.project_id == world.project.id)] == ["DATABASE_URL"]
    audited = await _rows(factory, AuditLog, AuditLog.action == "environment.expired")
    assert sorted(a.meta["environment_name"] for a in audited) == ["development/a", "development/a/b"]

    async with factory() as db:
        assert await run_environment_cleanup(db) == 0


async def test_ephemeral_children_do_not_count_against_the_plan(client, seed):
    ana = _user(plan=None)  # free: 3 environments per project
    project = Project(id=uuid4(), owner_id=ana.id, name="Free", slug=f"f-{uuid4().hex[:6]}")
    envs = [Environment(id=uuid4(), project_id=project.id, name=n, unset_keys=[])
            for n in ("production", "staging", "development")]
    await seed(ana, project, *envs, ProjectMember(id=uuid4(), project_id=project.id, user_id=ana.id, role="owner"))
    _as(ana)
    url = f"/api/v1/projects/{project.id}/environments"
    dev = envs[2]

    for i in range(4):
        made = await client.post(url, json={"name": f"development/wt-{i}", "parent_id": str(dev.id), "ttl_seconds": 86400})
        assert made.status_code == 201, made.text
    permanent = await client.post(url, json={"name": "development/keep", "parent_id": str(dev.id)})
    assert permanent.status_code == 402, permanent.text  # plan limit reached


async def test_diff_route_lists_names_only(client, world, seed):
    _as(world.caio)  # a developer reads diffs of open environments
    dev = world.envs["development"]
    child = Environment(id=uuid4(), project_id=world.project.id, name="development/wt", parent_id=dev.id,
                        unset_keys=["SENTRY_DSN"])
    await seed(child, _blob(dev, "PORT"), _blob(dev, "SENTRY_DSN"), _blob(child, "PORT"), _blob(child, "NEW"))

    diff = await client.get(f"{world.url}/{child.id}/diff")

    assert diff.status_code == 200
    assert diff.json() == {"environment": "development/wt", "parent": "development", "keys": [
        {"key": "NEW", "status": "added", "source": "development/wt", "parent_source": None},
        {"key": "PORT", "status": "override", "source": "development/wt", "parent_source": "development"},
        {"key": "SENTRY_DSN", "status": "unset", "source": "development", "parent_source": "development"},
    ]}
    assert "ct-" not in diff.text
    assert (await client.get(f"{world.url}/{dev.id}/diff")).status_code == 422


async def test_created_audit_names_the_parent(client, world, factory):
    _as(world.bia)
    dev = world.envs["development"]
    await _create(client, world, name="development/wt", parent_id=str(dev.id), ttl_seconds=3600)

    async with factory() as db:
        meta = (await db.scalar(select(AuditLog).where(AuditLog.action == "environment.created"))).meta
        count = await db.scalar(select(func.count()).select_from(AuditLog))
    assert meta["parent_name"] == "development" and "expires_at" in meta and count == 1


# ─── Fixes from the review ───────────────────────────────────────────────────


async def test_deleting_a_project_with_children_works_with_foreign_keys_on(world, seed, factory):
    from sqlalchemy import text

    from app.services.project_service import ProjectService

    dev = world.envs["development"]
    child = Environment(id=uuid4(), project_id=world.project.id, name="development/wt", parent_id=dev.id, unset_keys=[])
    grandchild = Environment(id=uuid4(), project_id=world.project.id, name="development/wt/x", parent_id=child.id,
                             unset_keys=[])
    await seed(child, grandchild)

    async with factory() as db:
        # SQLite leaves foreign keys off; on, the RESTRICT on parent_id refuses a parent deleted first.
        await db.execute(text("PRAGMA foreign_keys=ON"))  # the in-memory database keeps one connection
        assert (await db.execute(text("PRAGMA foreign_keys"))).scalar() == 1
        assert await ProjectService(db).delete_project(world.project.id)
        await db.commit()

    assert await _rows(factory, Environment, Environment.project_id == world.project.id) == []


async def test_deleting_a_child_ends_open_ci_sessions_scoped_to_it(client, world, seed, factory):
    from app.models.member import CISession

    _as(world.bia)
    dev = world.envs["development"]
    child = (await _create(client, world, name="development/wt", parent_id=str(dev.id))).json()
    token = CIToken(id=uuid4(), project_id=world.project.id, name="wt", token_hash=uuid4().hex,
                    environment_scope="development/wt")
    soon = datetime.now(timezone.utc) + timedelta(hours=1)
    session = CISession(id=uuid4(), token_hash=uuid4().hex, ci_token_id=token.id, project_id=world.project.id,
                        environment_scope="development/wt", expires_at=soon)
    other = CISession(id=uuid4(), token_hash=uuid4().hex, ci_token_id=token.id, project_id=world.project.id,
                      environment_scope="development", expires_at=soon)
    await seed(token, session, other)

    assert (await client.delete(f"{world.url}/{child['id']}")).status_code == 204

    assert await _rows(factory, CISession, CISession.id == session.id) == []
    assert len(await _rows(factory, CISession, CISession.id == other.id)) == 1


async def test_expired_child_is_gone_for_scopes_rotation_and_overview(client, world, seed, db_session):
    from app.services.overview_service import OverviewService
    from app.services.project_service import ProjectService

    _as(world.bia)
    dev = world.envs["development"]
    old = Environment(id=uuid4(), project_id=world.project.id, name="development/old", parent_id=dev.id,
                      expires_at=datetime.now(timezone.utc) - timedelta(minutes=1), unset_keys=[])
    await seed(old, _blob(old, "PORT"))

    assert "development/old" not in await ProjectService(db_session).active_environment_names(world.project.id)
    history = await client.get(f"{world.url}/{old.id}/secrets/PORT/rotation/history")
    assert history.status_code == 404
    matrix = await OverviewService(db_session).get_secret_matrix(world.project.id)
    assert "development/old" not in [env["name"] for env in matrix["environments"]]
