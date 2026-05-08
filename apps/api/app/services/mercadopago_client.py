"""Mercado Pago HTTP Client

Async client for Mercado Pago REST API using httpx.
Handles payment creation, retrieval, and webhook validation.
"""

import logging
import uuid
from decimal import Decimal
from typing import Optional, Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Mercado Pago payment statuses and our mappings
MP_STATUS_APPROVED = "approved"
MP_STATUS_PENDING = "pending"
MP_STATUS_IN_PROCESS = "in_process"
MP_STATUS_REJECTED = "rejected"
MP_STATUS_CANCELLED = "cancelled"
MP_STATUS_REFUNDED = "refunded"
MP_STATUS_CHARGED_BACK = "charged_back"


class MercadoPagoError(Exception):
    """Base exception for Mercado Pago client errors."""
    
    def __init__(self, message: str, status_code: Optional[int] = None, response_body: Optional[Any] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


class MercadoPagoClient:
    """Async HTTP client for Mercado Pago API.
    
    Uses httpx.AsyncClient for all server-to-server communication.
    Never exposes access tokens in logs or responses.
    """
    
    def __init__(
        self,
        access_token: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: float = 30.0
    ):
        self.access_token = access_token or settings.MERCADO_PAGO_ACCESS_TOKEN
        self.base_url = (base_url or settings.MERCADO_PAGO_BASE_URL).rstrip("/")
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the underlying httpx client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(self.timeout),
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                }
            )
        return self._client
    
    async def close(self) -> None:
        """Close the underlying HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
    
    async def __aenter__(self):
        await self._get_client()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    def _sanitize_for_log(self, data: dict) -> dict:
        """Remove sensitive fields before logging."""
        if not isinstance(data, dict):
            return data
        sanitized = dict(data)
        # Remove any nested sensitive fields
        for key in list(sanitized.keys()):
            if "token" in key.lower() or "secret" in key.lower() or "password" in key.lower():
                sanitized[key] = "[REDACTED]"
            elif isinstance(sanitized[key], dict):
                sanitized[key] = self._sanitize_for_log(sanitized[key])
        return sanitized
    
    async def create_pix_payment(
        self,
        amount: Decimal,
        description: str,
        external_reference: str,
        notification_url: str,
        payer_email: Optional[str] = None,
        payer_first_name: Optional[str] = None,
        payer_last_name: Optional[str] = None,
        date_of_expiration: Optional[str] = None,
    ) -> dict:
        """Create a Pix payment in Mercado Pago.
        
        Args:
            amount: Transaction amount in BRL
            description: Payment description
            external_reference: Local contribution ID for reconciliation
            notification_url: Webhook URL for status updates
            payer_email: Optional payer email
            payer_first_name: Optional payer first name
            payer_last_name: Optional payer last name
            date_of_expiration: ISO 8601 expiration date (30 min to 30 days from now)
            
        Returns:
            Mercado Pago payment response as dict
            
        Raises:
            MercadoPagoError: On API errors or invalid responses
        """
        client = await self._get_client()
        
        payload: dict[str, Any] = {
            "transaction_amount": float(amount),
            "description": description,
            "payment_method_id": "pix",
            "external_reference": external_reference,
        }
        
        if notification_url:
            payload["notification_url"] = notification_url
        
        payer: dict[str, Any] = {}
        if payer_email:
            payer["email"] = payer_email
        if payer_first_name:
            payer["first_name"] = payer_first_name
        if payer_last_name:
            payer["last_name"] = payer_last_name
        if payer:
            payload["payer"] = payer
        
        if date_of_expiration:
            payload["date_of_expiration"] = date_of_expiration
        
        idempotency_key = str(uuid.uuid4())
        
        logger.info(
            "Creating Mercado Pago Pix payment: amount=%s, external_reference=%s",
            amount, external_reference
        )
        
        try:
            response = await client.post(
                "/v1/payments",
                json=payload,
                headers={"X-Idempotency-Key": idempotency_key}
            )
            response.raise_for_status()
            result = response.json()
            
            payment_id = result.get("id")
            status = result.get("status")
            logger.info(
                "Mercado Pago Pix payment created: mp_payment_id=%s, status=%s",
                payment_id, status
            )
            return result
            
        except httpx.HTTPStatusError as e:
            error_body = None
            try:
                error_body = e.response.json()
            except Exception:
                error_body = e.response.text
            
            logger.error(
                "Mercado Pago API error: status=%s, body=%s",
                e.response.status_code, self._sanitize_for_log(error_body) if isinstance(error_body, dict) else error_body
            )
            raise MercadoPagoError(
                f"Mercado Pago API error: {e.response.status_code}",
                status_code=e.response.status_code,
                response_body=error_body
            )
        except httpx.RequestError as e:
            logger.error("Mercado Pago request error: %s", e)
            raise MercadoPagoError(f"Request to Mercado Pago failed: {e}")
    
    async def get_payment(self, payment_id: int) -> dict:
        """Retrieve a payment by ID from Mercado Pago.
        
        This is the authoritative source of truth for payment status.
        Always query this before updating local payment records.
        
        Args:
            payment_id: Mercado Pago payment ID
            
        Returns:
            Payment details as dict
            
        Raises:
            MercadoPagoError: On API errors
        """
        client = await self._get_client()
        
        logger.info("Fetching payment from Mercado Pago: payment_id=%s", payment_id)
        
        try:
            response = await client.get(f"/v1/payments/{payment_id}")
            response.raise_for_status()
            result = response.json()
            
            status = result.get("status")
            logger.info(
                "Mercado Pago payment fetched: payment_id=%s, status=%s",
                payment_id, status
            )
            return result
            
        except httpx.HTTPStatusError as e:
            error_body = None
            try:
                error_body = e.response.json()
            except Exception:
                error_body = e.response.text
            
            logger.error(
                "Mercado Pago get payment error: status=%s",
                e.response.status_code
            )
            raise MercadoPagoError(
                f"Failed to fetch payment {payment_id}: {e.response.status_code}",
                status_code=e.response.status_code,
                response_body=error_body
            )
        except httpx.RequestError as e:
            logger.error("Mercado Pago request error: %s", e)
            raise MercadoPagoError(f"Request to Mercado Pago failed: {e}")
    
    @staticmethod
    def map_mp_status_to_local(mp_status: Optional[str], mp_status_detail: Optional[str] = None) -> str:
        """Map Mercado Pago payment status to local contribution status.
        
        Args:
            mp_status: Mercado Pago status string
            mp_status_detail: Optional status detail for finer mapping
            
        Returns:
            Local status string
        """
        from app.models.contribution import ContributionStatus
        
        if not mp_status:
            return ContributionStatus.PENDING
        
        status = mp_status.lower()
        
        mapping = {
            MP_STATUS_APPROVED: ContributionStatus.PAID,
            MP_STATUS_PENDING: ContributionStatus.PENDING,
            MP_STATUS_IN_PROCESS: ContributionStatus.PENDING,
            MP_STATUS_REJECTED: ContributionStatus.FAILED,
            MP_STATUS_CANCELLED: ContributionStatus.CANCELLED,
            MP_STATUS_REFUNDED: ContributionStatus.REFUNDED,
            MP_STATUS_CHARGED_BACK: ContributionStatus.DISPUTED,
        }
        
        local_status = mapping.get(status, ContributionStatus.PENDING)
        
        # Fine-tune: expired pending payments
        if status == MP_STATUS_PENDING and mp_status_detail and "expired" in mp_status_detail.lower():
            local_status = ContributionStatus.EXPIRED
        
        return local_status
    
    @staticmethod
    def extract_pix_data(mp_response: dict) -> dict:
        """Extract Pix-specific data from Mercado Pago payment response.
        
        Args:
            mp_response: Raw Mercado Pago payment response
            
        Returns:
            Dict with qr_code, qr_code_base64, ticket_url, expiration
        """
        poi = mp_response.get("point_of_interaction", {})
        transaction_data = poi.get("transaction_data", {})
        
        return {
            "qr_code": transaction_data.get("qr_code"),
            "qr_code_base64": transaction_data.get("qr_code_base64"),
            "ticket_url": transaction_data.get("ticket_url"),
            "transaction_id": transaction_data.get("transaction_id"),
            "date_of_expiration": mp_response.get("date_of_expiration"),
        }
