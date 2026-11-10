"""Billing over HTTP: the /api/v1/billing routes and the subscription topics of the Mercado Pago webhook."""
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from fastapi import Depends
from sqlalchemy import func, select

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.subscription import Subscription, SubscriptionPayment
from app.models.user import User
from app.routers.billing import get_billing_service
from app.services.billing_service import BillingService
from app.services.contribution_service import ContributionService
from main import app
from tests.billing_fakes import FakeEmail, FakeMercadoPago, enable_billing, make_user

pytestmark = pytest.mark.asyncio

INFO = {"tax_id": "52998224725", "legal_name": "Ana Souza", "address": "Rua A, 1", "payer_email": "ana@mp.example"}
CHECKOUT = {"plan": "pro", "interval": "month", **INFO}


@pytest.fixture
def mp():
    return FakeMercadoPago()


@pytest.fixture
def mail():
    return FakeEmail()


@pytest_asyncio.fixture
async def ana(factory):
    user = make_user()
    async with factory() as db:
        db.add(user)
        await db.commit()
    return user


@pytest.fixture
def as_ana(client, mp, mail, ana):
    """Ana is signed in and the routes talk to the fake Mercado Pago."""
    def _service(db=Depends(get_db)):
        return BillingService(db, mp=mp, email=mail)

    app.dependency_overrides[get_billing_service] = _service
    app.dependency_overrides[get_current_user] = lambda: ana
    yield client
    app.dependency_overrides.pop(get_billing_service, None)


@pytest.fixture
def billing(monkeypatch, as_ana):
    enable_billing(monkeypatch)
    return as_ana


async def _row(factory, model, *where):
    async with factory() as db:
        return await db.scalar(select(model).where(*where))


async def _count(factory, model):
    async with factory() as db:
        return await db.scalar(select(func.count()).select_from(model))


def _signed(data_id: str, request_id: str = "req-1", ts: str = "1234567890") -> dict:
    manifest = f"id:{data_id};request-id:{request_id};ts:{ts};"
    sig = hmac.new(settings.MERCADO_PAGO_WEBHOOK_SECRET.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return {"x-signature": f"ts={ts},v1={sig}", "x-request-id": request_id}


async def _notify(client, topic: str, data_id: str, headers: dict | None = None):
    return await client.post(
        "/webhooks/mercadopago",
        json={"type": topic, "action": "updated", "data": {"id": data_id}},
        headers=_signed(data_id) if headers is None else headers,
    )


# ─── Off by default ──────────────────────────────────────────────────────────


@pytest.mark.parametrize("method,path", [
    ("GET", ""), ("POST", "/checkout"), ("POST", "/cancel"), ("POST", "/sync"), ("PATCH", "/tax-info"),
])
async def test_routes_are_404_when_billing_is_off(as_ana, mp, method, path):
    response = await as_ana.request(method, f"/api/v1/billing{path}", json=CHECKOUT)

    assert response.status_code == 404
    assert mp.calls == []


async def test_routes_need_a_session(monkeypatch, client):
    enable_billing(monkeypatch)
    assert (await client.get("/api/v1/billing")).status_code == 401


# ─── Routes ──────────────────────────────────────────────────────────────────


async def test_checkout_returns_init_point(billing, factory, ana):
    response = await billing.post("/api/v1/billing/checkout", json=CHECKOUT)

    sub = await _row(factory, Subscription, Subscription.user_id == ana.id)
    assert response.status_code == 200
    assert response.json() == {"init_point": f"https://mp.test/checkout/{sub.provider_subscription_id}"}
    assert sub.status == "pending"


@pytest.mark.parametrize("bad", [{"tax_id": "abc"}, {"plan": "free"}, {"interval": "week"}, {"payer_email": "x"}])
async def test_checkout_validation_is_422(billing, factory, bad):
    response = await billing.post("/api/v1/billing/checkout", json={**CHECKOUT, **bad})

    assert response.status_code == 422
    assert await _count(factory, Subscription) == 0


async def test_checkout_provider_down_is_502_and_leaves_nothing(billing, factory, mp):
    mp.fail.add("create_preapproval")

    response = await billing.post("/api/v1/billing/checkout", json=CHECKOUT)

    assert response.status_code == 502
    assert await _count(factory, Subscription) == 0


async def _subscribe(client, mp, factory, ana, when=None):
    """Checkout, pay, and let the "I already paid" button find the payment."""
    await client.post("/api/v1/billing/checkout", json=CHECKOUT)
    sub = await _row(factory, Subscription, Subscription.user_id == ana.id, Subscription.status == "pending")
    payment = mp.pay(sub.provider_subscription_id, when=when or datetime.now(timezone.utc))
    response = await client.post("/api/v1/billing/sync")
    assert response.status_code == 200
    return sub, payment, response.json()


async def test_sync_applies_a_payment_the_webhook_missed(billing, factory, mp, ana):
    _, _, state = await _subscribe(billing, mp, factory, ana)

    assert state["subscription"]["status"] == "active"
    assert (await _row(factory, User, User.id == ana.id)).plan == "pro"


async def test_get_state_shows_prices_and_subscription(billing, factory, mp, ana):
    await _subscribe(billing, mp, factory, ana)

    body = (await billing.get("/api/v1/billing")).json()

    assert body["prices"] == {"pro": {"month": "29.00", "year": "290.00"}, "max": {"month": "69.00", "year": "690.00"}}
    assert (body["scheduled"], body["pending"], body["refund_eligible"]) == (None, None, True)
    subscription = body["subscription"]
    assert (subscription["plan"], subscription["interval"], subscription["amount"]) == ("pro", "month", "29.00")
    assert subscription["tax_id"] == "52998224725"
    assert subscription["current_period_end"].endswith(("Z", "+00:00"))


async def test_checkout_conflict_is_409(billing, factory, mp, ana):
    await _subscribe(billing, mp, factory, ana)

    assert (await billing.post("/api/v1/billing/checkout", json=CHECKOUT)).status_code == 409


async def test_cancel_refunds_within_seven_days(billing, factory, mp, ana):
    _, payment, _ = await _subscribe(billing, mp, factory, ana)

    response = await billing.post("/api/v1/billing/cancel")

    assert response.json() == {"refunded": True, "ends_at": None}
    assert [refund[0] for refund in mp.refunds] == [payment]
    user = await _row(factory, User, User.id == ana.id)
    assert (user.plan, user.refund_used_at is not None) == (None, True)


async def test_cancel_provider_down_is_502(billing, factory, mp, ana):
    await _subscribe(billing, mp, factory, ana)
    mp.fail.add("cancel_preapproval")

    assert (await billing.post("/api/v1/billing/cancel")).status_code == 502
    assert (await _row(factory, User, User.id == ana.id)).plan == "pro"


async def test_cancel_without_subscription_is_409(billing):
    assert (await billing.post("/api/v1/billing/cancel")).status_code == 409


async def test_sync_provider_down_is_502(billing, factory, mp, ana):
    await _subscribe(billing, mp, factory, ana)
    mp.fail.add("get_preapproval")

    assert (await billing.post("/api/v1/billing/sync")).status_code == 502


async def test_tax_info_is_updated_and_validated(billing, factory, mp, ana):
    await _subscribe(billing, mp, factory, ana)

    ok = await billing.patch(
        "/api/v1/billing/tax-info", json={"tax_id": "11222333000181", "legal_name": "Ana ME", "address": "Rua B, 2"}
    )
    bad = await billing.patch(
        "/api/v1/billing/tax-info", json={"tax_id": "1", "legal_name": "Ana ME", "address": "Rua B, 2"}
    )

    assert (ok.status_code, bad.status_code) == (200, 422)
    assert ok.json()["subscription"]["legal_name"] == "Ana ME"


# ─── Webhook: subscription topics ────────────────────────────────────────────


async def _pending_with_payment(client, mp, factory, ana):
    await client.post("/api/v1/billing/checkout", json=CHECKOUT)
    sub = await _row(factory, Subscription, Subscription.user_id == ana.id)
    payment = mp.pay(sub.provider_subscription_id, when=datetime.now(timezone.utc))
    return sub, payment


async def test_webhook_subscription_topic_syncs(billing, factory, mp, ana):
    _, payment = await _pending_with_payment(billing, mp, factory, ana)

    response = await _notify(billing, "subscription_authorized_payment", mp.invoice_id(payment))

    assert (response.status_code, response.json()["received"]) == (200, True)
    assert (await _row(factory, User, User.id == ana.id)).plan == "pro"


async def test_webhook_repeated_and_out_of_order_notifications_change_nothing(billing, factory, mp, ana):
    sub, payment = await _pending_with_payment(billing, mp, factory, ana)
    invoice = mp.invoice_id(payment)

    for topic, data_id in [
        ("subscription_authorized_payment", invoice),
        ("subscription_preapproval", sub.provider_subscription_id),
        ("subscription_authorized_payment", invoice),
    ]:
        assert (await _notify(billing, topic, data_id)).status_code == 200

    assert await _count(factory, SubscriptionPayment) == 1
    synced = await _row(factory, Subscription, Subscription.id == sub.id)
    assert synced.current_period_end - synced.current_period_start < timedelta(days=32)


async def test_webhook_invalid_signature_is_401_for_subscription_topics(billing, factory, mp, ana):
    _, payment = await _pending_with_payment(billing, mp, factory, ana)
    mp.calls.clear()

    response = await _notify(
        billing, "subscription_authorized_payment", mp.invoice_id(payment),
        headers={"x-signature": "ts=1,v1=deadbeef", "x-request-id": "req-1"},
    )

    assert response.status_code == 401
    assert mp.calls == []
    assert (await _row(factory, User, User.id == ana.id)).plan is None


async def test_webhook_provider_error_is_500_for_subscription_topics(billing, factory, mp, ana):
    sub, _ = await _pending_with_payment(billing, mp, factory, ana)
    mp.fail.add("get_preapproval")

    response = await _notify(billing, "subscription_preapproval", sub.provider_subscription_id)

    assert response.status_code == 500
    assert (await _row(factory, User, User.id == ana.id)).plan is None


async def test_webhook_unknown_subscription_is_acknowledged(billing):
    response = await _notify(billing, "subscription_preapproval", "pa-not-ours")

    assert (response.status_code, response.json()["received"]) == (200, True)


async def test_webhook_ignores_subscription_topics_when_billing_is_off(as_ana, mp):
    response = await _notify(as_ana, "subscription_preapproval", "pa-1")

    assert (response.status_code, response.json()["received"]) == (200, True)
    assert mp.calls == []


async def test_contribution_webhook_still_works(billing, mp):
    with patch.object(ContributionService, "process_webhook_notification", new_callable=AsyncMock) as process:
        process.return_value = True
        response = await _notify(billing, "payment", "123456789")

    assert response.status_code == 200
    process.assert_awaited_once_with(payment_id=123456789, external_reference=None)
    assert mp.calls == []
