"""Contract of the Mercado Pago calls billing makes, and of the billing e-mails. No real call is made."""
import json
from datetime import datetime, timezone
from decimal import Decimal

import httpx
import pytest

from app.config import settings
from app.services.email_service import EmailService
from app.services.mercadopago_client import MercadoPagoClient, MercadoPagoError


@pytest.fixture
def mp(monkeypatch):
    """Routes by (method, path); returns the client, the calls it made and the routes to fill."""
    calls: list[httpx.Request] = []
    routes: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        route = routes.get((request.method, request.url.path))
        return route if route is not None else httpx.Response(404, json={"message": "no route"})

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        httpx, "AsyncClient", lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs)
    )
    return MercadoPagoClient(access_token="TEST-token", base_url="https://mp.test"), calls, routes


def _body(request: httpx.Request) -> dict:
    return json.loads(request.content)


@pytest.mark.asyncio
async def test_create_preapproval_sends_pending_monthly_brl(mp):
    client, calls, routes = mp
    routes[("POST", "/preapproval")] = httpx.Response(201, json={"id": "pa-1", "init_point": "https://mp/pay"})

    result = await client.create_preapproval(
        reason="CriptEnv Pro (mensal)", external_reference="sub-1", payer_email="a@b.co",
        amount=Decimal("29.00"), months=1, back_url="https://app/account/billing",
    )

    assert result == {"id": "pa-1", "init_point": "https://mp/pay"}
    assert calls[0].headers["authorization"] == "Bearer TEST-token"
    assert _body(calls[0]) == {
        "reason": "CriptEnv Pro (mensal)", "external_reference": "sub-1", "payer_email": "a@b.co",
        "back_url": "https://app/account/billing", "status": "pending",
        "auto_recurring": {"frequency": 1, "frequency_type": "months", "transaction_amount": 29.0, "currency_id": "BRL"},
    }


@pytest.mark.asyncio
async def test_create_preapproval_yearly_uses_frequency_12(mp):
    client, calls, routes = mp
    routes[("POST", "/preapproval")] = httpx.Response(201, json={"id": "pa-2"})

    await client.create_preapproval(
        reason="CriptEnv Max (anual)", external_reference="sub-2", payer_email="a@b.co",
        amount=Decimal("690.00"), months=12, back_url="https://app/account/billing",
    )

    assert _body(calls[0])["auto_recurring"] == {
        "frequency": 12, "frequency_type": "months", "transaction_amount": 690.0, "currency_id": "BRL",
    }


@pytest.mark.asyncio
async def test_get_preapproval_and_authorized_payment(mp):
    client, _, routes = mp
    routes[("GET", "/preapproval/pa-1")] = httpx.Response(200, json={"id": "pa-1", "status": "authorized"})
    routes[("GET", "/authorized_payments/77")] = httpx.Response(200, json={"id": 77, "preapproval_id": "pa-1"})

    assert (await client.get_preapproval("pa-1"))["status"] == "authorized"
    assert (await client.get_authorized_payment("77"))["preapproval_id"] == "pa-1"


@pytest.mark.asyncio
async def test_cancel_preapproval_puts_cancelled(mp):
    client, calls, routes = mp
    routes[("PUT", "/preapproval/pa-1")] = httpx.Response(200, json={"id": "pa-1", "status": "cancelled"})

    await client.cancel_preapproval("pa-1")

    assert _body(calls[0]) == {"status": "cancelled"}


@pytest.mark.asyncio
async def test_search_authorized_payments_returns_results(mp):
    client, calls, routes = mp
    routes[("GET", "/authorized_payments/search")] = httpx.Response(
        200, json={"paging": {"total": 1}, "results": [{"id": 77, "payment": {"id": 9, "status": "approved"}}]}
    )

    results = await client.search_authorized_payments("pa-1")

    assert results == [{"id": 77, "payment": {"id": 9, "status": "approved"}}]
    assert calls[0].url.params["preapproval_id"] == "pa-1"


@pytest.mark.asyncio
async def test_refund_full_sends_empty_body_and_idempotency_key(mp):
    client, calls, routes = mp
    routes[("POST", "/v1/payments/9/refunds")] = httpx.Response(201, json={"id": 1})

    await client.refund_payment("9", idempotency_key="refund-abc")

    assert _body(calls[0]) == {}
    assert calls[0].headers["x-idempotency-key"] == "refund-abc"


@pytest.mark.asyncio
async def test_refund_partial_sends_amount(mp):
    client, calls, routes = mp
    routes[("POST", "/v1/payments/9/refunds")] = httpx.Response(201, json={"id": 1})

    await client.refund_payment("9", idempotency_key="prorate-abc", amount=Decimal("12.34"))

    assert _body(calls[0]) == {"amount": 12.34}


@pytest.mark.asyncio
async def test_http_error_becomes_mercadopago_error(mp):
    client, _, routes = mp
    routes[("GET", "/preapproval/pa-1")] = httpx.Response(500, json={"message": "boom"})

    with pytest.raises(MercadoPagoError) as exc:
        await client.get_preapproval("pa-1")
    assert exc.value.status_code == 500


@pytest.mark.asyncio
async def test_network_error_becomes_mercadopago_error(monkeypatch):
    def handler(request):
        raise httpx.ConnectError("down")

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        httpx, "AsyncClient", lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs)
    )
    with pytest.raises(MercadoPagoError):
        await MercadoPagoClient(access_token="t", base_url="https://mp.test").get_preapproval("pa-1")


def test_is_cancelled_accepts_both_spellings():
    assert MercadoPagoClient.is_cancelled("cancelled") and MercadoPagoClient.is_cancelled("canceled")
    assert not MercadoPagoClient.is_cancelled("authorized") and not MercadoPagoClient.is_cancelled(None)


# ─── E-mails ─────────────────────────────────────────────────────────────────


@pytest.fixture
def sent(monkeypatch):
    out = []
    monkeypatch.setattr(
        EmailService, "_send", lambda self, to, subject, html, text=None: out.append((to, subject, html, text))
    )
    return out


WHEN = datetime(2027, 5, 1, 12, 0, tzinfo=timezone.utc)


def test_subscription_confirmed_email_names_plan_amount_and_dates(sent):
    EmailService().send_subscription_confirmed(
        "ana@example.com", plan="max", interval="year", amount=Decimal("690.00"), starts_at=WHEN, period_end=WHEN,
    )
    to, subject, html, text = sent[0]
    assert to == "ana@example.com"
    assert "Max" in subject
    assert "R$ 690,00" in text and "01/05/2027" in text


def test_payment_failed_email_says_until_when_the_plan_holds(sent):
    EmailService().send_payment_failed("ana@example.com", plan="pro", grace_until=WHEN)
    assert "01/05/2027" in sent[0][3] and "/account/billing" in sent[0][3]


def test_back_to_free_and_canceled_emails(sent):
    EmailService().send_back_to_free("ana@example.com", plan="pro")
    EmailService().send_subscription_canceled("ana@example.com", plan="pro", ends_at=WHEN, refunded=False)
    EmailService().send_subscription_canceled("ana@example.com", plan="pro", ends_at=None, refunded=True)
    assert "Free" in sent[0][3]
    assert "01/05/2027" in sent[1][3]
    assert "devolvido" in sent[2][3]


def test_billing_admin_email_goes_to_the_configured_address(sent, monkeypatch):
    monkeypatch.setattr(settings, "BILLING_NOTIFY_EMAIL", "jean@example.com")
    EmailService().send_billing_admin("Pagamento aprovado", ["Plano: Pro", "CPF/CNPJ: 52998224725"])
    to, subject, _, text = sent[0]
    assert to == "jean@example.com"
    assert subject == "[CriptEnv cobrança] Pagamento aprovado"
    assert "CPF/CNPJ: 52998224725" in text


def test_billing_admin_email_without_address_sends_nothing(sent, monkeypatch):
    monkeypatch.setattr(settings, "BILLING_NOTIFY_EMAIL", "")
    assert EmailService().send_billing_admin("x", ["y"]) is None
    assert sent == []
