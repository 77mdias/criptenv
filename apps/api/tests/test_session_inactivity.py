"""A login (web or CLI) survives 20 days without use, not 7: decided by the Jean on 2026-11-11."""
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.config import Settings, settings
from app.models.user import Session, User
from app.services.auth_service import AuthService

pytestmark = pytest.mark.asyncio


def test_default_inactivity_is_20_days():
    base = {"DATABASE_URL": "postgresql://user:pass@localhost:5432/db", "SECRET_KEY": "x" * 32}
    # _env_file=None: the default itself, not what a developer's .env says (and no settings repr in a failure).
    days = Settings(_env_file=None, **base).SESSION_INACTIVITY_DAYS
    assert days == 20


async def _session(db, idle_days: int) -> tuple[str, Session]:
    user = User(id=uuid4(), email=f"{uuid4().hex[:8]}@example.com", name="Ana", password_hash="")
    token = secrets.token_urlsafe(48)
    now = datetime.now(timezone.utc)
    session = Session(
        id=uuid4(), user_id=user.id, token=AuthService(db).hash_token(token),
        expires_at=now + timedelta(days=30), last_accessed_at=now - timedelta(days=idle_days),
    )
    db.add_all([user, session])
    await db.flush()
    return token, session


@pytest.mark.parametrize("idle_days,alive", [(10, True), (19, True), (21, False)])
async def test_a_session_idle_for_days_still_works_until_the_limit(monkeypatch, db_session, idle_days, alive):
    monkeypatch.setattr(settings, "SESSION_INACTIVITY_DAYS", 20)
    token, _ = await _session(db_session, idle_days)

    found, user = await AuthService(db_session).resolve_session(token)

    assert (found is not None, user is not None) == (alive, alive)


async def test_cleanup_keeps_a_session_idle_for_10_days(monkeypatch, db_session):
    monkeypatch.setattr(settings, "SESSION_INACTIVITY_DAYS", 20)
    _, recent = await _session(db_session, 10)
    _, old = await _session(db_session, 21)

    await AuthService(db_session).cleanup_inactive_sessions()

    left = set(await db_session.scalars(select(Session.id)))
    assert recent.id in left and old.id not in left
