"""Router for external webhook endpoints

Handles Mercado Pago and other provider webhooks.
These endpoints are mounted without API version prefix
so provider dashboards can use stable URLs.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.contribution import MercadoPagoWebhookPayload, WebhookResponse
from app.services.contribution_service import ContributionService, PaymentProviderError
from app.services.webhook_security import validate_mercadopago_signature

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("/mercadopago", response_model=WebhookResponse)
async def mercadopago_webhook(
    request: Request,
    payload: MercadoPagoWebhookPayload,
    db: AsyncSession = Depends(get_db)
):
    """Receive Mercado Pago webhook notifications.
    
    This endpoint receives payment status updates from Mercado Pago.
    It validates the webhook signature, queries Mercado Pago for the
    authoritative payment status, and updates the local contribution.
    
    The endpoint returns 401 if the signature is invalid, and 200
    for all other cases to prevent Mercado Pago retries.
    
    Args:
        payload: Mercado Pago webhook notification body
        
    Returns:
        Acknowledgment response
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Log receipt (safely - no sensitive data)
    logger.info(
        "Received Mercado Pago webhook: type=%s, action=%s",
        payload.type, payload.action
    )
    
    # Extract data.id from notification for signature validation
    data_id: Optional[str] = None
    if payload.data and isinstance(payload.data, dict):
        data_id = str(payload.data.get("id", "")) or None
    
    # Validate webhook signature
    x_signature = request.headers.get("x-signature")
    x_request_id = request.headers.get("x-request-id")
    
    is_valid = validate_mercadopago_signature(x_signature, x_request_id, data_id)
    if not is_valid:
        logger.warning(
            "Webhook signature validation failed: x-signature=%s, x-request-id=%s",
            x_signature, x_request_id
        )
        # Return 401 to signal Mercado Pago that the request was rejected
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature"
        )
    
    # Extract payment ID from notification
    payment_id: Optional[int] = None
    external_reference: Optional[str] = None
    
    # Mercado Pago webhook formats vary
    # Format 1: payment.updated with data.id
    if payload.data and isinstance(payload.data, dict):
        raw_id = payload.data.get("id")
        if raw_id:
            try:
                payment_id = int(raw_id)
            except (ValueError, TypeError):
                external_reference = str(raw_id)
    
    # Format 2: direct id field (some webhook topics)
    if not payment_id and payload.id:
        try:
            payment_id = int(payload.id)
        except (ValueError, TypeError):
            pass
    
    # Only process payment-related notifications
    notification_type = (payload.type or "").lower()
    action = (payload.action or "").lower()
    
    is_payment_notification = (
        notification_type in ("payment", "")
        or "payment" in action
    )
    
    if not is_payment_notification:
        logger.info("Ignoring non-payment webhook: type=%s, action=%s", payload.type, payload.action)
        return WebhookResponse(received=True)
    
    service = ContributionService(db)
    
    try:
        processed = await service.process_webhook_notification(
            payment_id=payment_id,
            external_reference=external_reference,
        )
        
        if not processed:
            logger.warning(
                "Webhook could not be processed: payment_id=%s, external_reference=%s",
                payment_id, external_reference
            )
    except PaymentProviderError as e:
        logger.error("Webhook processing failed: %s", e)
        # Still return 200 to prevent Mercado Pago retries
        # The error is logged and can be investigated manually
    except Exception as e:
        logger.error("Unexpected error processing webhook: %s", e, exc_info=True)
        # Still return 200 to prevent Mercado Pago retries
    
    return WebhookResponse(received=True)
