"""Billing: changing plan, cancelling and refunding (the rules table of the subscription-plans spec)."""
from datetime import datetime, timedelta
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.subscription import Subscription, SubscriptionPayment
from app.models.user import User
from app.services import auth_service
from app.services.auth_service import AuthService
from app.services.billing_service import BillingService, CancelResult
from app.strategies.exceptions import BillingConflict, BillingProviderError
from tests.billing_fakes import T0, UTC, FakeEmail, FakeMercadoPago, enable_billing, make_user

pytestmark = pytest.mark.asyncio

INFO = dict(tax_id="52998224725", legal_name="Ana Souza", address="Rua A, 1, São Paulo", payer_email="ana@mp.example")
MAY_1 = datetime(2027, 5, 1, 12, 0, tzinfo=UTC)
JUN_1 = datetime(2027, 6, 1, 12, 0, tzinfo=UTC)
DAY_10 = T0 + timedelta(days=10)


@pytest.fixture
def mp():
    return FakeMercadoPago()


@pytest.fixture
def mail():
    return FakeEmail()


@pytest.fixture
def svc(db_session, mp, mail):
    return BillingService(db_session, mp=mp, email=mail)


@pytest_asyncio.fixture
async def ana(db_session):
    user = make_user()
    db_session.add(user)
    await db_session.flush()
    return user


async def _subscribe(svc, mp, user, plan="pro", interval="month", when=T0):
    """Checkout, payment approved at `when`, synced. Returns (subscription, payment id)."""
    sub = await svc.checkout(user, plan=plan, interval=interval, now=when, **INFO)
    payment_id = mp.pay(sub.provider_subscription_id, when=when)
    await svc.sync(sub, now=when)
    return sub, payment_id


async def _payment_row(db, payment_id):
    return await db.scalar(select(SubscriptionPayment).where(SubscriptionPayment.provider_payment_id == payment_id))


def _admin_subjects(mail):
    return [args[0] for name, args, _ in mail.sent if name == "send_billing_admin"]


# ─── Upgrade: valid now, the unused part of the old plan goes back ───────────


async def test_upgrade_ends_pro_now_and_refunds_the_unused_part(db_session, svc, mp, ana):
    pro, pro_payment = await _subscribe(svc, mp, ana)

    max_, _ = await _subscribe(svc, mp, ana, plan="max", when=DAY_10)

    row = await _payment_row(db_session, pro_payment)
    # R$ 29.00 for 30 days, 20 days left: 19.333... rounded down.
    assert mp.refunds == [(pro_payment, Decimal("19.33"), f"prorate-{row.id}")]
    assert row.refunded_amount == Decimal("19.33")
    assert (pro.status, max_.status, ana.plan) == ("ended", "active", "max")
    assert pro.provider_subscription_id in mp.cancelled
    assert (max_.current_period_start, max_.current_period_end) == (DAY_10, DAY_10.replace(month=5))


async def test_upgrade_refund_failure_notifies_admin_and_still_upgrades(db_session, svc, mp, mail, ana):
    _, pro_payment = await _subscribe(svc, mp, ana)
    mp.fail.add("refund_payment")

    max_, _ = await _subscribe(svc, mp, ana, plan="max", when=DAY_10)

    row = await _payment_row(db_session, pro_payment)
    assert (max_.status, ana.plan, row.refunded_amount) == ("active", "max", None)
    assert row.refund_error
    assert "Reembolso falhou: devolver à mão" in _admin_subjects(mail)


async def test_upgrade_from_past_due_refunds_nothing(svc, mp, ana):
    pro, _ = await _subscribe(svc, mp, ana)
    mp.pay(pro.provider_subscription_id, when=MAY_1, status="rejected")
    await svc.sync(pro, now=MAY_1)
    assert pro.status == "past_due"

    max_, _ = await _subscribe(svc, mp, ana, plan="max", when=MAY_1 + timedelta(days=1))

    assert mp.refunds == []
    assert (pro.status, max_.status, ana.plan) == ("ended", "active", "max")


# ─── Downgrade and interval switch: paid now, valid when the current period ends ─


async def test_downgrade_is_scheduled_for_the_period_end(svc, mp, ana):
    max_, _ = await _subscribe(svc, mp, ana, plan="max")

    pro, _ = await _subscribe(svc, mp, ana, plan="pro", when=DAY_10)

    assert (max_.status, max_.cancel_at_period_end, ana.plan) == ("active", True, "max")
    assert max_.provider_subscription_id in mp.cancelled
    assert (pro.status, pro.current_period_start, pro.current_period_end) == ("scheduled", MAY_1, JUN_1)
    assert pro.first_payment_at == DAY_10
    assert mp.refunds == []


async def test_interval_switch_is_scheduled_too(svc, mp, ana):
    monthly, _ = await _subscribe(svc, mp, ana)

    yearly, _ = await _subscribe(svc, mp, ana, interval="year", when=DAY_10)

    assert (monthly.cancel_at_period_end, ana.plan) == (True, "pro")
    assert (yearly.status, yearly.current_period_start) == ("scheduled", MAY_1)
    assert yearly.current_period_end == datetime(2028, 5, 1, 12, 0, tzinfo=UTC)


async def test_checkout_blocked_while_a_change_is_scheduled(svc, mp, ana):
    await _subscribe(svc, mp, ana, plan="max")
    await _subscribe(svc, mp, ana, plan="pro", when=DAY_10)

    with pytest.raises(BillingConflict):
        await svc.checkout(ana, plan="max", interval="year", **INFO)


# ─── A payment that cannot be applied goes back ──────────────────────────────


async def test_payment_for_ended_subscription_is_refunded(db_session, svc, mp, mail, ana):
    abandoned = await svc.checkout(ana, plan="pro", interval="month", **INFO)
    await svc.checkout(ana, plan="max", interval="month", **INFO)  # replaces (ends) the first checkout
    late = mp.pay(abandoned.provider_subscription_id, when=T0)

    await svc.sync(abandoned, now=T0)

    row = await _payment_row(db_session, late)
    assert mp.refunds == [(late, None, f"orphan-{late}")]
    assert (row.refunded_amount, abandoned.status, ana.plan) == (Decimal("29.00"), "ended", None)
    assert "send_subscription_confirmed" not in mail.names()


async def test_orphan_refund_failure_notifies_admin(db_session, svc, mp, mail, ana):
    abandoned = await svc.checkout(ana, plan="pro", interval="month", **INFO)
    await svc.checkout(ana, plan="max", interval="month", **INFO)
    late = mp.pay(abandoned.provider_subscription_id, when=T0)
    mp.fail.add("refund_payment")

    await svc.sync(abandoned, now=T0)

    assert (await _payment_row(db_session, late)).refund_error
    assert _admin_subjects(mail) == ["Reembolso falhou: devolver à mão"]
    assert ana.plan is None


# ─── Cancelling ──────────────────────────────────────────────────────────────


async def test_cancel_within_7_days_refunds_once_and_goes_free_now(db_session, svc, mp, mail, ana):
    sub, payment = await _subscribe(svc, mp, ana)
    now = T0 + timedelta(days=3)

    result = await svc.cancel(ana, now=now)

    row = await _payment_row(db_session, payment)
    assert result == CancelResult(refunded=True, ends_at=None)
    assert mp.refunds == [(payment, None, f"refund-{row.id}")]
    assert (sub.status, ana.plan, ana.refund_used_at) == ("ended", None, now)
    assert sub.provider_subscription_id in mp.cancelled
    name, _, kwargs = mail.sent[-1]
    assert (name, kwargs["refunded"]) == ("send_subscription_canceled", True)


async def test_second_refund_request_goes_to_admin_and_keeps_plan_until_period_end(svc, mp, mail, ana):
    ana.refund_used_at = T0 - timedelta(days=90)
    sub, _ = await _subscribe(svc, mp, ana)

    result = await svc.cancel(ana, now=T0 + timedelta(days=3))

    assert result == CancelResult(refunded=False, ends_at=MAY_1)
    assert (sub.status, sub.cancel_at_period_end, ana.plan) == ("active", True, "pro")
    assert mp.refunds == []
    assert "Pedido de reembolso para decidir" in _admin_subjects(mail)


async def test_cancel_after_7_days_keeps_plan_until_period_end(svc, mp, mail, ana):
    sub, _ = await _subscribe(svc, mp, ana)

    result = await svc.cancel(ana, now=DAY_10)

    assert result == CancelResult(refunded=False, ends_at=MAY_1)
    assert (sub.status, sub.cancel_at_period_end, ana.plan, ana.refund_used_at) == ("active", True, "pro", None)
    assert mp.refunds == []
    assert "Pedido de reembolso para decidir" not in _admin_subjects(mail)
    assert mail.sent[-1][2]["ends_at"] == MAY_1


async def test_cancel_of_a_renewal_never_refunds(svc, mp, ana):
    sub, _ = await _subscribe(svc, mp, ana)
    mp.pay(sub.provider_subscription_id, when=MAY_1)
    await svc.sync(sub, now=MAY_1)

    result = await svc.cancel(ana, now=MAY_1 + timedelta(days=2))

    assert result == CancelResult(refunded=False, ends_at=JUN_1)
    assert mp.refunds == []


async def test_cancel_fails_closed_when_provider_is_down(svc, mp, mail, ana):
    sub, _ = await _subscribe(svc, mp, ana)
    mp.fail.add("cancel_preapproval")
    sent_before = len(mail.sent)

    with pytest.raises(BillingProviderError):
        await svc.cancel(ana, now=T0 + timedelta(days=3))

    assert (sub.status, sub.cancel_at_period_end, ana.plan, ana.refund_used_at) == ("active", False, "pro", None)
    assert mp.refunds == [] and len(mail.sent) == sent_before


async def test_cancel_targets_the_scheduled_change_first(db_session, svc, mp, ana):
    max_, _ = await _subscribe(svc, mp, ana, plan="max")
    pro, pro_payment = await _subscribe(svc, mp, ana, plan="pro", when=DAY_10)

    result = await svc.cancel(ana, now=DAY_10 + timedelta(days=2))

    row = await _payment_row(db_session, pro_payment)
    assert result == CancelResult(refunded=True, ends_at=None)
    assert mp.refunds == [(pro_payment, None, f"refund-{row.id}")]
    # The change is gone; the plan in force stays as it was, until the end of what was paid.
    assert (pro.status, max_.status, ana.plan) == ("ended", "active", "max")


async def test_cancel_without_subscription_conflicts(svc, ana):
    with pytest.raises(BillingConflict):
        await svc.cancel(ana, now=T0)


async def test_cancel_twice_conflicts(svc, mp, ana):
    await _subscribe(svc, mp, ana)
    await svc.cancel(ana, now=DAY_10)

    with pytest.raises(BillingConflict):
        await svc.cancel(ana, now=DAY_10)


# ─── Deleting the account ────────────────────────────────────────────────────


async def test_delete_account_cancels_at_mercado_pago_first(monkeypatch, db_session, svc, mp, ana):
    enable_billing(monkeypatch)
    monkeypatch.setattr(auth_service, "BillingService", lambda db: svc)
    sub, _ = await _subscribe(svc, mp, ana)

    await AuthService(db_session).delete_account(ana)

    assert sub.provider_subscription_id in mp.cancelled
    assert await db_session.scalar(select(User).where(User.id == ana.id)) is None
    assert await db_session.scalar(select(Subscription).where(Subscription.user_id == ana.id)) is None


async def test_delete_account_stops_when_mercado_pago_is_down(monkeypatch, db_session, svc, mp, ana):
    enable_billing(monkeypatch)
    monkeypatch.setattr(auth_service, "BillingService", lambda db: svc)
    await _subscribe(svc, mp, ana)
    mp.fail.add("cancel_preapproval")

    with pytest.raises(BillingProviderError):
        await AuthService(db_session).delete_account(ana)

    assert await db_session.scalar(select(User).where(User.id == ana.id)) is not None


async def test_delete_account_skips_billing_when_disabled(db_session, mp, ana):
    await AuthService(db_session).delete_account(ana)

    assert mp.calls == []
    assert await db_session.scalar(select(User).where(User.id == ana.id)) is None


# ─── Invoice data and what the screen reads ──────────────────────────────────


async def test_update_tax_info_validates_and_saves(svc, mp, ana):
    sub, _ = await _subscribe(svc, mp, ana)

    await svc.update_tax_info(ana, tax_id="11222333000181", legal_name="Ana ME", address="Rua B, 2")

    assert (sub.tax_id, sub.legal_name, sub.address) == ("11222333000181", "Ana ME", "Rua B, 2")
    with pytest.raises(ValueError):
        await svc.update_tax_info(ana, tax_id="abc", legal_name="Ana ME", address="Rua B, 2")


async def test_update_tax_info_without_subscription_conflicts(svc, ana):
    with pytest.raises(BillingConflict):
        await svc.update_tax_info(ana, tax_id="52998224725", legal_name="Ana", address="Rua A")


async def test_state_reports_prices_subscriptions_and_refund_eligibility(svc, mp, ana):
    empty = await svc.state(ana, now=T0)
    assert empty["prices"] == {
        "pro": {"month": Decimal("29.00"), "year": Decimal("290.00")},
        "max": {"month": Decimal("69.00"), "year": Decimal("690.00")},
    }
    assert (empty["subscription"], empty["scheduled"], empty["pending"], empty["refund_eligible"]) == (
        None, None, None, False,
    )

    pending = await svc.checkout(ana, plan="pro", interval="month", **INFO)
    assert (await svc.state(ana, now=T0))["pending"] is pending

    mp.pay(pending.provider_subscription_id, when=T0)
    await svc.sync(pending, now=T0)
    assert (await svc.state(ana, now=T0 + timedelta(days=1)))["refund_eligible"] is True
    assert (await svc.state(ana, now=T0 + timedelta(days=8)))["refund_eligible"] is False
    ana.refund_used_at = T0
    state = await svc.state(ana, now=T0 + timedelta(days=1))
    assert (state["subscription"], state["refund_eligible"]) == (pending, False)
