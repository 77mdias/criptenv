#!/usr/bin/env python3
"""Test Mercado Pago Webhook in Production

This script verifies your production webhook configuration by sending
a test notification to your live endpoint with a valid signature.

Usage:
    python scripts/test_webhook_production.py --url https://criptenv-api.77mdevseven.tech/webhooks/mercadopago --secret YOUR_SECRET --payment-id 123456789
"""

import argparse
import hmac
import hashlib
import json
import sys
import time
import uuid

try:
    import httpx
except ImportError:
    print("Error: httpx is required. Install with: pip install httpx")
    sys.exit(1)


def generate_signature(secret: str, data_id: str, request_id: str, ts: str) -> str:
    """Generate a valid Mercado Pago webhook HMAC-SHA256 signature."""
    manifest = f"id:{data_id};request-id:{request_id};ts:{ts};"
    signature = hmac.new(
        secret.encode("utf-8"),
        manifest.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"ts={ts},v1={signature}"


def test_webhook(url: str, payment_id: str, secret: str) -> None:
    """Send a test webhook to production endpoint."""
    ts = str(int(time.time()))
    request_id = f"prod-test-{uuid.uuid4().hex[:16]}"
    
    payload = {
        "action": "payment.updated",
        "type": "payment",
        "id": int(payment_id) if payment_id.isdigit() else None,
        "data": {"id": payment_id},
        "date_created": time.strftime("%Y-%m-%dT%H:%M:%S.000-04:00"),
        "api_version": "v1",
        "live_mode": True,
    }
    
    x_signature = generate_signature(secret, payment_id, request_id, ts)
    
    headers = {
        "Content-Type": "application/json",
        "x-signature": x_signature,
        "x-request-id": request_id,
    }
    
    print("=" * 60)
    print("Production Webhook Test")
    print("=" * 60)
    print(f"\nEndpoint: {url}")
    print(f"Payment ID: {payment_id}")
    print(f"\nX-Signature: {x_signature}")
    print(f"\nPayload:")
    print(json.dumps(payload, indent=2))
    print()
    
    try:
        response = httpx.post(url, json=payload, headers=headers, timeout=30.0, follow_redirects=True)
        
        print("-" * 60)
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {response.text}")
        print("-" * 60)
        
        if response.status_code == 200:
            print("✅ Webhook accepted!")
            print("\nYour production webhook is correctly configured.")
        elif response.status_code == 401:
            print("❌ Signature validation failed (401)")
            print("   - Check that MERCADO_PAGO_WEBHOOK_SECRET matches the dashboard")
            print("   - Ensure the secret is set in production environment variables")
        elif response.status_code == 404:
            print("❌ Endpoint not found (404)")
            print("   - Check that the deployment includes the latest code")
            print("   - Verify the URL path: /webhooks/mercadopago")
        else:
            print(f"⚠️ Unexpected response: {response.status_code}")
            
    except httpx.ConnectError as e:
        print(f"❌ Connection failed: {e}")
        print(f"   - Is the server accessible at {url}?")
    except Exception as e:
        print(f"❌ Error: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Test Mercado Pago webhook in production",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test production endpoint
  python scripts/test_webhook_production.py --url https://criptenv-api.77mdevseven.tech/webhooks/mercadopago --secret your-secret --payment-id 123456789

  # With custom payment ID
  python scripts/test_webhook_production.py --secret my-webhook-secret --payment-id 987654321
        """,
    )
    
    parser.add_argument(
        "--url",
        default="https://criptenv-api.77mdevseven.tech/webhooks/mercadopago",
        help="Production webhook URL",
    )
    parser.add_argument(
        "--secret",
        required=True,
        help="Webhook secret from Mercado Pago dashboard",
    )
    parser.add_argument(
        "--payment-id",
        default="123456789",
        help="Test payment ID",
    )
    
    args = parser.parse_args()
    test_webhook(args.url, args.payment_id, args.secret)


if __name__ == "__main__":
    main()
