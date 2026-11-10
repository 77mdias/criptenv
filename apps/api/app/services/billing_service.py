"""Subscriptions (Pro/Max) billed through Mercado Pago.

The only writer of `users.plan`. A plan is released by an `approved` payment read
from Mercado Pago with our token, never by the browser's return or a webhook body.

Every state change comes from `BillingService.sync`: it re-reads the subscription
and its invoices at Mercado Pago and applies each approved payment once. The
webhook, the "I already paid" button and the hourly job only call it, so a
notification that repeats or arrives out of order changes nothing.
"""
import calendar
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.subscription import LIVE_STATUSES, Subscription, SubscriptionPayment
from app.models.user import User
from app.plans import INTERVAL_MONTHS, PLAN_RANK, PRICES
from app.services.audit_service import AuditService
from app.services.email_service import EmailService
from app.services.mercadopago_client import MercadoPagoClient, MercadoPagoError
from app.strategies.exceptions import BillingConflict, BillingProviderError

logger = logging.getLogger(__name__)

# How long the plan holds after a charge is refused.
GRACE = timedelta(days=7)
# Right of withdrawal: a full refund within this time of the first charge of a new subscription.
REFUND_WINDOW = timedelta(days=7)
# A renewal that is this late with no word from Mercado Pago counts as unpaid.
RENEWAL_SLACK = timedelta(days=1)
# An unpaid checkout older than this is abandoned.
PENDING_TTL = timedelta(hours=48)

_REASONS = {
    ("pro", "month"): "CriptEnv Pro (mensal)", ("pro", "year"): "CriptEnv Pro (anual)",
    ("max", "month"): "CriptEnv Max (mensal)", ("max", "year"): "CriptEnv Max (anual)",
}


def billing_enabled() -> bool:
    """Off unless the operator turned it on and Mercado Pago is configured (self-hosted installs never bill)."""
    return bool(
        settings.BILLING_ENABLED and settings.MERCADO_PAGO_ACCESS_TOKEN and settings.MERCADO_PAGO_WEBHOOK_SECRET
    )


async def grace_until_for(db: AsyncSession, user_id: UUID) -> datetime | None:
    """Until when the user's plan holds while a payment is overdue; None when nothing is overdue."""
    return await db.scalar(
        select(Subscription.grace_until).where(Subscription.user_id == user_id, Subscription.status == "past_due")
    )


def add_months(dt: datetime, months: int) -> datetime:
    """Same day `months` later, or the last day of that month when it is shorter (Jan 31 -> Feb 28)."""
    index = dt.month - 1 + months
    year, month = dt.year + index // 12, index % 12 + 1
    return dt.replace(year=year, month=month, day=min(dt.day, calendar.monthrange(year, month)[1]))


def _aware(dt: datetime | None) -> datetime | None:
    # SQLite (tests) hands back naive datetimes; everything here is UTC.
    return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _validate_invoice_data(tax_id: str, legal_name: str, address: str) -> None:
    # shortcut: format only (11 or 14 digits), no check digits; upgrade when invoices are issued automatically.
    if not (tax_id.isdigit() and len(tax_id) in (11, 14)):
        raise ValueError("tax_id must be a CPF (11 digits) or a CNPJ (14 digits), digits only")
    if not legal_name.strip() or not address.strip():
        raise ValueError("legal_name and address are required")


class BillingService:
    def __init__(self, db: AsyncSession, mp: MercadoPagoClient | None = None, email: EmailService | None = None):
        self.db = db
        self.mp = mp or MercadoPagoClient()
        self.email = email or EmailService()
        self.audit = AuditService(db)

    # ─── Reading ──────────────────────────────────────────────────────────────

    async def _subscriptions(self, user_id: UUID, *statuses: str) -> list[Subscription]:
        result = await self.db.scalars(
            select(Subscription)
            .where(Subscription.user_id == user_id, Subscription.status.in_(statuses))
            .order_by(Subscription.created_at.desc())
        )
        return list(result)

    async def _one(self, user_id: UUID, *statuses: str) -> Subscription | None:
        found = await self._subscriptions(user_id, *statuses)
        return found[0] if found else None

    # ─── Small pieces ─────────────────────────────────────────────────────────

    def _mail(self, method: str, *args, **kwargs) -> None:
        """An e-mail never decides whether a subscription changes state."""
        try:
            getattr(self.email, method)(*args, **kwargs)
        except Exception:
            logger.exception("Billing e-mail %s failed", method)

    async def _log(self, action: str, subscription: Subscription, **metadata) -> None:
        await self.audit.log(
            action, "subscription", resource_id=subscription.id, user_id=subscription.user_id,
            metadata={"plan": subscription.plan, "interval": subscription.interval, **metadata},
        )

    async def _cancel_remote_quietly(self, subscription: Subscription) -> None:
        """Stop charges at Mercado Pago where a failure must not stop us (the job retries nothing here)."""
        if not subscription.provider_subscription_id:
            return
        try:
            await self.mp.cancel_preapproval(subscription.provider_subscription_id)
        except MercadoPagoError:
            logger.exception("Could not cancel preapproval %s", subscription.provider_subscription_id)

    @staticmethod
    def _end(subscription: Subscription, now: datetime) -> None:
        subscription.status = "ended"
        subscription.ended_at = now
        subscription.grace_until = None

    # ─── Subscribing ──────────────────────────────────────────────────────────

    async def checkout(
        self, user: User, *, plan: str, interval: str, tax_id: str, legal_name: str, address: str, payer_email: str,
    ) -> Subscription:
        """A pending subscription and its checkout at Mercado Pago. Nothing changes until a payment is approved."""
        if plan not in PLAN_RANK or interval not in INTERVAL_MONTHS:
            raise ValueError("Unknown plan or interval")
        _validate_invoice_data(tax_id, legal_name, address)
        if "@" not in payer_email:
            raise ValueError("payer_email must be an e-mail address")

        live = await self._one(user.id, *LIVE_STATUSES)
        if live and (live.plan, live.interval) == (plan, interval) and not live.cancel_at_period_end:
            raise BillingConflict("You already subscribe to this plan")
        if await self._one(user.id, "scheduled"):
            raise BillingConflict("A plan change is already scheduled")

        subscription = Subscription(
            id=uuid4(), user_id=user.id, plan=plan, interval=interval, status="pending",
            amount=PRICES[(plan, interval)], tax_id=tax_id, legal_name=legal_name.strip(),
            address=address.strip(), payer_email=payer_email.strip(),
        )
        try:
            preapproval = await self.mp.create_preapproval(
                reason=_REASONS[(plan, interval)],
                external_reference=str(subscription.id),
                payer_email=subscription.payer_email,
                amount=subscription.amount,
                months=INTERVAL_MONTHS[interval],
                back_url=settings.FRONTEND_URL.rstrip("/") + "/account/billing",
            )
        except MercadoPagoError as e:
            raise BillingProviderError() from e
        subscription.provider_subscription_id = str(preapproval["id"])
        subscription.init_point = preapproval.get("init_point")

        # One open checkout per user: an older one must not be paid by mistake later.
        now = datetime.now(timezone.utc)
        for older in await self._subscriptions(user.id, "pending"):
            self._end(older, now)
            await self._cancel_remote_quietly(older)

        self.db.add(subscription)
        await self.db.flush()
        return subscription

    # ─── The one place state changes: re-read Mercado Pago ────────────────────

    async def process_notification(self, topic: str, data_id: str) -> bool:
        """A webhook notification: find our subscription and sync it. False when it is not ours."""
        if topic == "subscription_preapproval":
            preapproval_id = data_id
        elif topic == "subscription_authorized_payment":
            preapproval_id = (await self.mp.get_authorized_payment(data_id)).get("preapproval_id")
        else:
            return False
        subscription = await self.db.scalar(
            select(Subscription).where(Subscription.provider_subscription_id == str(preapproval_id))
        )
        if subscription is None:
            return False
        await self.sync(subscription)
        return True

    async def sync(self, subscription: Subscription, now: datetime | None = None) -> None:
        """Bring one subscription in line with Mercado Pago. Safe to call any number of times."""
        now = now or datetime.now(timezone.utc)
        # The row lock makes two syncs of the same subscription take turns (webhook, button and job).
        await self.db.execute(select(Subscription.id).where(Subscription.id == subscription.id).with_for_update())
        await self.db.refresh(subscription)
        if not subscription.provider_subscription_id:
            return

        preapproval = await self.mp.get_preapproval(subscription.provider_subscription_id)
        invoices = await self.mp.search_authorized_payments(subscription.provider_subscription_id)

        approved = {
            str(invoice["payment"]["id"])
            for invoice in invoices
            if (invoice.get("payment") or {}).get("status") == "approved"
        }
        if approved:
            applied = set(await self.db.scalars(
                select(SubscriptionPayment.provider_payment_id)
                .where(SubscriptionPayment.provider_payment_id.in_(approved))
            ))
            new_payments = []
            for payment_id in approved - applied:
                payment = await self.mp.get_payment(payment_id)
                if payment.get("status") != "approved":
                    continue
                paid_at = payment.get("date_approved")
                new_payments.append((
                    _aware(datetime.fromisoformat(paid_at)) if paid_at else now,
                    payment_id,
                    Decimal(str(payment.get("transaction_amount", subscription.amount))),
                ))
            for paid_at, payment_id, amount in sorted(new_payments):
                await self._apply_payment(subscription, payment_id, amount, paid_at, now)

        latest = max(invoices, key=lambda invoice: invoice.get("date_created") or "", default=None)
        if (
            latest and (latest.get("payment") or {}).get("status") == "rejected"
            and subscription.status == "active"
        ):
            subscription.status = "past_due"
            subscription.grace_until = now + GRACE
            await self._log("subscription.past_due", subscription)
            user = await self.db.get(User, subscription.user_id)
            self._mail("send_payment_failed", user.email, plan=subscription.plan, grace_until=subscription.grace_until)

        if (
            MercadoPagoClient.is_cancelled(preapproval.get("status"))
            and subscription.status in ("active", "past_due", "scheduled")
            and not subscription.cancel_at_period_end
        ):
            # Cancelled on their side (by the buyer, or after too many refused charges): the paid time still holds.
            subscription.cancel_at_period_end = True

        await self.db.flush()

    async def _apply_payment(
        self, subscription: Subscription, payment_id: str, amount: Decimal, paid_at: datetime, now: datetime,
    ) -> None:
        """An approved payment, applied once: provider_payment_id is unique, so a second insert fails the request."""
        self.db.add(SubscriptionPayment(
            id=uuid4(), subscription_id=subscription.id, provider_payment_id=payment_id, amount=amount, paid_at=paid_at,
        ))
        await self.db.flush()
        user = await self.db.get(User, subscription.user_id)
        months = INTERVAL_MONTHS[subscription.interval]

        if subscription.status == "pending":
            subscription.status = "active"
            subscription.current_period_start = paid_at
            subscription.current_period_end = add_months(paid_at, months)
            subscription.first_payment_at = paid_at
            user.plan = subscription.plan
            await self._log("subscription.activated", subscription)
            self._mail(
                "send_subscription_confirmed", user.email, plan=subscription.plan, interval=subscription.interval,
                amount=amount, starts_at=subscription.current_period_start, period_end=subscription.current_period_end,
            )
        else:
            # A renewal counts from where the paid time ended, or from the payment when it came late.
            start = max(_aware(subscription.current_period_end), paid_at)
            subscription.current_period_start = start
            subscription.current_period_end = add_months(start, months)
            subscription.grace_until = None
            if subscription.status == "past_due":
                subscription.status = "active"
            await self._log("subscription.renewed", subscription)

        self._mail("send_billing_admin", "Pagamento aprovado: emitir nota", [
            f"Plano: {_REASONS[(subscription.plan, subscription.interval)]}",
            f"Valor: R$ {amount}",
            f"Pago em: {paid_at:%d/%m/%Y %H:%M} UTC",
            f"Pagamento no Mercado Pago: {payment_id}",
            f"Conta: {user.email}",
            f"CPF/CNPJ: {subscription.tax_id}",
            f"Nome ou razão social: {subscription.legal_name}",
            f"Endereço: {subscription.address}",
        ])
