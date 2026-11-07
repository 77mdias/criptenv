"""Plans: where the limits of each user come from (free, unlimited, DEFAULT_PLAN)."""
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.config import Settings, settings
from app.middleware.auth import get_current_user
from app.models.user import User
from app.plans import plan_for
from main import app


def _user(plan=None):
    return User(id=uuid4(), email="ana@example.com", name="Ana", password_hash="", plan=plan)


def test_plan_for_prefers_user_plan_then_default(monkeypatch):
    monkeypatch.setattr(settings, "DEFAULT_PLAN", "unlimited")
    assert plan_for(None).id == "unlimited"
    assert plan_for("free").id == "free"


def test_plan_for_unknown_value_is_free(monkeypatch):
    monkeypatch.setattr(settings, "DEFAULT_PLAN", "unlimited")
    assert plan_for("enterprise-typo").id == "free"


def test_default_plan_setting_rejects_unknown():
    base = {"DATABASE_URL": "postgresql://user:pass@localhost:5432/db", "SECRET_KEY": "x" * 32}
    assert Settings(**base).DEFAULT_PLAN == "free"
    assert Settings(**base, DEFAULT_PLAN="unlimited").DEFAULT_PLAN == "unlimited"
    with pytest.raises(ValidationError):
        Settings(**base, DEFAULT_PLAN="unlimted")


@pytest.mark.asyncio
@pytest.mark.parametrize("user_plan,default,expected", [
    (None, "free", {"id": "free", "limits": {"personal_vault_items": 120, "personal_vault_folders": 10}, "features": []}),
    ("unlimited", "free",
     {"id": "unlimited", "limits": {"personal_vault_items": None, "personal_vault_folders": None}, "features": []}),
    (None, "unlimited",
     {"id": "unlimited", "limits": {"personal_vault_items": None, "personal_vault_folders": None}, "features": []}),
])
async def test_me_plan_route(monkeypatch, user_plan, default, expected):
    monkeypatch.setattr(settings, "DEFAULT_PLAN", default)
    app.dependency_overrides[get_current_user] = lambda: _user(user_plan)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/api/v1/me/plan")
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert r.status_code == 200
    assert r.json() == expected


@pytest.mark.asyncio
async def test_me_plan_requires_a_session():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        assert (await c.get("/api/v1/me/plan")).status_code == 401
