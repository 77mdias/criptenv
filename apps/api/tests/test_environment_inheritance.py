"""Environment inheritance: resolution of a child through its parents (service level).

Blobs here carry fake ciphertext: resolution works on key names only, values are never looked at.
"""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.config import settings
from app.models.environment import Environment
from app.models.project import Project
from app.models.user import User
from app.models.vault import VaultBlob
from app.services.environment_inheritance import (
    InheritanceError, diff_with_parent, is_gone, load_chain, plan_child, resolve,
)

pytestmark = pytest.mark.asyncio


async def _project(db):
    owner = User(id=uuid4(), email=f"{uuid4().hex[:8]}@example.com", name="Ana", password_hash="",
                 kdf_salt="salt", email_verified=True)
    project = Project(id=uuid4(), owner_id=owner.id, name="App", slug=f"app-{uuid4().hex[:6]}")
    db.add_all([owner, project])
    await db.flush()
    return project


async def _env(db, project, name, parent=None, **fields):
    env = Environment(id=uuid4(), project_id=project.id, name=name,
                      parent_id=parent.id if parent else None, unset_keys=fields.pop("unset_keys", []), **fields)
    db.add(env)
    await db.flush()
    return env


async def _set(db, env, *keys):
    for key in keys:
        db.add(VaultBlob(id=uuid4(), project_id=env.project_id, environment_id=env.id, key_id=key,
                         iv="iv", ciphertext=f"ct-{env.name}-{key}", auth_tag="tag", version=1, checksum="0" * 64))
    await db.flush()


async def _view(db, env):
    resolved = await resolve(db, await load_chain(db, env))
    return {key: entry.source.name for key, entry in resolved.items()}


async def test_child_without_overrides_sees_parent(db_session):
    project = await _project(db_session)
    dev = await _env(db_session, project, "dev")
    child = await _env(db_session, project, "dev/wt-x", parent=dev)
    await _set(db_session, dev, "DATABASE_URL", "PORT")

    assert await _view(db_session, child) == {"DATABASE_URL": "dev", "PORT": "dev"}


async def test_child_override_beats_parent_and_marks_origin(db_session):
    project = await _project(db_session)
    dev = await _env(db_session, project, "dev")
    child = await _env(db_session, project, "dev/wt-x", parent=dev)
    await _set(db_session, dev, "DATABASE_URL", "PORT")
    await _set(db_session, child, "PORT", "WEBHOOK_SECRET")

    resolved = await resolve(db_session, await load_chain(db_session, child))

    assert {k: (e.source.name, e.inherited) for k, e in resolved.items()} == {
        "DATABASE_URL": ("dev", True), "PORT": ("dev/wt-x", False), "WEBHOOK_SECRET": ("dev/wt-x", False),
    }
    assert resolved["PORT"].blob.ciphertext == "ct-dev/wt-x-PORT"


async def test_three_levels_nearest_wins(db_session):
    project = await _project(db_session)
    dev = await _env(db_session, project, "dev")
    mid = await _env(db_session, project, "dev/a", parent=dev)
    leaf = await _env(db_session, project, "dev/a/b", parent=mid)
    await _set(db_session, dev, "A", "B", "C")
    await _set(db_session, mid, "B", "C")
    await _set(db_session, leaf, "C")

    assert await _view(db_session, leaf) == {"A": "dev", "B": "dev/a", "C": "dev/a/b"}


async def test_unset_hides_inherited_key_without_touching_parent(db_session):
    project = await _project(db_session)
    dev = await _env(db_session, project, "dev")
    child = await _env(db_session, project, "dev/wt-x", parent=dev, unset_keys=["SENTRY_DSN"])
    await _set(db_session, dev, "SENTRY_DSN", "PORT")

    assert await _view(db_session, child) == {"PORT": "dev"}
    assert await _view(db_session, dev) == {"SENTRY_DSN": "dev", "PORT": "dev"}


async def test_unset_in_middle_level_hides_key_below_but_leaf_can_set_it_again(db_session):
    project = await _project(db_session)
    dev = await _env(db_session, project, "dev")
    mid = await _env(db_session, project, "dev/a", parent=dev, unset_keys=["X"])
    leaf = await _env(db_session, project, "dev/a/b", parent=mid)
    await _set(db_session, dev, "X", "Y")

    assert await _view(db_session, leaf) == {"Y": "dev"}
    await _set(db_session, leaf, "X")
    assert await _view(db_session, leaf) == {"X": "dev/a/b", "Y": "dev"}


async def test_parent_change_propagates_to_children(db_session):
    project = await _project(db_session)
    dev = await _env(db_session, project, "dev")
    child = await _env(db_session, project, "dev/wt-x", parent=dev)
    await _set(db_session, dev, "PORT")
    assert await _view(db_session, child) == {"PORT": "dev"}

    await _set(db_session, dev, "NEW_KEY")
    blob = await db_session.scalar(select(VaultBlob).where(VaultBlob.environment_id == dev.id,
                                                            VaultBlob.key_id == "PORT"))
    await db_session.delete(blob)
    await db_session.flush()

    assert await _view(db_session, child) == {"NEW_KEY": "dev"}


async def test_cycle_is_refused(db_session):
    project = await _project(db_session)
    a = await _env(db_session, project, "a")
    b = await _env(db_session, project, "b", parent=a)
    a.parent_id = b.id  # only possible by writing the database directly: the API never re-parents
    await db_session.flush()

    with pytest.raises(InheritanceError, match="cycle"):
        await load_chain(db_session, b)


async def test_chain_deeper_than_max_depth_is_refused(db_session, monkeypatch):
    monkeypatch.setattr(settings, "ENV_INHERITANCE_MAX_DEPTH", 2)
    project = await _project(db_session)
    root = await _env(db_session, project, "dev")
    one = await _env(db_session, project, "dev/1", parent=root)
    two = await _env(db_session, project, "dev/1/2", parent=one)
    await load_chain(db_session, two)  # two hops: allowed

    with pytest.raises(InheritanceError, match="limited to 2"):
        await plan_child(db_session, two, project.id, None, False, False)
    three = await _env(db_session, project, "dev/1/2/3", parent=two)  # written past the API
    with pytest.raises(InheritanceError, match="deeper"):
        await load_chain(db_session, three)


async def test_default_max_depth_is_three(db_session):
    assert settings.ENV_INHERITANCE_MAX_DEPTH == 3
    project = await _project(db_session)
    env = await _env(db_session, project, "dev")
    for i in range(3):
        await plan_child(db_session, env, project.id, None, False, False)
        env = await _env(db_session, project, f"{env.name}/{i}", parent=env)
    with pytest.raises(InheritanceError):
        await plan_child(db_session, env, project.id, None, False, False)


async def test_archived_or_expired_parent_breaks_the_chain(db_session):
    project = await _project(db_session)
    dev = await _env(db_session, project, "dev", archived=True)
    child = await _env(db_session, project, "dev/wt-x", parent=dev)

    with pytest.raises(InheritanceError, match="Parent environment not found"):
        await load_chain(db_session, child)


async def test_plan_child_rules(db_session):
    project = await _project(db_session)
    other = await _project(db_session)
    dev = await _env(db_session, project, "dev")
    secret = await _env(db_session, project, "ops", restricted=True)

    with pytest.raises(InheritanceError, match="Only a child"):
        await plan_child(db_session, None, project.id, 3600, False, False)
    with pytest.raises(InheritanceError, match="not found"):
        await plan_child(db_session, dev, other.id, None, False, False)
    with pytest.raises(InheritanceError, match="default"):
        await plan_child(db_session, dev, project.id, None, False, True)
    with pytest.raises(InheritanceError, match="TTL must be"):
        await plan_child(db_session, dev, project.id, 5, False, False)

    assert (await plan_child(db_session, secret, project.id, None, False, False))[0] is True
    restricted, expires_at = await plan_child(db_session, dev, project.id, 3600, False, False)
    assert restricted is False
    assert timedelta(minutes=59) < expires_at - datetime.now(timezone.utc) <= timedelta(hours=1)


async def test_child_ttl_is_clamped_to_the_parent_expiry(db_session):
    project = await _project(db_session)
    dev = await _env(db_session, project, "dev")
    soon = datetime.now(timezone.utc) + timedelta(hours=2)
    wt = await _env(db_session, project, "dev/wt", parent=dev, expires_at=soon)

    _, longer = await plan_child(db_session, wt, project.id, 7 * 86400, False, False)
    _, none_asked = await plan_child(db_session, wt, project.id, None, False, False)

    assert longer == soon and none_asked == soon


async def test_expired_environment_is_gone(db_session):
    project = await _project(db_session)
    dev = await _env(db_session, project, "dev")
    past = await _env(db_session, project, "dev/old", parent=dev,
                      expires_at=datetime.now(timezone.utc) - timedelta(seconds=1))
    assert is_gone(past) and not is_gone(dev)


async def test_diff_with_parent_lists_names_and_origins_only(db_session):
    project = await _project(db_session)
    dev = await _env(db_session, project, "dev")
    child = await _env(db_session, project, "dev/wt-x", parent=dev, unset_keys=["SENTRY_DSN"])
    await _set(db_session, dev, "DATABASE_URL", "PORT", "SENTRY_DSN")
    await _set(db_session, child, "PORT", "WEBHOOK_SECRET")

    rows = await diff_with_parent(db_session, await load_chain(db_session, child))

    assert rows == [
        {"key": "DATABASE_URL", "status": "inherited", "source": "dev", "parent_source": "dev"},
        {"key": "PORT", "status": "override", "source": "dev/wt-x", "parent_source": "dev"},
        {"key": "SENTRY_DSN", "status": "unset", "source": "dev", "parent_source": "dev"},
        {"key": "WEBHOOK_SECRET", "status": "added", "source": "dev/wt-x", "parent_source": None},
    ]
    assert "ct-" not in repr(rows)

    with pytest.raises(InheritanceError, match="no parent"):
        await diff_with_parent(db_session, await load_chain(db_session, dev))
