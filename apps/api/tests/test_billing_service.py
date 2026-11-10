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


# ─── Subscribing and renewing (checkout, sync) ───────────────────────────────

from decimal import Decimal  # noqa: E402

from sqlalchemy import func, select  # noqa: E402

from app.models.subscription import Subscription, SubscriptionPayment  # noqa: E402
from app.services.billing_service import GRACE, BillingService, add_months  # noqa: E402
from app.strategies.exceptions import BillingConflict, BillingProviderError  # noqa: E402
from tests.billing_fakes import UTC, FakeEmail, FakeMercadoPago  # noqa: E402
from datetime import datetime  # noqa: E402

INFO = dict(tax_id="52998224725", legal_name="Ana Souza", address="Rua A, 1, São Paulo", payer_email="ana@mp.example")
MAY_1 = datetime(2027, 5, 1, 12, 0, tzinfo=UTC)
JUN_1 = datetime(2027, 6, 1, 12, 0, tzinfo=UTC)


@pytest.fixture
def mp():
    return FakeMercadoPago()


@pytest.fixture
def mail():
    return FakeEmail()


@pytest.fixture
def svc(db_session, mp, mail):
    return BillingService(db_session, mp=mp, email=mail)


async def _ana(db, plan=None):
    user = make_user(plan)
    db.add(user)
    await db.flush()
    return user


async def _subscribed(svc, mp, user, plan="pro", interval="month", when=T0):
    """Checkout, first payment approved at `when`, synced."""
    sub = await svc.checkout(user, plan=plan, interval=interval, **INFO)
    mp.pay(sub.provider_subscription_id, when=when)
    await svc.sync(sub, now=when)
    return sub


async def _count(db, model):
    return await db.scalar(select(func.count()).select_from(model))


async def test_add_months_clamps_to_month_end():
    assert add_months(datetime(2027, 1, 31, tzinfo=UTC), 1) == datetime(2027, 2, 28, tzinfo=UTC)
    assert add_months(datetime(2027, 3, 15, tzinfo=UTC), 12) == datetime(2028, 3, 15, tzinfo=UTC)
    assert add_months(datetime(2027, 12, 5, tzinfo=UTC), 1) == datetime(2028, 1, 5, tzinfo=UTC)


async def test_checkout_creates_pending_and_does_not_touch_the_plan(db_session, svc, mp):
    ana = await _ana(db_session)

    sub = await svc.checkout(ana, plan="pro", interval="month", **INFO)

    assert (sub.status, sub.amount, ana.plan) == ("pending", Decimal("29.00"), None)
    assert sub.init_point == f"https://mp.test/checkout/{sub.provider_subscription_id}"
    sent = mp.preapprovals[sub.provider_subscription_id]
    assert (sent["reason"], sent["external_reference"], sent["months"]) == ("CriptEnv Pro (mensal)", str(sub.id), 1)
    assert sent["back_url"].endswith("/account/billing")
    assert sent["payer_email"] == "ana@mp.example"


@pytest.mark.parametrize("bad", [
    {"tax_id": "123"}, {"tax_id": "5299822472a"}, {"legal_name": "  "}, {"address": ""}, {"payer_email": "nope"},
])
async def test_checkout_rejects_bad_invoice_data(db_session, svc, bad):
    ana = await _ana(db_session)
    with pytest.raises(ValueError):
        await svc.checkout(ana, plan="pro", interval="month", **{**INFO, **bad})


@pytest.mark.parametrize("plan,interval", [("free", "month"), ("pro", "week")])
async def test_checkout_rejects_unknown_plan_or_interval(db_session, svc, plan, interval):
    ana = await _ana(db_session)
    with pytest.raises(ValueError):
        await svc.checkout(ana, plan=plan, interval=interval, **INFO)


async def test_checkout_rejects_same_live_plan(db_session, svc, mp):
    ana = await _ana(db_session)
    await _subscribed(svc, mp, ana)
    with pytest.raises(BillingConflict):
        await svc.checkout(ana, plan="pro", interval="month", **INFO)


async def test_checkout_replaces_an_older_pending(db_session, svc, mp):
    ana = await _ana(db_session)
    old = await svc.checkout(ana, plan="pro", interval="month", **INFO)

    new = await svc.checkout(ana, plan="max", interval="month", **INFO)

    assert (old.status, new.status) == ("ended", "pending")
    assert mp.cancelled == [old.provider_subscription_id]


async def test_checkout_leaves_no_row_when_provider_fails(db_session, svc, mp):
    ana = await _ana(db_session)
    mp.fail.add("create_preapproval")

    with pytest.raises(BillingProviderError):
        await svc.checkout(ana, plan="pro", interval="month", **INFO)

    assert await _count(db_session, Subscription) == 0


async def test_approved_payment_activates_and_sets_plan(db_session, svc, mp, mail):
    ana = await _ana(db_session)

    sub = await _subscribed(svc, mp, ana)

    assert (sub.status, ana.plan) == ("active", "pro")
    assert (sub.current_period_start, sub.current_period_end, sub.first_payment_at) == (T0, MAY_1, T0)
    assert mail.names() == ["send_subscription_confirmed", "send_billing_admin"]
    lines = mail.sent[1][1][1]
    assert any("52998224725" in line for line in lines) and any("Rua A, 1" in line for line in lines)


async def test_pending_payment_does_not_release_the_plan(db_session, svc, mp):
    ana = await _ana(db_session)
    sub = await svc.checkout(ana, plan="pro", interval="month", **INFO)
    mp.pay(sub.provider_subscription_id, when=T0, status="pending")

    await svc.sync(sub, now=T0)

    assert (sub.status, ana.plan) == ("pending", None)


async def test_same_payment_applied_once(db_session, svc, mp, mail):
    ana = await _ana(db_session)
    sub = await _subscribed(svc, mp, ana)

    await svc.sync(sub, now=T0)
    await svc.sync(sub, now=T0)

    assert await _count(db_session, SubscriptionPayment) == 1
    assert sub.current_period_end == MAY_1
    assert mail.names().count("send_billing_admin") == 1


async def test_renewal_extends_from_period_end(db_session, svc, mp):
    ana = await _ana(db_session)
    sub = await _subscribed(svc, mp, ana)
    mp.pay(sub.provider_subscription_id, when=MAY_1 - timedelta(hours=2))

    await svc.sync(sub, now=MAY_1)

    assert (sub.status, sub.current_period_start, sub.current_period_end) == ("active", MAY_1, JUN_1)
    assert sub.first_payment_at == T0


async def test_out_of_order_notifications_reach_the_same_state(db_session, svc, mp):
    ana = await _ana(db_session)
    sub = await svc.checkout(ana, plan="pro", interval="month", **INFO)
    first = mp.pay(sub.provider_subscription_id, when=T0)
    second = mp.pay(sub.provider_subscription_id, when=MAY_1)

    assert await svc.process_notification("subscription_authorized_payment", mp.invoice_id(second)) is True
    assert await svc.process_notification("subscription_authorized_payment", mp.invoice_id(first)) is True
    assert await svc.process_notification("subscription_preapproval", sub.provider_subscription_id) is True

    assert await _count(db_session, SubscriptionPayment) == 2
    assert (sub.status, sub.current_period_end, sub.first_payment_at) == ("active", JUN_1, T0)


async def test_rejected_renewal_starts_grace_once(db_session, svc, mp, mail):
    ana = await _ana(db_session)
    sub = await _subscribed(svc, mp, ana)
    mp.pay(sub.provider_subscription_id, when=MAY_1, status="rejected")

    await svc.sync(sub, now=MAY_1)
    await svc.sync(sub, now=MAY_1 + timedelta(days=1))

    assert (sub.status, sub.grace_until, ana.plan) == ("past_due", MAY_1 + GRACE, "pro")
    assert mail.names().count("send_payment_failed") == 1


async def test_rejected_first_payment_changes_nothing(db_session, svc, mp, mail):
    ana = await _ana(db_session)
    sub = await svc.checkout(ana, plan="pro", interval="month", **INFO)
    mp.pay(sub.provider_subscription_id, when=T0, status="rejected")

    await svc.sync(sub, now=T0)

    assert (sub.status, sub.grace_until, ana.plan, mail.sent) == ("pending", None, None, [])


async def test_payment_during_grace_clears_it(db_session, svc, mp):
    ana = await _ana(db_session)
    sub = await _subscribed(svc, mp, ana)
    mp.pay(sub.provider_subscription_id, when=MAY_1, status="rejected")
    await svc.sync(sub, now=MAY_1)
    paid = MAY_1 + timedelta(days=2)
    mp.pay(sub.provider_subscription_id, when=paid)

    await svc.sync(sub, now=paid)

    assert (sub.status, sub.grace_until, ana.plan) == ("active", None, "pro")
    assert sub.current_period_end == add_months(paid, 1)


async def test_cancelled_at_mercado_pago_keeps_plan_until_period_end(db_session, svc, mp, mail):
    ana = await _ana(db_session)
    sub = await _subscribed(svc, mp, ana)
    mp.cancel_remote(sub.provider_subscription_id)

    await svc.sync(sub, now=T0 + timedelta(days=3))

    assert (sub.status, sub.cancel_at_period_end, ana.plan) == ("active", True, "pro")
    assert sub.current_period_end == MAY_1
    assert "send_payment_failed" not in mail.names()


async def test_yearly_period_is_twelve_months(db_session, svc, mp):
    ana = await _ana(db_session)

    sub = await _subscribed(svc, mp, ana, plan="max", interval="year")

    assert (sub.amount, ana.plan) == (Decimal("690.00"), "max")
    assert sub.current_period_end == datetime(2028, 4, 1, 12, 0, tzinfo=UTC)
    assert mp.preapprovals[sub.provider_subscription_id]["months"] == 12


async def test_notification_for_unknown_preapproval_returns_false(svc):
    assert await svc.process_notification("subscription_preapproval", "pa-nobody") is False
    assert await svc.process_notification("payment", "123") is False


async def test_email_failure_does_not_block_activation(db_session, svc, mp, mail):
    ana = await _ana(db_session)
    mail.fail = True

    sub = await _subscribed(svc, mp, ana)

    assert (sub.status, ana.plan) == ("active", "pro")
