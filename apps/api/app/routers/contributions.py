"""Router for Contribution/Payment endpoints

Handles Pix contribution creation, status checks, and Mercado Pago webhooks.
"""

from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_optional_user
from app.models.user import User
from app.schemas.contribution import (
    ContributionPixCreate,
    ContributionPixResponse,
    ContributionStatusResponse,
)
from app.services.contribution_service import (
    ContributionService,
    InvalidAmountError,
    ContributionNotFoundError,
    PaymentProviderError,
)


router = APIRouter(prefix="/api/v1/contributions", tags=["Contributions"])


@router.post("/pix", response_model=ContributionPixResponse, status_code=status.HTTP_201_CREATED)
async def create_pix_contribution(
    request: Request,
    payload: ContributionPixCreate,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new Pix contribution.
    
    Creates a Pix payment in Mercado Pago and returns the QR code
    and copy-paste code for the frontend to display.
    
    Args:
        amount: Contribution amount in BRL (minimum R$5.00)
        payer_name: Optional payer display name
        payer_email: Optional payer email
        
    Returns:
        Contribution details including Pix QR code and copy-paste code
    """
    if not settings.PAYMENTS_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payments are currently disabled"
        )
    
    service = ContributionService(db)
    
    try:
        contribution = await service.create_contribution(
            amount=payload.amount,
            payer_email=payload.payer_email,
            payer_name=payload.payer_name,
        )
    except InvalidAmountError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except PaymentProviderError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e)
        )
    
    return ContributionPixResponse(
        contribution_id=contribution.id,
        status=contribution.status,
        amount=Decimal(str(contribution.amount)),
        pix_copy_paste=contribution.pix_copy_paste or "",
        pix_qr_code_base64=contribution.pix_qr_code_base64 or "",
        expires_at=contribution.expires_at,
    )


@router.get("/{contribution_id}/status", response_model=ContributionStatusResponse)
async def get_contribution_status(
    contribution_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get the current status of a contribution.
    
    This endpoint is public (no auth required) so the frontend
    can poll payment status while showing the Pix QR code.
    
    Args:
        contribution_id: The contribution UUID
        
    Returns:
        Contribution status and related timestamps
    """
    service = ContributionService(db)
    
    try:
        contribution_uuid = UUID(contribution_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid contribution ID format"
        )
    
    try:
        contribution = await service.get_contribution_status(contribution_uuid)
    except ContributionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contribution not found"
        )
    
    return ContributionStatusResponse(
        contribution_id=contribution.id,
        status=contribution.status,
        amount=Decimal(str(contribution.amount)),
        provider_payment_id=contribution.provider_payment_id,
        paid_at=contribution.paid_at,
        refunded_at=contribution.refunded_at,
        cancelled_at=contribution.cancelled_at,
        expires_at=contribution.expires_at,
    )


@router.post("/{contribution_id}/sync", response_model=ContributionStatusResponse)
async def sync_contribution_status(
    contribution_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Manually sync a contribution status with Mercado Pago.
    
    Forces a server-to-server status check with Mercado Pago.
    Useful for manual refresh or when webhooks are delayed.
    
    Args:
        contribution_id: The contribution UUID
        
    Returns:
        Updated contribution status
    """
    if not settings.PAYMENTS_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payments are currently disabled"
        )
    
    service = ContributionService(db)
    
    try:
        contribution_uuid = UUID(contribution_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid contribution ID format"
        )
    
    try:
        contribution = await service.sync_contribution_status(contribution_uuid)
    except ContributionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contribution not found"
        )
    except PaymentProviderError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e)
        )
    
    return ContributionStatusResponse(
        contribution_id=contribution.id,
        status=contribution.status,
        amount=Decimal(str(contribution.amount)),
        provider_payment_id=contribution.provider_payment_id,
        paid_at=contribution.paid_at,
        refunded_at=contribution.refunded_at,
        cancelled_at=contribution.cancelled_at,
        expires_at=contribution.expires_at,
    )


