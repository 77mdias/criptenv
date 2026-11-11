"""Plans: where the limits of each user come from (free, unlimited, DEFAULT_PLAN)."""
from decimal import Decimal
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.config import Settings, settings
from app.middleware.auth import get_current_user
from app.models.user import User
from app.plans import AUTO_SYNC, CI_SYNC, INTERVAL_MONTHS, PLAN_RANK, PLANS, PRICES, SYNC_REDEPLOY, plan_for
from main import app

_KEYS = [
    "projects", "environments_per_project", "members_per_project", "integrations_per_project",
    "audit_retention_days", "personal_vault_items", "personal_vault_folders",
]
# The table in docs/superpowers/specs/2026-11-09-subscription-plans-design.md.
LIMITS = {
    "free": dict(zip(_KEYS, [3, 3, 3, 1, 7, 120, 10])),
    "pro": dict(zip(_KEYS, [None, 5, 10, None, 30, None, None])),
    "max": dict(zip(_KEYS, [None, 7, 25, None, 90, None, None])),
    "unlimited": dict.fromkeys(_KEYS),
}
SYNC_FEATURES = sorted([AUTO_SYNC, SYNC_REDEPLOY, CI_SYNC])


def _user(plan=None):
    return User(id=uuid4(), email="ana@example.com", name="Ana", password_hash="", plan=plan)


def test_plans_match_the_spec_table():
    assert {plan_id: dict(plan.limits) for plan_id, plan in PLANS.items()} == LIMITS


def test_every_plan_has_every_limit_key():
    assert all(set(plan.limits) == set(_KEYS) for plan in PLANS.values())


def test_only_max_and_unlimited_have_sync_features():
    assert PLANS["free"].features == PLANS["pro"].features == frozenset()
    assert sorted(PLANS["max"].features) == sorted(PLANS["unlimited"].features) == SYNC_FEATURES


def test_prices_match_the_spec():
    assert PRICES == {
        ("pro", "month"): Decimal("29.00"), ("pro", "year"): Decimal("290.00"),
        ("max", "month"): Decimal("69.00"), ("max", "year"): Decimal("690.00"),
    }
    assert PLAN_RANK == {"pro": 1, "max": 2}
    assert INTERVAL_MONTHS == {"month": 1, "year": 12}


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
    (None, "free", {"id": "free", "limits": LIMITS["free"], "features": []}),
    ("max", "free", {"id": "max", "limits": LIMITS["max"], "features": SYNC_FEATURES}),
    ("unlimited", "free", {"id": "unlimited", "limits": LIMITS["unlimited"], "features": SYNC_FEATURES}),
    (None, "unlimited", {"id": "unlimited", "limits": LIMITS["unlimited"], "features": SYNC_FEATURES}),
])
async def test_me_plan_route(monkeypatch, client, user_plan, default, expected):
    monkeypatch.setattr(settings, "DEFAULT_PLAN", default)
    app.dependency_overrides[get_current_user] = lambda: _user(user_plan)
    r = await client.get("/api/v1/me/plan")
    assert r.status_code == 200
    assert r.json() == {**expected, "usage": {"projects": 0}, "can_upgrade": False, "grace_until": None}


@pytest.mark.asyncio
async def test_me_plan_requires_a_session():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        assert (await c.get("/api/v1/me/plan")).status_code == 401
