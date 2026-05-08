"""Mercado Pago Webhook Security

Validates webhook signatures using the secret key configured in the
Mercado Pago dashboard (Assinatura secreta).

The X-Signature header format:
    ts=<unix_timestamp>,v1=<hex_signature>

The signature is computed as HMAC-SHA256 of the manifest string:
    id:<data.id>;request-id:<x-request_id>;ts:<ts>;
"""

import hmac
import hashlib
import logging
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


class WebhookSignatureError(Exception):
    """Raised when webhook signature validation fails."""
    pass


def _extract_signature_parts(x_signature: str) -> tuple[Optional[str], Optional[str]]:
    """Parse the X-Signature header into timestamp and signature parts.
    
    Args:
        x_signature: The raw X-Signature header value
        
    Returns:
        Tuple of (timestamp, signature_hex) or (None, None) on parse failure
    """
    ts: Optional[str] = None
    signature: Optional[str] = None
    
    for part in x_signature.split(","):
        part = part.strip()
        if "=" in part:
            key, value = part.split("=", 1)
            key = key.strip()
            value = value.strip()
            if key == "ts":
                ts = value
            elif key == "v1":
                signature = value
    
    return ts, signature


def validate_mercadopago_signature(
    x_signature: Optional[str],
    x_request_id: Optional[str],
    data_id: Optional[str],
) -> bool:
    """Validate a Mercado Pago webhook signature.
    
    The signature is computed as HMAC-SHA256 of the manifest:
        id:<data_id>;request-id:<request_id>;ts:<timestamp>;
    
    Args:
        x_signature: The X-Signature header value (format: ts=<ts>,v1=<sig>)
        x_request_id: The X-Request-Id header value
        data_id: The payment/notification ID from the webhook payload data.id
        
    Returns:
        True if signature is valid, False otherwise
        
    Raises:
        WebhookSignatureError: If the secret is not configured
    """
    secret = settings.MERCADO_PAGO_WEBHOOK_SECRET
    
    # If no secret is configured, skip validation but log a warning
    if not secret:
        logger.warning(
            "MERCADO_PAGO_WEBHOOK_SECRET not configured, skipping signature validation"
        )
        return True
    
    # If no signature header is present, reject
    if not x_signature:
        logger.warning("Missing X-Signature header")
        return False
    
    ts, received_signature = _extract_signature_parts(x_signature)
    
    if not ts or not received_signature:
        logger.warning("Malformed X-Signature header: %s", x_signature)
        return False
    
    if not x_request_id:
        logger.warning("Missing X-Request-Id header")
        return False
    
    if not data_id:
        logger.warning("Missing data.id from webhook payload")
        return False
    
    # Build the manifest string as per Mercado Pago docs
    manifest = f"id:{data_id};request-id:{x_request_id};ts:{ts};"
    
    # Compute HMAC-SHA256
    computed_hmac = hmac.new(
        secret.encode("utf-8"),
        manifest.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    
    # Constant-time comparison to prevent timing attacks
    is_valid = hmac.compare_digest(computed_hmac, received_signature)
    
    if not is_valid:
        logger.warning(
            "Invalid webhook signature: computed=%s, received=%s",
            computed_hmac[:16] + "...",
            received_signature[:16] + "...",
        )
    
    return is_valid
