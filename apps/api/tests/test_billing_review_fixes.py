"""Billing: the cases the final review of the branch found (each failed before its fix)."""
from datetime import datetime, timedelta
from decimal import Decimal

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select

from app.config import settings
from app.middleware.auth import get_current_user
from app.models.user import User
from app.routers import auth as auth_router
from app.services import auth_service
from app.services.billing_service import CHANGE_WINDOW, GRACE, PENDING_TTL, BillingService, billing_enabled
from app.services.email_service import EmailService
from app.services.mercadopago_client import MercadoPagoClient
from app.strategies.exceptions import BillingConflict
from main import app
from tests.billing_fakes import T0, UTC, FakeEmail, FakeMercadoPago, enable_billing, make_subscription, make_user

pytestmark = pytest.mark.asyncio

INFO = dict(tax_id="52998224725", legal_name="Ana Souza", address="Rua A, 1", payer_email="ana@mp.example")
MAY_1 = datetime(2027, 5, 1, 12, 0, tzinfo=UTC)
JUN_1 = datetime(2027, 6, 1, 12, 0, tzinfo=UTC)
JUL_1 = datetime(2027, 7, 1, 12, 0, tzinfo=UTC)
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
    sub = await svc.checkout(user, plan=plan, interval=interval, now=when, **INFO)
    payment_id = mp.pay(sub.provider_subscription_id, when=when)
    await svc.sync(sub, now=when)
    return sub, payment_id


def _admin(mail):
    return [(args[0], args[1]) for name, args, _ in mail.sent if name == "send_billing_admin"]


# 1. A refused charge must never take away time that is already paid.


async def test_grace_expiry_with_paid_time_left_keeps_the_plan_until_the_period_end(db_session, svc, mp, mail, ana):
    sub = make_subscription(
        ana, status="past_due", current_period_start=JUN_1, current_period_end=JUL_1, first_payment_at=T0,
        grace_until=JUN_1 + timedelta(days=17),
    )
    ana.plan = "pro"
    db_session.add(sub)
    await db_session.flush()

    await svc.run_cycle(now=JUN_1 + timedelta(days=17, minutes=1))

    assert (sub.status, sub.cancel_at_period_end, sub.grace_until, ana.plan) == ("active", True, None, "pro")
    assert mp.cancelled == [sub.provider_subscription_id]
    assert "send_back_to_free" not in mail.names()

    await svc.run_cycle(now=JUL_1 + timedelta(minutes=1))

    assert (sub.status, ana.plan) == ("ended", None)
    assert mail.names().count("send_back_to_free") == 1


# 2. A change that only starts later must not be charged for long before it starts.


async def test_a_later_change_waits_until_the_last_month_of_the_paid_period(svc, mp, ana):
    yearly, _ = await _subscribe(svc, mp, ana, interval="year")
    opens = yearly.current_period_end - CHANGE_WINDOW

    with pytest.raises(BillingConflict):
        await svc.checkout(ana, plan="pro", interval="month", now=opens - timedelta(days=1), **INFO)

    assert (await svc.state(ana, now=DAY_10))["change_available_from"] == opens
    assert (await svc.state(ana, now=opens + timedelta(days=1)))["change_available_from"] is None
    monthly = await svc.checkout(ana, plan="pro", interval="month", now=opens + timedelta(days=1), **INFO)
    assert monthly.status == "pending"


async def test_an_upgrade_never_waits(svc, mp, ana):
    await _subscribe(svc, mp, ana, interval="year")

    upgrade = await svc.checkout(ana, plan="max", interval="month", now=DAY_10, **INFO)

    assert upgrade.status == "pending"


async def test_a_scheduled_subscription_charged_early_keeps_its_start(svc, mp, ana):
    await _subscribe(svc, mp, ana, plan="max")
    pro, _ = await _subscribe(svc, mp, ana, plan="pro", when=DAY_10)
    mp.pay(pro.provider_subscription_id, when=MAY_1 - timedelta(days=1))

    await svc.sync(pro, now=MAY_1 - timedelta(days=1))

    assert (pro.status, pro.current_period_start, pro.current_period_end) == ("scheduled", MAY_1, JUL_1)


async def test_upgrade_refund_never_exceeds_the_last_payment(svc, mp, mail, ana):
    pro, _ = await _subscribe(svc, mp, ana)
    early = mp.pay(pro.provider_subscription_id, when=T0 + timedelta(days=19))  # renewal charged before May 1
    await svc.sync(pro, now=T0 + timedelta(days=19))
    assert (pro.current_period_start, pro.current_period_end) == (MAY_1, JUN_1)

    await _subscribe(svc, mp, ana, plan="max", when=T0 + timedelta(days=24))

    # 37 days unused of a 31-day cycle is more than the last payment: it goes back whole, the rest by hand.
    assert [(payment, amount) for payment, amount, _ in mp.refunds] == [(early, Decimal("29.00"))]
    subject, lines = _admin(mail)[-2]
    assert subject == "Reembolso parcial: falta devolver à mão"
    assert any("R$ 5.61" in line for line in lines)


# 3. A checkout is only abandoned when Mercado Pago agrees nothing was paid.


async def test_cycle_applies_a_payment_made_just_before_the_checkout_expired(db_session, svc, mp, ana):
    sub = make_subscription(ana, status="pending", created_at=T0)
    db_session.add(sub)
    await db_session.flush()
    mp.pay(sub.provider_subscription_id, when=T0 + PENDING_TTL - timedelta(minutes=30))

    await svc.run_cycle(now=T0 + PENDING_TTL + timedelta(minutes=10))

    assert (sub.status, ana.plan) == ("active", "pro")
    assert mp.cancelled == []


# 4 and 5. Deleting the account.


async def test_delete_account_route_answers_502_and_sends_no_email_when_mercado_pago_is_down(
    monkeypatch, factory, client, mp, mail,
):
    enable_billing(monkeypatch)
    ana = make_user(plan="pro")
    async with factory() as db:
        db.add_all([ana, make_subscription(ana, status="active", current_period_start=T0, current_period_end=MAY_1)])
        await db.commit()
    monkeypatch.setattr(auth_service, "BillingService", lambda db: BillingService(db, mp=mp, email=mail))
    sent = []
    monkeypatch.setattr(EmailService, "send_account_deleted", lambda self, to: sent.append(to))
    app.dependency_overrides[get_current_user] = lambda: ana
    mp.fail.add("cancel_preapproval")

    response = await client.delete("/api/auth/me")

    assert response.status_code == 502
    assert sent == []
    async with factory() as db:
        assert await db.scalar(select(User).where(User.id == ana.id)) is not None


async def test_delete_account_route_emails_after_the_account_is_gone(monkeypatch, factory, client):
    ana = make_user()
    async with factory() as db:
        db.add(ana)
        await db.commit()
    sent = []
    monkeypatch.setattr(EmailService, "send_account_deleted", lambda self, to: sent.append(to))
    app.dependency_overrides[get_current_user] = lambda: ana

    response = await client.delete("/api/auth/me")

    assert response.status_code == 200
    assert sent == [ana.email]
    assert auth_router  # the route under test lives here


async def test_an_already_cancelled_subscription_is_not_cancelled_again(svc, mp, ana):
    sub, _ = await _subscribe(svc, mp, ana)
    await svc.cancel(ana, now=DAY_10)
    assert mp.calls.count("cancel_preapproval") == 1

    await svc.cancel_for_account_deletion(ana)

    assert (sub.cancel_at_period_end, mp.calls.count("cancel_preapproval")) == (True, 1)


# 6. Every invoice is read, not only the first page.


async def test_search_authorized_payments_reads_every_page(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        offset = int(request.url.params.get("offset", "0"))
        calls.append(offset)
        pages = {0: [{"id": 1}, {"id": 2}], 2: [{"id": 3}]}
        return httpx.Response(200, json={"paging": {"total": 3, "offset": offset}, "results": pages.get(offset, [])})

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        httpx, "AsyncClient", lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs)
    )

    results = await MercadoPagoClient(access_token="t", base_url="https://mp.test").search_authorized_payments("pa-1")

    assert [invoice["id"] for invoice in results] == [1, 2, 3]
    assert calls == [0, 2]


# 7. A change paid while the current plan is overdue starts at the payment, not in the past.


async def test_downgrade_paid_during_grace_starts_at_the_payment(svc, mp, ana):
    max_, _ = await _subscribe(svc, mp, ana, plan="max")
    mp.pay(max_.provider_subscription_id, when=MAY_1, status="rejected")
    await svc.sync(max_, now=MAY_1)
    paid = MAY_1 + timedelta(days=5)

    pro, _ = await _subscribe(svc, mp, ana, plan="pro", when=paid)

    assert (pro.status, pro.current_period_start) == ("scheduled", paid)
    assert pro.current_period_end == paid.replace(month=6)
    assert max_.grace_until == MAY_1 + GRACE


# The operator's e-mail: escaped, and required.


async def test_billing_admin_email_escapes_what_users_typed(monkeypatch):
    monkeypatch.setattr(settings, "BILLING_NOTIFY_EMAIL", "jean@example.com")
    out = []
    monkeypatch.setattr(EmailService, "_send", lambda self, to, subject, html, text=None: out.append(html))

    EmailService().send_billing_admin("Pagamento", ["Nome: <a href='http://evil.example'>clique</a>"])

    assert "<a href='http://evil.example'>" not in out[0]
    assert "&lt;a href=" in out[0]


async def test_billing_is_off_without_an_address_for_the_notices(monkeypatch):
    enable_billing(monkeypatch)
    assert billing_enabled() is True
    monkeypatch.setattr(settings, "BILLING_NOTIFY_EMAIL", "")
    assert billing_enabled() is False
