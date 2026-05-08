"""Test Contribution/Payment flow for Mercado Pago Pix

HELL TDD - Tests for contribution creation, status tracking, and webhooks.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from uuid import uuid4, UUID
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from contextlib import contextmanager
from httpx import AsyncClient, ASGITransport

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import app
from app.middleware.auth import get_current_user
from app.models.contribution import Contribution, ContributionStatus
from app.services.mercadopago_client import MercadoPagoClient, MercadoPagoError
from app.services.contribution_service import (
    ContributionService,
    InvalidAmountError,
    ContributionNotFoundError,
    PaymentProviderError,
    MIN_CONTRIBUTION_AMOUNT,
    MAX_CONTRIBUTION_AMOUNT,
)


def _make_valid_signature(data_id: str, request_id: str, ts: str = "1234567890") -> str:
    """Generate a valid Mercado Pago webhook signature for tests."""
    import hmac
    import hashlib
    from app.config import settings
    
    secret = settings.MERCADO_PAGO_WEBHOOK_SECRET or ""
    manifest = f"id:{data_id};request-id:{request_id};ts:{ts};"
    sig = hmac.new(secret.encode("utf-8"), manifest.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"ts={ts},v1={sig}"


@contextmanager
def override_current_user(user):
    """Override FastAPI's captured auth dependency."""
    async def _get_current_user():
        return user
    app.dependency_overrides[get_current_user] = _get_current_user
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def mock_user():
    """Create a mock authenticated user."""
    user = MagicMock()
    user.id = uuid4()
    user.email = "user@example.com"
    return user


@pytest.fixture
def transport():
    """ASGI transport for AsyncClient."""
    return ASGITransport(app=app)


class FakeDb:
    """Hand-rolled fake AsyncSession for unit tests."""
    
    def __init__(self, execute_results=None):
        self.execute_results = list(execute_results or [])
        self.added = []
        self.flushed = 0
        self.committed = 0
        self.rolled_back = 0
    
    async def execute(self, query):
        if self.execute_results:
            return self.execute_results.pop(0)
        return MagicMock(scalar_one_or_none=lambda: None, scalars=lambda: MagicMock(all=lambda: []))
    
    def add(self, obj):
        self.added.append(obj)
    
    async def flush(self):
        self.flushed += 1
    
    async def refresh(self, obj):
        pass
    
    async def commit(self):
        self.committed += 1
    
    async def rollback(self):
        self.rolled_back += 1


# ============================================================================
# MercadoPagoClient Tests
# ============================================================================

class TestMercadoPagoClient:
    """Test Mercado Pago client utilities."""
    
    def test_map_approved_to_paid(self):
        result = MercadoPagoClient.map_mp_status_to_local("approved")
        assert result == ContributionStatus.PAID
    
    def test_map_pending_to_pending(self):
        result = MercadoPagoClient.map_mp_status_to_local("pending")
        assert result == ContributionStatus.PENDING
    
    def test_map_in_process_to_pending(self):
        result = MercadoPagoClient.map_mp_status_to_local("in_process")
        assert result == ContributionStatus.PENDING
    
    def test_map_rejected_to_failed(self):
        result = MercadoPagoClient.map_mp_status_to_local("rejected")
        assert result == ContributionStatus.FAILED
    
    def test_map_cancelled_to_cancelled(self):
        result = MercadoPagoClient.map_mp_status_to_local("cancelled")
        assert result == ContributionStatus.CANCELLED
    
    def test_map_refunded_to_refunded(self):
        result = MercadoPagoClient.map_mp_status_to_local("refunded")
        assert result == ContributionStatus.REFUNDED
    
    def test_map_charged_back_to_disputed(self):
        result = MercadoPagoClient.map_mp_status_to_local("charged_back")
        assert result == ContributionStatus.DISPUTED
    
    def test_map_none_to_pending(self):
        result = MercadoPagoClient.map_mp_status_to_local(None)
        assert result == ContributionStatus.PENDING
    
    def test_map_expired_pending_to_expired(self):
        result = MercadoPagoClient.map_mp_status_to_local(
            "pending", "pending_waiting_expired"
        )
        assert result == ContributionStatus.EXPIRED
    
    def test_extract_pix_data(self):
        mp_response = {
            "point_of_interaction": {
                "transaction_data": {
                    "qr_code": "000201010212...",
                    "qr_code_base64": "iVBORw0KGgo...",
                    "ticket_url": "https://mp.com/ticket",
                    "transaction_id": "txn_123",
                }
            },
            "date_of_expiration": "2026-05-09T15:00:00.000Z"
        }
        data = MercadoPagoClient.extract_pix_data(mp_response)
        assert data["qr_code"] == "000201010212..."
        assert data["qr_code_base64"] == "iVBORw0KGgo..."
        assert data["ticket_url"] == "https://mp.com/ticket"
        assert data["transaction_id"] == "txn_123"
        assert data["date_of_expiration"] == "2026-05-09T15:00:00.000Z"
    
    def test_extract_pix_data_missing(self):
        data = MercadoPagoClient.extract_pix_data({})
        assert data["qr_code"] is None
        assert data["qr_code_base64"] is None


# ============================================================================
# ContributionService Unit Tests
# ============================================================================

class TestContributionServiceUnit:
    """Unit tests for ContributionService with FakeDb."""
    
    def test_validate_amount_too_small(self):
        db = FakeDb()
        service = ContributionService(db)
        with pytest.raises(InvalidAmountError, match="Minimum"):
            service._validate_amount(Decimal("1.00"))
    
    def test_validate_amount_too_large(self):
        db = FakeDb()
        service = ContributionService(db)
        with pytest.raises(InvalidAmountError, match="Maximum"):
            service._validate_amount(Decimal("200000.00"))
    
    def test_validate_amount_zero(self):
        db = FakeDb()
        service = ContributionService(db)
        with pytest.raises(InvalidAmountError, match="greater than zero"):
            service._validate_amount(Decimal("0.00"))
    
    def test_validate_amount_negative(self):
        db = FakeDb()
        service = ContributionService(db)
        with pytest.raises(InvalidAmountError, match="greater than zero"):
            service._validate_amount(Decimal("-10.00"))
    
    def test_validate_amount_too_many_decimals(self):
        db = FakeDb()
        service = ContributionService(db)
        with pytest.raises(InvalidAmountError, match="decimal places"):
            service._validate_amount(Decimal("10.999"))
    
    def test_validate_amount_valid(self):
        db = FakeDb()
        service = ContributionService(db)
        service._validate_amount(Decimal("50.00"))  # Should not raise
        service._validate_amount(Decimal("5.00"))   # Minimum boundary
        service._validate_amount(Decimal("100000.00"))  # Maximum boundary
    
    @pytest.mark.asyncio
    async def test_get_contribution_found(self):
        contribution = MagicMock()
        contribution.id = uuid4()
        
        fake_result = MagicMock()
        fake_result.scalar_one_or_none = lambda: contribution
        
        db = FakeDb(execute_results=[fake_result])
        service = ContributionService(db)
        
        result = await service.get_contribution(contribution.id)
        assert result == contribution
    
    @pytest.mark.asyncio
    async def test_get_contribution_not_found(self):
        fake_result = MagicMock()
        fake_result.scalar_one_or_none = lambda: None
        
        db = FakeDb(execute_results=[fake_result])
        service = ContributionService(db)
        
        result = await service.get_contribution(uuid4())
        assert result is None
    
    @pytest.mark.asyncio
    async def test_get_contribution_status_raises_when_not_found(self):
        fake_result = MagicMock()
        fake_result.scalar_one_or_none = lambda: None
        
        db = FakeDb(execute_results=[fake_result])
        service = ContributionService(db)
        
        with pytest.raises(ContributionNotFoundError):
            await service.get_contribution_status(uuid4())


# ============================================================================
# Contribution Router Tests
# ============================================================================

class TestContributionRouter:
    """Integration tests for contribution endpoints."""
    
    @pytest.mark.asyncio
    async def test_create_pix_contribution_payments_disabled(self, transport, mock_user):
        """When payments are disabled, should return 503."""
        with override_current_user(mock_user):
            with patch("app.routers.contributions.settings.PAYMENTS_ENABLED", False):
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    response = await client.post(
                        "/api/v1/contributions/pix",
                        json={"amount": "10.00"}
                    )
                assert response.status_code == 503
                assert "disabled" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_create_pix_contribution_invalid_amount(self, transport, mock_user):
        """Amount below minimum should return 422 (Pydantic validation)."""
        with override_current_user(mock_user):
            with patch("app.routers.contributions.settings.PAYMENTS_ENABLED", True):
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    response = await client.post(
                        "/api/v1/contributions/pix",
                        json={"amount": "1.00"}
                    )
                assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_create_pix_contribution_negative_amount(self, transport, mock_user):
        """Negative amount should return 422 (Pydantic validation)."""
        with override_current_user(mock_user):
            with patch("app.routers.contributions.settings.PAYMENTS_ENABLED", True):
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    response = await client.post(
                        "/api/v1/contributions/pix",
                        json={"amount": "-10.00"}
                    )
                assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_create_pix_contribution_zero_amount(self, transport, mock_user):
        """Zero amount should return 422 (Pydantic validation)."""
        with override_current_user(mock_user):
            with patch("app.routers.contributions.settings.PAYMENTS_ENABLED", True):
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    response = await client.post(
                        "/api/v1/contributions/pix",
                        json={"amount": "0.00"}
                    )
                assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_create_pix_contribution_success(self, transport, mock_user):
        """Valid creation should return 201 with Pix data."""
        contrib_id = uuid4()
        
        mock_contribution = MagicMock()
        mock_contribution.id = contrib_id
        mock_contribution.status = ContributionStatus.PENDING
        mock_contribution.amount = Decimal("50.00")
        mock_contribution.pix_copy_paste = "000201010212..."
        mock_contribution.pix_qr_code_base64 = "iVBORw0KGgo..."
        mock_contribution.expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        
        with override_current_user(mock_user):
            with patch("app.routers.contributions.settings.PAYMENTS_ENABLED", True):
                with patch.object(
                    ContributionService, "create_contribution", new_callable=AsyncMock
                ) as mock_create:
                    mock_create.return_value = mock_contribution
                    
                    async with AsyncClient(transport=transport, base_url="http://test") as client:
                        response = await client.post(
                            "/api/v1/contributions/pix",
                            json={
                                "amount": "50.00",
                                "payer_name": "Test User",
                                "payer_email": "test@example.com"
                            }
                        )
                    
                    assert response.status_code == 201
                    data = response.json()
                    assert data["contribution_id"] == str(contrib_id)
                    assert data["status"] == "PENDING"
                    assert Decimal(data["amount"]) == Decimal("50.00")
                    assert data["pix_copy_paste"] == "000201010212..."
                    assert data["pix_qr_code_base64"] == "iVBORw0KGgo..."

    @pytest.mark.asyncio
    async def test_create_pix_contribution_allows_anonymous_visitors(self, transport):
        """Public contribution page should create Pix payments without a session."""
        contrib_id = uuid4()

        mock_contribution = MagicMock()
        mock_contribution.id = contrib_id
        mock_contribution.status = ContributionStatus.PENDING
        mock_contribution.amount = Decimal("25.00")
        mock_contribution.pix_copy_paste = "000201010212..."
        mock_contribution.pix_qr_code_base64 = "iVBORw0KGgo..."
        mock_contribution.expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

        with patch("app.routers.contributions.settings.PAYMENTS_ENABLED", True):
            with patch.object(
                ContributionService, "create_contribution", new_callable=AsyncMock
            ) as mock_create:
                mock_create.return_value = mock_contribution

                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    response = await client.post(
                        "/api/v1/contributions/pix",
                        json={
                            "amount": "25.00",
                            "payer_name": "",
                            "payer_email": "",
                        }
                    )

                assert response.status_code == 201
                data = response.json()
                assert data["contribution_id"] == str(contrib_id)
                mock_create.assert_awaited_once_with(
                    amount=Decimal("25.00"),
                    payer_email=None,
                    payer_name=None,
                )
    
    @pytest.mark.asyncio
    async def test_get_contribution_status_success(self, transport):
        """Status endpoint should return contribution status."""
        contrib_id = uuid4()
        
        mock_contribution = MagicMock()
        mock_contribution.id = contrib_id
        mock_contribution.status = ContributionStatus.PAID
        mock_contribution.amount = Decimal("25.00")
        mock_contribution.provider_payment_id = "123456789"
        mock_contribution.paid_at = datetime.now(timezone.utc)
        mock_contribution.refunded_at = None
        mock_contribution.cancelled_at = None
        mock_contribution.expires_at = None
        
        with patch.object(
            ContributionService, "get_contribution_status", new_callable=AsyncMock
        ) as mock_get:
            mock_get.return_value = mock_contribution
            
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get(
                    f"/api/v1/contributions/{contrib_id}/status"
                )
            
            assert response.status_code == 200
            data = response.json()
            assert data["contribution_id"] == str(contrib_id)
            assert data["status"] == "PAID"
            assert Decimal(data["amount"]) == Decimal("25.00")
            assert data["provider_payment_id"] == "123456789"
    
    @pytest.mark.asyncio
    async def test_get_contribution_status_not_found(self, transport):
        """Non-existent contribution should return 404."""
        with patch.object(
            ContributionService, "get_contribution_status", new_callable=AsyncMock
        ) as mock_get:
            mock_get.side_effect = ContributionNotFoundError("not found")
            
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get(
                    f"/api/v1/contributions/{uuid4()}/status"
                )
            
            assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_get_contribution_status_invalid_uuid(self, transport):
        """Invalid UUID should return 400."""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(
                "/api/v1/contributions/invalid-uuid/status"
            )
        
        assert response.status_code == 400
    
    @pytest.mark.asyncio
    async def test_webhook_payment_updated(self, transport):
        """Webhook should process payment update and return 200."""
        with patch.object(
            ContributionService, "process_webhook_notification", new_callable=AsyncMock
        ) as mock_process:
            mock_process.return_value = True
            
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/webhooks/mercadopago",
                    json={
                        "action": "payment.updated",
                        "type": "payment",
                        "data": {"id": "123456789"}
                    },
                    headers={
                        "x-signature": _make_valid_signature("123456789", "req-123"),
                        "x-request-id": "req-123"
                    }
                )
            
            assert response.status_code == 200
            assert response.json()["received"] is True
            mock_process.assert_awaited_once_with(
                payment_id=123456789,
                external_reference=None
            )
    
    @pytest.mark.asyncio
    async def test_webhook_payment_created(self, transport):
        """Webhook should handle payment.created action."""
        with patch.object(
            ContributionService, "process_webhook_notification", new_callable=AsyncMock
        ) as mock_process:
            mock_process.return_value = True
            
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/webhooks/mercadopago",
                    json={
                        "action": "payment.created",
                        "type": "payment",
                        "data": {"id": "987654321"}
                    },
                    headers={
                        "x-signature": _make_valid_signature("987654321", "req-123"),
                        "x-request-id": "req-123"
                    }
                )
            
            assert response.status_code == 200
            assert response.json()["received"] is True
    
    @pytest.mark.asyncio
    async def test_webhook_non_payment_type(self, transport):
        """Non-payment webhook should be ignored but return 200."""
        with patch.object(
            ContributionService, "process_webhook_notification", new_callable=AsyncMock
        ) as mock_process:
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/webhooks/mercadopago",
                    json={
                        "action": "subscription.authorized",
                        "type": "subscription",
                        "data": {"id": "sub_123"}
                    },
                    headers={
                        "x-signature": _make_valid_signature("sub_123", "req-123"),
                        "x-request-id": "req-123"
                    }
                )
            
            assert response.status_code == 200
            assert response.json()["received"] is True
            mock_process.assert_not_awaited()
    
    @pytest.mark.asyncio
    async def test_webhook_no_payment_id(self, transport):
        """Webhook without payment ID should still return 200."""
        with patch.object(
            ContributionService, "process_webhook_notification", new_callable=AsyncMock
        ) as mock_process:
            mock_process.return_value = False
            
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/webhooks/mercadopago",
                    json={
                        "action": "payment.updated",
                        "type": "payment",
                        "data": {"id": "999"}
                    },
                    headers={
                        "x-signature": _make_valid_signature("999", "req-123"),
                        "x-request-id": "req-123"
                    }
                )
            
            assert response.status_code == 200
            assert response.json()["received"] is True
    
    @pytest.mark.asyncio
    async def test_webhook_provider_error_still_returns_200(self, transport):
        """Even if processing fails, webhook should return 200 to prevent retries."""
        with patch.object(
            ContributionService, "process_webhook_notification", new_callable=AsyncMock
        ) as mock_process:
            mock_process.side_effect = PaymentProviderError("MP API down")
            
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/webhooks/mercadopago",
                    json={
                        "action": "payment.updated",
                        "type": "payment",
                        "data": {"id": "123"}
                    },
                    headers={
                        "x-signature": _make_valid_signature("123", "req-123"),
                        "x-request-id": "req-123"
                    }
                )
            
            assert response.status_code == 200
            assert response.json()["received"] is True
    
    @pytest.mark.asyncio
    async def test_webhook_invalid_signature_returns_401(self, transport):
        """Webhook with invalid signature should return 401."""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/webhooks/mercadopago",
                json={
                    "action": "payment.updated",
                    "type": "payment",
                    "data": {"id": "123"}
                },
                headers={
                    "x-signature": "ts=1234567890,v1=invalidsignature",
                    "x-request-id": "req-123"
                }
            )
        
        assert response.status_code == 401


# ============================================================================
# Contribution Model Tests
# ============================================================================

class TestContributionModel:
    """Test Contribution model behavior."""
    
    def test_terminal_statuses(self):
        c = Contribution(status=ContributionStatus.PAID)
        assert c.is_terminal_status() is True
        
        c.status = ContributionStatus.PENDING
        assert c.is_terminal_status() is False
        
        c.status = ContributionStatus.FAILED
        assert c.is_terminal_status() is True
    
    def test_can_transition_same_status(self):
        c = Contribution(status=ContributionStatus.PENDING)
        assert c.can_transition_to(ContributionStatus.PENDING) is True
    
    def test_can_transition_from_pending(self):
        c = Contribution(status=ContributionStatus.PENDING)
        assert c.can_transition_to(ContributionStatus.PAID) is True
        assert c.can_transition_to(ContributionStatus.FAILED) is True
    
    def test_cannot_transition_from_terminal(self):
        c = Contribution(status=ContributionStatus.PAID)
        assert c.can_transition_to(ContributionStatus.FAILED) is False
        assert c.can_transition_to(ContributionStatus.PENDING) is False
        
        c.status = ContributionStatus.CANCELLED
        assert c.can_transition_to(ContributionStatus.PAID) is False
    
    def test_disputed_transition_rules(self):
        c = Contribution(status=ContributionStatus.DISPUTED)
        assert c.can_transition_to(ContributionStatus.PAID) is True
        assert c.can_transition_to(ContributionStatus.FAILED) is True
        assert c.can_transition_to(ContributionStatus.REFUNDED) is True
        assert c.can_transition_to(ContributionStatus.PENDING) is False


# ============================================================================
# Webhook Processing Tests
# ============================================================================

class TestWebhookProcessing:
    """Test webhook processing logic in ContributionService."""
    
    @pytest.mark.asyncio
    async def test_process_webhook_missing_ids(self):
        db = FakeDb()
        service = ContributionService(db)
        
        result = await service.process_webhook_notification(None, None)
        assert result is False
    
    @pytest.mark.asyncio
    async def test_process_webhook_unknown_contribution(self):
        fake_result = MagicMock()
        fake_result.scalar_one_or_none = lambda: None
        
        db = FakeDb(execute_results=[fake_result])
        service = ContributionService(db)
        
        result = await service.process_webhook_notification(payment_id=12345)
        assert result is False
    
    @pytest.mark.asyncio
    async def test_process_webhook_terminal_state_idempotent(self):
        """Webhook for already-paid contribution should be ignored."""
        contribution = MagicMock()
        contribution.id = uuid4()
        contribution.status = ContributionStatus.PAID
        contribution.is_terminal_status = lambda: True
        contribution.provider_payment_id = "12345"
        
        fake_result = MagicMock()
        fake_result.scalar_one_or_none = lambda: contribution
        
        db = FakeDb(execute_results=[fake_result])
        service = ContributionService(db)
        
        result = await service.process_webhook_notification(payment_id=12345)
        assert result is True
    
    @pytest.mark.asyncio
    async def test_process_webhook_updates_status(self):
        """Webhook should query MP and update status."""
        contribution = MagicMock()
        contribution.id = uuid4()
        contribution.status = ContributionStatus.PENDING
        contribution.is_terminal_status = lambda: False
        contribution.can_transition_to = lambda s: True
        contribution.provider_payment_id = "12345"
        contribution.paid_at = None
        contribution.refunded_at = None
        contribution.cancelled_at = None
        contribution.updated_at = None
        contribution.raw_provider_response = None
        
        fake_result = MagicMock()
        fake_result.scalar_one_or_none = lambda: contribution
        
        db = FakeDb(execute_results=[fake_result])
        service = ContributionService(db)
        
        mp_payment = {
            "id": 12345,
            "status": "approved",
            "status_detail": "accredited"
        }
        
        with patch.object(
            MercadoPagoClient, "get_payment", new_callable=AsyncMock
        ) as mock_get:
            mock_get.return_value = mp_payment
            
            result = await service.process_webhook_notification(payment_id=12345)
            assert result is True
            assert contribution.status == ContributionStatus.PAID
            assert contribution.paid_at is not None
            assert contribution.raw_provider_response == mp_payment
