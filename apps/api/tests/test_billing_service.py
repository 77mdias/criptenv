"""Billing: the switch, the tables, and the subscription service (checkout and sync)."""
from datetime import timedelta
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.middleware.auth import get_current_user
from app.models.member import ProjectMember
from app.models.project import Project
from app.services.billing_service import billing_enabled
from main import app
from tests.billing_fakes import T0, enable_billing, make_subscription, make_user

pytestmark = pytest.mark.asyncio


# ─── The switch ──────────────────────────────────────────────────────────────


async def test_billing_is_off_by_default(monkeypatch):
    monkeypatch.setattr(settings, "MERCADO_PAGO_ACCESS_TOKEN", "x")
    monkeypatch.setattr(settings, "MERCADO_PAGO_WEBHOOK_SECRET", "y")
    assert billing_enabled() is False


@pytest.mark.parametrize("missing", ["BILLING_ENABLED", "MERCADO_PAGO_ACCESS_TOKEN", "MERCADO_PAGO_WEBHOOK_SECRET"])
async def test_billing_needs_flag_token_and_webhook_secret(monkeypatch, missing):
    enable_billing(monkeypatch)
    assert billing_enabled() is True
    monkeypatch.setattr(settings, missing, False if missing == "BILLING_ENABLED" else "")
    assert billing_enabled() is False


# ─── The tables ──────────────────────────────────────────────────────────────


async def test_only_one_live_subscription_per_user(db_session):
    ana = make_user()
    db_session.add_all([ana, make_subscription(ana, status="active"), make_subscription(ana, status="past_due")])
    with pytest.raises(IntegrityError):
        await db_session.flush()


async def test_ended_and_pending_subscriptions_do_not_count_as_live(db_session):
    ana = make_user()
    db_session.add_all([
        ana, make_subscription(ana, status="active"), make_subscription(ana, status="ended"),
        make_subscription(ana, status="pending"), make_subscription(ana, status="scheduled"),
    ])
    await db_session.flush()


# ─── What the plan routes say about billing ──────────────────────────────────


async def _seed(factory, *rows):
    async with factory() as db:
        db.add_all(rows)
        await db.commit()


async def test_me_plan_reports_can_upgrade_and_grace(monkeypatch, factory, client):
    enable_billing(monkeypatch)
    ana = make_user(plan="pro")
    grace = T0 + timedelta(days=7)
    await _seed(factory, ana, make_subscription(ana, status="past_due", grace_until=grace))
    app.dependency_overrides[get_current_user] = lambda: ana

    body = (await client.get("/api/v1/me/plan")).json()

    assert body["can_upgrade"] is True
    assert body["grace_until"].startswith("2027-04-08T12:00:00")


async def test_me_plan_hides_billing_when_it_is_off(factory, client):
    ana = make_user(plan="pro")
    await _seed(factory, ana, make_subscription(ana, status="past_due", grace_until=T0))
    app.dependency_overrides[get_current_user] = lambda: ana

    body = (await client.get("/api/v1/me/plan")).json()

    assert (body["can_upgrade"], body["grace_until"]) == (False, None)


async def test_project_plan_can_upgrade_only_for_the_owner(monkeypatch, factory, client):
    enable_billing(monkeypatch)
    ana, bia = make_user(), make_user()
    pid = uuid4()
    await _seed(
        factory, ana, bia,
        Project(id=pid, owner_id=ana.id, name="p", slug=f"p-{pid.hex[:6]}"),
        ProjectMember(id=uuid4(), project_id=pid, user_id=ana.id, role="owner"),
        ProjectMember(id=uuid4(), project_id=pid, user_id=bia.id, role="developer"),
    )

    app.dependency_overrides[get_current_user] = lambda: ana
    assert (await client.get(f"/api/v1/projects/{pid}/plan")).json()["can_upgrade"] is True
    app.dependency_overrides[get_current_user] = lambda: bia
    assert (await client.get(f"/api/v1/projects/{pid}/plan")).json()["can_upgrade"] is False
