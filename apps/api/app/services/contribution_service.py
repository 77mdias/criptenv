"""Contribution Service

Business logic for managing Pix contributions via Mercado Pago.
Handles creation, status tracking, webhook processing, and idempotency.
"""

import logging
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models.contribution import Contribution, ContributionStatus
from app.services.mercadopago_client import MercadoPagoClient, MercadoPagoError

logger = logging.getLogger(__name__)

# Minimum and maximum contribution amounts in BRL
MIN_CONTRIBUTION_AMOUNT = Decimal("5.00")
MAX_CONTRIBUTION_AMOUNT = Decimal("100000.00")


class ContributionServiceError(Exception):
    """Base exception for contribution service errors."""
    pass


class InvalidAmountError(ContributionServiceError):
    """Raised when contribution amount is invalid."""
    pass


class ContributionNotFoundError(ContributionServiceError):
    """Raised when a contribution is not found."""
    pass


class PaymentProviderError(ContributionServiceError):
    """Raised when payment provider communication fails."""
    pass


class ContributionService:
    """Service for managing contribution payments.
    
    Encapsulates business rules for amount validation, Pix creation,
    webhook handling, and status lifecycle management.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self._mp_client: Optional[MercadoPagoClient] = None
    
    def _get_mp_client(self) -> MercadoPagoClient:
        """Get or create the Mercado Pago client."""
        if self._mp_client is None:
            self._mp_client = MercadoPagoClient()
        return self._mp_client
    
    def _validate_amount(self, amount: Decimal) -> None:
        """Validate contribution amount against business rules.
        
        Args:
            amount: Proposed contribution amount
            
        Raises:
            InvalidAmountError: If amount violates constraints
        """
        if amount <= 0:
            raise InvalidAmountError("Amount must be greater than zero")
        
        if amount < MIN_CONTRIBUTION_AMOUNT:
            raise InvalidAmountError(
                f"Minimum contribution amount is R${MIN_CONTRIBUTION_AMOUNT}"
            )
        
        if amount > MAX_CONTRIBUTION_AMOUNT:
            raise InvalidAmountError(
                f"Maximum contribution amount is R${MAX_CONTRIBUTION_AMOUNT}"
            )
        
        # Check decimal places
        quantized = amount.quantize(Decimal("0.01"))
        if amount != quantized:
            raise InvalidAmountError("Amount must have at most 2 decimal places")
    
    def _build_notification_url(self) -> Optional[str]:
        """Construct the webhook notification URL.
        
        Returns None for local development (localhost/127.0.0.1)
        because Mercado Pago rejects non-public URLs.
        """
        base = settings.API_URL.rstrip("/")
        if "localhost" in base or "127.0.0.1" in base:
            return None
        return f"{base}/webhooks/mercadopago"
    
    def _build_expiration_date(self) -> str:
        """Build ISO 8601 expiration date (24 hours from now by default).
        
        Mercado Pago supports 30 minutes to 30 days.
        We default to 24 hours for Pix contributions.
        """
        expires = datetime.now(timezone.utc) + timedelta(hours=24)
        # Mercado Pago expects ISO 8601 with timezone
        return expires.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    
    async def create_contribution(
        self,
        amount: Decimal,
        payer_email: Optional[str] = None,
        payer_name: Optional[str] = None,
    ) -> Contribution:
        """Create a new Pix contribution.
        
        Flow:
        1. Validate amount
        2. Create local PENDING record
        3. Create Pix payment in Mercado Pago
        4. Update local record with Pix data and provider payment ID
        
        Args:
            amount: Contribution amount in BRL
            payer_email: Optional payer email
            payer_name: Optional payer name
            
        Returns:
            Created contribution with Pix data
            
        Raises:
            InvalidAmountError: If amount is invalid
            PaymentProviderError: If Mercado Pago API fails
        """
        self._validate_amount(amount)
        
        # Create local record first (PENDING)
        contribution = Contribution(
            provider="mercadopago",
            amount=amount,
            currency="BRL",
            status=ContributionStatus.PENDING,
            payer_email=payer_email,
            payer_name=payer_name,
        )
        self.db.add(contribution)
        await self.db.flush()
        await self.db.refresh(contribution)
        
        logger.info(
            "Created local contribution record: id=%s, amount=%s",
            contribution.id, amount
        )
        
        try:
            # Create Pix payment in Mercado Pago
            mp_client = self._get_mp_client()
            
            # Parse payer name for first/last name
            first_name = None
            last_name = None
            if payer_name:
                parts = payer_name.strip().split(None, 1)
                first_name = parts[0] if parts else None
                last_name = parts[1] if len(parts) > 1 else None
            
            expiration = self._build_expiration_date()
            
            mp_response = await mp_client.create_pix_payment(
                amount=amount,
                description="Contribution to CriptEnv",
                external_reference=str(contribution.id),
                notification_url=self._build_notification_url(),
                payer_email=payer_email,
                payer_first_name=first_name,
                payer_last_name=last_name,
                date_of_expiration=expiration,
            )
            
            # Extract Pix data
            pix_data = MercadoPagoClient.extract_pix_data(mp_response)
            
            # Update local record
            contribution.provider_payment_id = str(mp_response.get("id"))
            contribution.pix_copy_paste = pix_data.get("qr_code")
            contribution.pix_qr_code_base64 = pix_data.get("qr_code_base64")
            contribution.ticket_url = pix_data.get("ticket_url")
            contribution.raw_provider_response = mp_response
            
            # Parse expiration date if present
            if pix_data.get("date_of_expiration"):
                try:
                    # Handle ISO 8601 format
                    exp_str = pix_data["date_of_expiration"]
                    if exp_str.endswith("Z"):
                        exp_str = exp_str[:-1] + "+00:00"
                    contribution.expires_at = datetime.fromisoformat(exp_str)
                except (ValueError, TypeError) as e:
                    logger.warning("Failed to parse expiration date: %s", e)
                    contribution.expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
            else:
                contribution.expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
            
            await self.db.flush()
            await self.db.refresh(contribution)
            
            logger.info(
                "Contribution fully created with Pix data: id=%s, mp_payment_id=%s",
                contribution.id, contribution.provider_payment_id
            )
            
            return contribution
            
        except MercadoPagoError as e:
            # Mark as failed since we couldn't create the Pix payment
            contribution.status = ContributionStatus.FAILED
            contribution.raw_provider_response = {
                "error": str(e),
                "status_code": e.status_code,
                "response_body": e.response_body,
            }
            await self.db.flush()
            logger.error(
                "Failed to create Mercado Pago payment for contribution %s: %s",
                contribution.id, e
            )
            raise PaymentProviderError(
                f"Payment provider error: {e}"
            ) from e
    
    async def get_contribution(self, contribution_id: UUID) -> Optional[Contribution]:
        """Get a contribution by ID."""
        result = await self.db.execute(
            select(Contribution).where(Contribution.id == contribution_id)
        )
        return result.scalar_one_or_none()
    
    async def get_contribution_status(self, contribution_id: UUID) -> Contribution:
        """Get contribution status by ID.
        
        Args:
            contribution_id: Contribution UUID
            
        Returns:
            Contribution record
            
        Raises:
            ContributionNotFoundError: If contribution not found
        """
        contribution = await self.get_contribution(contribution_id)
        if not contribution:
            raise ContributionNotFoundError(
                f"Contribution not found: {contribution_id}"
            )
        return contribution
    
    async def process_webhook_notification(
        self,
        payment_id: Optional[int] = None,
        external_reference: Optional[str] = None,
    ) -> bool:
        """Process a Mercado Pago webhook notification.
        
        This is the ONLY way a contribution should be marked as PAID.
        The flow:
        1. Extract payment ID from notification
        2. Query Mercado Pago API for authoritative status
        3. Find local contribution by provider_payment_id or external_reference
        4. Update local status if valid transition
        5. Return True if processed successfully
        
        Args:
            payment_id: Mercado Pago payment ID from webhook
            external_reference: Local contribution ID from webhook
            
        Returns:
            True if notification was processed, False if skipped
            
        Raises:
            PaymentProviderError: If Mercado Pago API query fails
        """
        if not payment_id and not external_reference:
            logger.warning("Webhook notification missing payment_id and external_reference")
            return False
        
        # First, try to find the local contribution
        contribution: Optional[Contribution] = None
        
        if external_reference:
            try:
                ref_uuid = UUID(external_reference)
                contribution = await self.get_contribution(ref_uuid)
            except ValueError:
                logger.warning("Invalid external_reference UUID: %s", external_reference)
        
        if not contribution and payment_id:
            # Find by provider payment ID
            result = await self.db.execute(
                select(Contribution).where(
                    Contribution.provider_payment_id == str(payment_id)
                )
            )
            contribution = result.scalar_one_or_none()
        
        if not contribution:
            logger.warning(
                "Webhook notification for unknown contribution: "
                "payment_id=%s, external_reference=%s",
                payment_id, external_reference
            )
            return False
        
        # If already in terminal state, ignore (idempotency)
        if contribution.is_terminal_status():
            logger.info(
                "Ignoring webhook for contribution %s: already in terminal state %s",
                contribution.id, contribution.status
            )
            return True
        
        # Query Mercado Pago for authoritative status
        if payment_id:
            try:
                mp_client = self._get_mp_client()
                mp_payment = await mp_client.get_payment(payment_id)
                
                mp_status = mp_payment.get("status")
                mp_status_detail = mp_payment.get("status_detail")
                new_status = MercadoPagoClient.map_mp_status_to_local(
                    mp_status, mp_status_detail
                )
                
                logger.info(
                    "Webhook processing: contribution=%s, mp_status=%s, local_status=%s",
                    contribution.id, mp_status, new_status
                )
                
                await self._update_contribution_status(
                    contribution, new_status, mp_payment
                )
                
                return True
                
            except MercadoPagoError as e:
                logger.error(
                    "Failed to verify payment with Mercado Pago: %s", e
                )
                raise PaymentProviderError(
                    f"Failed to verify payment: {e}"
                ) from e
        else:
            # No payment_id available to query - can't verify
            logger.warning(
                "Webhook for contribution %s has no payment_id to verify",
                contribution.id
            )
            return False
    
    async def _update_contribution_status(
        self,
        contribution: Contribution,
        new_status: str,
        mp_payment: Optional[dict] = None,
    ) -> None:
        """Update contribution status with validation and side effects.
        
        Args:
            contribution: Contribution to update
            new_status: New status to apply
            mp_payment: Optional latest Mercado Pago payment data
        """
        if not contribution.can_transition_to(new_status):
            logger.info(
                "Invalid status transition: %s -> %s for contribution %s",
                contribution.status, new_status, contribution.id
            )
            return
        
        old_status = contribution.status
        contribution.status = new_status
        contribution.updated_at = datetime.now(timezone.utc)
        
        # Store latest provider response
        if mp_payment:
            contribution.raw_provider_response = mp_payment
            # Update provider payment ID if available
            mp_id = mp_payment.get("id")
            if mp_id and not contribution.provider_payment_id:
                contribution.provider_payment_id = str(mp_id)
        
        # Set timestamp fields
        now = datetime.now(timezone.utc)
        if new_status == ContributionStatus.PAID and not contribution.paid_at:
            contribution.paid_at = now
        elif new_status == ContributionStatus.REFUNDED and not contribution.refunded_at:
            contribution.refunded_at = now
        elif new_status == ContributionStatus.CANCELLED and not contribution.cancelled_at:
            contribution.cancelled_at = now
        
        await self.db.flush()
        
        logger.info(
            "Contribution %s status updated: %s -> %s",
            contribution.id, old_status, new_status
        )
    
    async def sync_contribution_status(self, contribution_id: UUID) -> Contribution:
        """Manually sync a contribution status with Mercado Pago.
        
        Used for manual refresh or background jobs.
        
        Args:
            contribution_id: Contribution UUID
            
        Returns:
            Updated contribution
            
        Raises:
            ContributionNotFoundError: If contribution not found
            PaymentProviderError: If provider query fails
        """
        contribution = await self.get_contribution(contribution_id)
        if not contribution:
            raise ContributionNotFoundError(
                f"Contribution not found: {contribution_id}"
            )
        
        # Skip if no provider payment ID
        if not contribution.provider_payment_id:
            logger.warning(
                "Cannot sync contribution %s: no provider_payment_id",
                contribution_id
            )
            return contribution
        
        # Skip if already terminal
        if contribution.is_terminal_status():
            return contribution
        
        try:
            mp_client = self._get_mp_client()
            payment_id = int(contribution.provider_payment_id)
            mp_payment = await mp_client.get_payment(payment_id)
            
            new_status = MercadoPagoClient.map_mp_status_to_local(
                mp_payment.get("status"),
                mp_payment.get("status_detail")
            )
            
            await self._update_contribution_status(contribution, new_status, mp_payment)
            
            return contribution
            
        except (ValueError, MercadoPagoError) as e:
            logger.error("Failed to sync contribution %s: %s", contribution_id, e)
            raise PaymentProviderError(f"Failed to sync status: {e}") from e
