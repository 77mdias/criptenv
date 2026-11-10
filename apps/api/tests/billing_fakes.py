"""Shared helpers for the billing tests: rows, the switch that turns billing on, and (Task 2) the fakes."""
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from app.config import settings
from app.models.subscription import Subscription
from app.models.user import User
from app.plans import PRICES
from app.services.mercadopago_client import MercadoPagoError

UTC = timezone.utc
T0 = datetime(2027, 4, 1, 12, 0, tzinfo=UTC)  # April has 30 days: a month paid at T0 ends on May 1st.


def enable_billing(monkeypatch) -> None:
    monkeypatch.setattr(settings, "BILLING_ENABLED", True)
    monkeypatch.setattr(settings, "MERCADO_PAGO_ACCESS_TOKEN", "TEST-access-token")
    monkeypatch.setattr(settings, "MERCADO_PAGO_WEBHOOK_SECRET", "test-webhook-secret")


def make_user(plan=None) -> User:
    uid = uuid4()
    return User(id=uid, email=f"{uid.hex[:8]}@example.com", name="Ana", password_hash="",
                kdf_salt="salt", email_verified=True, plan=plan)


def make_subscription(user, *, plan="pro", interval="month", status="active", **fields) -> Subscription:
    sid = uuid4()
    return Subscription(
        id=sid, user_id=user.id, plan=plan, interval=interval, status=status,
        amount=PRICES[(plan, interval)], provider_subscription_id=f"pa-{sid.hex[:8]}",
        tax_id="52998224725", legal_name="Ana Souza", address="Rua A, 1, São Paulo, SP",
        payer_email=user.email, **fields,
    )


class FakeMercadoPago:
    """Mercado Pago in memory, with the methods billing calls. `fail` names the methods that raise."""

    def __init__(self):
        self.preapprovals: dict[str, dict] = {}
        self.invoices: dict[str, list[dict]] = {}
        self.payments: dict[str, dict] = {}
        self.refunds: list[tuple[str, Decimal | None, str]] = []
        self.cancelled: list[str] = []
        self.fail: set[str] = set()
        self.calls: list[str] = []
        self._seq = 1000

    def _next(self) -> int:
        self._seq += 1
        return self._seq

    def _enter(self, name: str) -> None:
        self.calls.append(name)
        if name in self.fail:
            raise MercadoPagoError(f"{name} failed", status_code=500)

    def _preapproval(self, preapproval_id: str) -> dict:
        self.invoices.setdefault(preapproval_id, [])
        return self.preapprovals.setdefault(preapproval_id, {"id": preapproval_id, "status": "authorized"})

    async def create_preapproval(self, *, reason, external_reference, payer_email, amount, months, back_url):
        self._enter("create_preapproval")
        pid = f"pa-{self._next()}"
        self.preapprovals[pid] = {
            "id": pid, "status": "pending", "reason": reason, "external_reference": external_reference,
            "payer_email": payer_email, "amount": amount, "months": months, "back_url": back_url,
            "init_point": f"https://mp.test/checkout/{pid}",
        }
        self.invoices[pid] = []
        return dict(self.preapprovals[pid])

    async def get_preapproval(self, preapproval_id):
        self._enter("get_preapproval")
        return dict(self._preapproval(preapproval_id))

    async def cancel_preapproval(self, preapproval_id):
        self._enter("cancel_preapproval")
        self._preapproval(preapproval_id)["status"] = "cancelled"
        self.cancelled.append(preapproval_id)
        return dict(self.preapprovals[preapproval_id])

    async def get_authorized_payment(self, authorized_payment_id):
        self._enter("get_authorized_payment")
        for invoices in self.invoices.values():
            for invoice in invoices:
                if str(invoice["id"]) == str(authorized_payment_id):
                    return dict(invoice)
        raise MercadoPagoError("invoice not found", status_code=404)

    async def search_authorized_payments(self, preapproval_id):
        self._enter("search_authorized_payments")
        return [dict(invoice) for invoice in self.invoices.get(preapproval_id, [])]

    async def get_payment(self, payment_id):
        self._enter("get_payment")
        return dict(self.payments[str(payment_id)])

    async def refund_payment(self, payment_id, *, idempotency_key, amount=None):
        self._enter("refund_payment")
        self.refunds.append((str(payment_id), amount, idempotency_key))
        return {"id": self._next()}

    # What the buyer (or Mercado Pago itself) does on their side.

    def pay(self, preapproval_id: str, *, when: datetime, status: str = "approved", amount: Decimal | None = None) -> str:
        """A charge of the subscription: an invoice plus its payment. Returns the payment id."""
        preapproval = self._preapproval(preapproval_id)
        amount = amount if amount is not None else preapproval.get("amount", Decimal("29.00"))
        payment_id = str(self._next())
        self.payments[payment_id] = {
            "id": int(payment_id), "status": status, "transaction_amount": float(amount),
            "date_approved": when.isoformat() if status == "approved" else None,
        }
        self.invoices[preapproval_id].append({
            "id": self._next(), "preapproval_id": preapproval_id, "status": "processed",
            "transaction_amount": float(amount), "date_created": when.isoformat(),
            "payment": {"id": int(payment_id), "status": status},
        })
        if status == "approved":
            preapproval["status"] = "authorized"
        return payment_id

    def invoice_id(self, payment_id: str) -> str:
        for invoices in self.invoices.values():
            for invoice in invoices:
                if str(invoice["payment"]["id"]) == str(payment_id):
                    return str(invoice["id"])
        raise KeyError(payment_id)

    def cancel_remote(self, preapproval_id: str) -> None:
        """The buyer cancelled from their Mercado Pago account."""
        self._preapproval(preapproval_id)["status"] = "cancelled"


class FakeEmail:
    """Records every send_* call as (name, kwargs); `fail` makes them raise."""

    def __init__(self):
        self.sent: list[tuple[str, tuple, dict]] = []
        self.fail = False

    def __getattr__(self, name):
        if not name.startswith("send_"):
            raise AttributeError(name)

        def record(*args, **kwargs):
            if self.fail:
                raise RuntimeError("email down")
            self.sent.append((name, args, kwargs))

        return record

    def names(self) -> list[str]:
        return [name for name, _, _ in self.sent]
