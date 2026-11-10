"""Shared helpers for the billing tests: rows, the switch that turns billing on, and (Task 2) the fakes."""
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from app.config import settings
from app.models.subscription import Subscription
from app.models.user import User
from app.plans import PRICES

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


def money(value: str) -> Decimal:
    return Decimal(value)
