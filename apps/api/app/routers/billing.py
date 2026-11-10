"""Subscriptions: what the account's billing screen calls. Every route is 404 while billing is off."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.billing import (
    BillingStateResponse, CancelResponse, CheckoutRequest, CheckoutResponse, SubscriptionResponse, TaxInfo,
)
from app.services.billing_service import BillingService, billing_enabled
from app.services.mercadopago_client import MercadoPagoError
from app.strategies.exceptions import BillingProviderError, DomainError


def require_billing() -> None:
    if not billing_enabled():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


def get_billing_service(db: AsyncSession = Depends(get_db)) -> BillingService:
    return BillingService(db)


router = APIRouter(prefix="/api/v1/billing", tags=["Billing"], dependencies=[Depends(require_billing)])


def _http(error: Exception) -> HTTPException:
    if isinstance(error, ValueError):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error))
    if isinstance(error, MercadoPagoError):
        error = BillingProviderError()
    return HTTPException(status_code=error.status_code, detail=error.detail)


def _subscription(row) -> SubscriptionResponse | None:
    return None if row is None else SubscriptionResponse.model_validate({**row.__dict__, "id": str(row.id)})


async def _state(billing: BillingService, user: User) -> BillingStateResponse:
    state = await billing.state(user)
    return BillingStateResponse(
        prices=state["prices"],
        subscription=_subscription(state["subscription"]),
        scheduled=_subscription(state["scheduled"]),
        pending=_subscription(state["pending"]),
        refund_eligible=state["refund_eligible"],
    )


@router.get("", response_model=BillingStateResponse)
async def get_billing(
    current_user: User = Depends(get_current_user), billing: BillingService = Depends(get_billing_service),
):
    """Prices, the subscription in force, a scheduled change and an open checkout."""
    return await _state(billing, current_user)


@router.post("/checkout", response_model=CheckoutResponse)
async def checkout(
    body: CheckoutRequest,
    current_user: User = Depends(get_current_user), billing: BillingService = Depends(get_billing_service),
):
    """Start a subscription: returns where to pay. The plan only changes when the payment is confirmed."""
    try:
        subscription = await billing.checkout(current_user, **body.model_dump())
    except (ValueError, DomainError) as e:
        raise _http(e)
    return CheckoutResponse(init_point=subscription.init_point)


@router.post("/cancel", response_model=CancelResponse)
async def cancel(
    current_user: User = Depends(get_current_user), billing: BillingService = Depends(get_billing_service),
):
    try:
        result = await billing.cancel(current_user)
    except DomainError as e:
        raise _http(e)
    return CancelResponse(refunded=result.refunded, ends_at=result.ends_at)


@router.post("/sync", response_model=BillingStateResponse)
async def sync(
    current_user: User = Depends(get_current_user), billing: BillingService = Depends(get_billing_service),
):
    """Re-read Mercado Pago now (the return from their checkout, or "I already paid")."""
    try:
        await billing.sync_user(current_user)
    except MercadoPagoError as e:
        raise _http(e)
    return await _state(billing, current_user)


@router.patch("/tax-info", response_model=BillingStateResponse)
async def update_tax_info(
    body: TaxInfo,
    current_user: User = Depends(get_current_user), billing: BillingService = Depends(get_billing_service),
):
    try:
        await billing.update_tax_info(current_user, **body.model_dump())
    except (ValueError, DomainError) as e:
        raise _http(e)
    return await _state(billing, current_user)
