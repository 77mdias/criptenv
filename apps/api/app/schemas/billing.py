from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class TaxInfo(BaseModel):
    """Invoice (NFS-e) data. The service validates the content; this only bounds the size."""

    tax_id: str = Field(max_length=14)
    legal_name: str = Field(max_length=200)
    address: str = Field(max_length=500)


class CheckoutRequest(TaxInfo):
    plan: Literal["pro", "max"]
    interval: Literal["month", "year"]
    # The e-mail of the buyer's Mercado Pago account: they reject the payment when it differs.
    payer_email: str = Field(max_length=320)


class CheckoutResponse(BaseModel):
    init_point: str


class CancelResponse(BaseModel):
    refunded: bool
    ends_at: datetime | None


class SubscriptionResponse(BaseModel):
    id: str
    plan: str
    interval: str
    status: str
    amount: Decimal
    cancel_at_period_end: bool
    current_period_start: datetime | None
    current_period_end: datetime | None
    grace_until: datetime | None
    init_point: str | None
    tax_id: str
    legal_name: str
    address: str
    payer_email: str

    model_config = {"from_attributes": True, "coerce_numbers_to_str": False}


class BillingStateResponse(BaseModel):
    # plan -> interval -> price of one cycle, in BRL.
    prices: dict[str, dict[str, Decimal]]
    subscription: SubscriptionResponse | None
    scheduled: SubscriptionResponse | None
    pending: SubscriptionResponse | None
    # A cancel now gives the money back (within 7 days of the first charge, once per account).
    refund_eligible: bool
