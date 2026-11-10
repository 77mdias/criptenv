"""Billing: what depends on the clock (the hourly cycle)."""
from datetime import timedelta

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.jobs import billing_cycle
from app.jobs.billing_cycle import create_session_scoped_scheduler_job
from app.models.subscription import Subscription
from app.models.user import User
from app.services import billing_service
from app.services.billing_service import GRACE, PENDING_TTL, RENEWAL_SLACK, BillingService
from tests.billing_fakes import T0, FakeEmail, FakeMercadoPago, make_subscription, make_user

pytestmark = pytest.mark.asyncio

INFO = dict(tax_id="52998224725", legal_name="Ana Souza", address="Rua A, 1", payer_email="ana@mp.example")
PERIOD_END = T0 + timedelta(days=30)


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


async def _add(db, user, **fields):
    """A subscription row as an earlier sync left it; the user's plan follows a live one."""
    sub = make_subscription(user, **fields)
    if sub.status in ("active", "past_due"):
        user.plan = sub.plan
    db.add(sub)
    await db.flush()
    return sub


async def _active(db, user, **fields):
    return await _add(db, user, status="active", current_period_start=T0, current_period_end=PERIOD_END,
                      first_payment_at=T0, **fields)


async def test_cycle_heals_a_pending_whose_webhook_was_lost(db_session, svc, mp, ana):
    sub = await _add(db_session, ana, status="pending", created_at=T0)
    mp.pay(sub.provider_subscription_id, when=T0)

    assert await svc.run_cycle(now=T0 + timedelta(hours=1)) == 1

    assert (sub.status, ana.plan) == ("active", "pro")


async def test_cycle_ends_an_abandoned_checkout_after_48h(db_session, svc, mp, ana):
    sub = await _add(db_session, ana, status="pending", created_at=T0)

    await svc.run_cycle(now=T0 + PENDING_TTL - timedelta(minutes=1))
    assert sub.status == "pending"

    await svc.run_cycle(now=T0 + PENDING_TTL + timedelta(minutes=1))
    assert (sub.status, ana.plan) == ("ended", None)
    assert mp.cancelled == [sub.provider_subscription_id]


async def test_cycle_renews_from_a_payment_whose_webhook_was_lost(db_session, svc, mp, ana):
    sub = await _active(db_session, ana)
    mp.pay(sub.provider_subscription_id, when=PERIOD_END)

    await svc.run_cycle(now=PERIOD_END + timedelta(hours=1))

    assert (sub.status, sub.current_period_start, sub.grace_until) == ("active", PERIOD_END, None)


async def test_cycle_does_not_start_grace_inside_the_slack(db_session, svc, mail, ana):
    sub = await _active(db_session, ana)

    await svc.run_cycle(now=PERIOD_END + RENEWAL_SLACK - timedelta(minutes=1))

    assert (sub.status, sub.grace_until, mail.sent) == ("active", None, [])


async def test_cycle_starts_grace_one_day_after_an_unpaid_period_end(db_session, svc, mail, ana):
    sub = await _active(db_session, ana)

    await svc.run_cycle(now=PERIOD_END + RENEWAL_SLACK + timedelta(minutes=1))
    await svc.run_cycle(now=PERIOD_END + RENEWAL_SLACK + timedelta(hours=1))

    assert (sub.status, sub.grace_until, ana.plan) == ("past_due", PERIOD_END + GRACE, "pro")
    assert mail.names() == ["send_payment_failed"]


async def test_cycle_downgrades_after_grace(db_session, svc, mp, mail, ana):
    sub = await _add(db_session, ana, status="past_due", current_period_start=T0, current_period_end=PERIOD_END,
                     first_payment_at=T0, grace_until=PERIOD_END + GRACE)

    await svc.run_cycle(now=PERIOD_END + GRACE - timedelta(minutes=1))
    assert (sub.status, ana.plan) == ("past_due", "pro")

    await svc.run_cycle(now=PERIOD_END + GRACE + timedelta(minutes=1))
    assert (sub.status, ana.plan, sub.grace_until) == ("ended", None, None)
    assert sub.provider_subscription_id in mp.cancelled
    assert mail.names() == ["send_back_to_free"]


async def test_cycle_ends_a_canceled_subscription_at_period_end(db_session, svc, mp, mail, ana):
    sub = await _active(db_session, ana, cancel_at_period_end=True)

    await svc.run_cycle(now=PERIOD_END - timedelta(minutes=1))
    assert (sub.status, ana.plan) == ("active", "pro")

    await svc.run_cycle(now=PERIOD_END + timedelta(minutes=1))
    assert (sub.status, ana.plan) == ("ended", None)
    assert mail.names() == ["send_back_to_free"]
    # Already cancelled there when the user cancelled: the cycle does not call Mercado Pago again.
    assert mp.calls == []


async def test_cycle_activates_the_scheduled_change(db_session, svc, mail, ana):
    max_ = await _active(db_session, ana, plan="max", cancel_at_period_end=True)
    pro = await _add(db_session, ana, plan="pro", status="scheduled", current_period_start=PERIOD_END,
                     current_period_end=PERIOD_END + timedelta(days=31), first_payment_at=T0)

    await svc.run_cycle(now=PERIOD_END + timedelta(minutes=1))

    assert (max_.status, pro.status, ana.plan) == ("ended", "active", "pro")
    assert "send_back_to_free" not in mail.names()


async def test_cycle_never_touches_users_without_subscription(db_session, svc, mp):
    by_hand = make_user(plan="max")
    db_session.add(by_hand)
    await db_session.flush()

    assert await svc.run_cycle(now=T0 + timedelta(days=400)) == 0

    assert by_hand.plan == "max"
    assert mp.calls == []


async def test_cycle_continues_after_one_subscription_fails(db_session, svc, mp, ana):
    bia = make_user()
    db_session.add(bia)
    broken = await _add(db_session, ana, status="pending", created_at=T0)
    fine = await _add(db_session, bia, status="pending", created_at=T0)
    await db_session.commit()
    mp.pay(fine.provider_subscription_id, when=T0)
    real, broken_id = mp.get_preapproval, broken.provider_subscription_id
    ana_id, bia_id = ana.id, bia.id  # a rollback expires the rows; read what the asserts need first

    async def flaky(preapproval_id):
        if preapproval_id == broken_id:
            raise billing_service.MercadoPagoError("down", status_code=500)
        return await real(preapproval_id)

    mp.get_preapproval = flaky

    await svc.run_cycle(now=T0 + timedelta(hours=1))

    statuses = dict((await db_session.execute(select(Subscription.user_id, Subscription.status))).all())
    assert statuses == {ana_id: "pending", bia_id: "active"}
    assert (await db_session.scalar(select(User.plan).where(User.id == bia_id))) == "pro"


async def test_scheduler_job_runs_a_cycle_on_its_own_session(monkeypatch, factory, mp, mail):
    monkeypatch.setattr(billing_cycle, "BillingService", lambda db: BillingService(db, mp=mp, email=mail))
    ana = make_user()
    async with factory() as db:
        db.add(ana)
        sub = make_subscription(ana, status="pending", created_at=billing_service.datetime.now(billing_service.timezone.utc))
        db.add(sub)
        await db.commit()
    mp.pay(sub.provider_subscription_id, when=T0)

    await create_session_scoped_scheduler_job(factory)()

    async with factory() as db:
        assert (await db.scalar(select(User.plan).where(User.id == ana.id))) == "pro"
