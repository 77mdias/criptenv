#!/usr/bin/env python3
"""Test Mercado Pago Webhook Signature and Endpoint

This script generates a valid Mercado Pago webhook signature and sends
a test notification to your local or production webhook endpoint.

Usage:
    # Local testing
    python scripts/test_webhook.py --url http://localhost:8000/webhooks/mercadopago --payment-id 123456789

    # Production testing (with your real secret)
    python scripts/test_webhook.py --url https://criptenv.duckdns.org/webhooks/mercadopago --payment-id 123456789 --secret your-real-secret

    # Custom action (e.g., payment.created)
    python scripts/test_webhook.py --url http://localhost:8000/webhooks/mercadopago --payment-id 123456789 --action payment.created
"""

import argparse
import hmac
import hashlib
import json
import sys
import time
import uuid
from pathlib import Path

# Add parent dirs to path so we can import app modules
API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

try:
    import httpx
except ImportError:
    print("Error: httpx is required. Install with: pip install httpx")
    sys.exit(1)


def generate_signature(secret: str, data_id: str, request_id: str, ts: str) -> str:
    """Generate a valid Mercado Pago webhook HMAC-SHA256 signature.
    
    The manifest format is:
        id:<data_id>;request-id:<request_id>;ts:<ts>;
    """
    manifest = f"id:{data_id};request-id:{request_id};ts:{ts};"
    signature = hmac.new(
        secret.encode("utf-8"),
        manifest.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"ts={ts},v1={signature}"


def send_webhook(
    url: str,
    payment_id: str,
    secret: str,
    action: str = "payment.updated",
    topic: str = "payment",
) -> None:
    """Send a test webhook notification to the specified endpoint."""
    
    # Generate request metadata
    ts = str(int(time.time()))
    request_id = f"test-{uuid.uuid4().hex[:16]}"
    
    # Build payload matching Mercado Pago format
    payload = {
        "action": action,
        "type": topic,
        "id": int(payment_id) if payment_id.isdigit() else None,
        "data": {
            "id": payment_id,
        },
        "date_created": time.strftime("%Y-%m-%dT%H:%M:%S.000-04:00"),
        "user_id": None,
        "api_version": "v1",
        "live_mode": False,
    }
    
    # Generate signature
    x_signature = generate_signature(secret, payment_id, request_id, ts)
    
    headers = {
        "Content-Type": "application/json",
        "x-signature": x_signature,
        "x-request-id": request_id,
    }
    
    print("=" * 60)
    print("Mercado Pago Webhook Test")
    print("=" * 60)
    print(f"\nEndpoint: {url}")
    print(f"Payment ID: {payment_id}")
    print(f"Action: {action}")
    print(f"Request ID: {request_id}")
    print(f"Timestamp: {ts}")
    print(f"\nX-Signature: {x_signature}")
    print(f"\nPayload:")
    print(json.dumps(payload, indent=2))
    print()
    
    # Send request
    try:
        response = httpx.post(url, json=payload, headers=headers, timeout=30.0)
        
        print("-" * 60)
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {response.text}")
        print("-" * 60)
        
        if response.status_code == 200:
            print("✅ Webhook accepted successfully!")
        elif response.status_code == 401:
            print("❌ Signature validation failed (401)")
            print("   Check that MERCADO_PAGO_WEBHOOK_SECRET matches between sender and receiver")
        else:
            print(f"⚠️ Unexpected response: {response.status_code}")
            
    except httpx.ConnectError as e:
        print(f"❌ Connection failed: {e}")
        print(f"   Is the server running at {url}?")
    except Exception as e:
        print(f"❌ Error: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Test Mercado Pago webhook endpoint with valid signature",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test locally (uses conftest.py secret if available)
  python scripts/test_webhook.py --payment-id 123456789

  # Test production endpoint
  python scripts/test_webhook.py --url https://your-api.com/webhooks/mercadopago --secret your-secret --payment-id 123456789

  # Simulate payment.created event
  python scripts/test_webhook.py --payment-id 123456789 --action payment.created
        """,
    )
    
    parser.add_argument(
        "--url",
        default="http://localhost:8000/webhooks/mercadopago",
        help="Webhook endpoint URL (default: http://localhost:8000/webhooks/mercadopago)",
    )
    parser.add_argument(
        "--payment-id",
        required=True,
        help="Mercado Pago payment ID to simulate",
    )
    parser.add_argument(
        "--secret",
        default=None,
        help="Webhook secret (defaults to MERCADO_PAGO_WEBHOOK_SECRET env var or conftest value)",
    )
    parser.add_argument(
        "--action",
        default="payment.updated",
        choices=["payment.updated", "payment.created"],
        help="Webhook action type (default: payment.updated)",
    )
    
    args = parser.parse_args()
    
    # Resolve secret
    secret = args.secret
    if not secret:
        # Try to load from environment or app config
        try:
            from app.config import settings
            secret = settings.MERCADO_PAGO_WEBHOOK_SECRET
        except Exception:
            pass
    
    if not secret:
        print("❌ No webhook secret provided!")
        print("   Set MERCADO_PAGO_WEBHOOK_SECRET in your .env file")
        print("   Or pass --secret explicitly")
        print()
        print("   For local testing without validation, you can use any value:")
        print("   python scripts/test_webhook.py --payment-id 123 --secret test-secret")
        sys.exit(1)
    
    send_webhook(
        url=args.url,
        payment_id=args.payment_id,
        secret=secret,
        action=args.action,
    )


if __name__ == "__main__":
    main()
