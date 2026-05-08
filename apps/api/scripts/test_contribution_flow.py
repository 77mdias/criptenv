#!/usr/bin/env python3
"""Test Complete Contribution Flow

End-to-end test script for the Mercado Pago Pix contribution flow.
Runs locally against the development server.

Usage:
    python scripts/test_contribution_flow.py
    python scripts/test_contribution_flow.py --amount 25.00 --email test@example.com
"""

import argparse
import base64
import json
import os
import sys
import tempfile
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

try:
    import httpx
except ImportError:
    print("Error: httpx is required. Install with: pip install httpx")
    sys.exit(1)

from app.config import settings


def login(base_url: str, email: str, password: str) -> str:
    """Login and return the session cookie file path."""
    cookie_jar = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
    cookie_jar.close()
    
    response = httpx.post(
        f"{base_url}/api/auth/signin",
        json={"email": email, "password": password},
        follow_redirects=True,
        timeout=30.0,
    )
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        print(response.text)
        sys.exit(1)
    
    # Save cookies manually
    cookies = response.cookies
    with open(cookie_jar.name, 'w') as f:
        for cookie in cookies.jar:
            f.write(f"{cookie.domain}\tTRUE\t{cookie.path}\t{'TRUE' if cookie.secure else 'FALSE'}\t{cookie.expires or 0}\t{cookie.name}\t{cookie.value}\n")
    
    print(f"✅ Logged in as {email}")
    return cookie_jar.name


def create_contribution(base_url: str, cookie_file: str, amount: float, email: str, name: str) -> dict:
    """Create a Pix contribution."""
    cookies = {}
    with open(cookie_file) as f:
        for line in f:
            parts = line.strip().split('\t')
            if len(parts) >= 7:
                cookies[parts[5]] = parts[6]
    
    response = httpx.post(
        f"{base_url}/api/v1/contributions/pix",
        json={"amount": str(amount), "payer_email": email, "payer_name": name},
        cookies=cookies,
        timeout=30.0,
    )
    
    if response.status_code != 201:
        print(f"❌ Failed to create contribution: {response.status_code}")
        print(response.text)
        sys.exit(1)
    
    data = response.json()
    print(f"✅ Contribution created: {data['contribution_id']}")
    print(f"   Status: {data['status']}")
    print(f"   Amount: R$ {data['amount']}")
    print(f"   Expires: {data['expires_at']}")
    print()
    print(f"   Pix Copy-Paste:")
    print(f"   {data['pix_copy_paste'][:80]}...")
    print()
    
    # Save QR code to temp file for inspection
    if data.get('pix_qr_code_base64'):
        qr_path = tempfile.mktemp(suffix='.png')
        with open(qr_path, 'wb') as f:
            f.write(base64.b64decode(data['pix_qr_code_base64']))
        print(f"   QR Code saved to: {qr_path}")
    
    return data


def check_status(base_url: str, contribution_id: str) -> dict:
    """Check contribution status."""
    response = httpx.get(f"{base_url}/api/v1/contributions/{contribution_id}/status", timeout=30.0)
    return response.json()


def simulate_webhook(base_url: str, payment_id: str, secret: str) -> bool:
    """Simulate Mercado Pago webhook with valid signature."""
    import hmac, hashlib, time as time_mod
    
    ts = str(int(time_mod.time()))
    request_id = f"test-flow-{os.urandom(4).hex()}"
    manifest = f"id:{payment_id};request-id:{request_id};ts:{ts};"
    sig = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    
    response = httpx.post(
        f"{base_url}/webhooks/mercadopago",
        json={
            "action": "payment.updated",
            "type": "payment",
            "data": {"id": payment_id}
        },
        headers={
            "x-signature": f"ts={ts},v1={sig}",
            "x-request-id": request_id,
        },
        timeout=30.0,
    )
    
    if response.status_code == 200:
        print(f"✅ Webhook accepted (payment_id={payment_id})")
        return True
    else:
        print(f"❌ Webhook rejected: {response.status_code} - {response.text}")
        return False


def run_flow(base_url: str, amount: float, email: str, password: str, name: str, secret: str):
    """Run the complete contribution flow."""
    print("=" * 60)
    print("CriptEnv - Contribution Flow Test")
    print("=" * 60)
    print()
    print(f"Server: {base_url}")
    print(f"Amount: R$ {amount:.2f}")
    print()
    
    # Step 1: Login
    print("Step 1/4: Login...")
    cookie_file = login(base_url, email, password)
    
    # Step 2: Create contribution
    print()
    print("Step 2/4: Creating Pix contribution...")
    contribution = create_contribution(base_url, cookie_file, amount, email, name)
    
    # Step 3: Check initial status
    print()
    print("Step 3/4: Checking initial status...")
    status = check_status(base_url, contribution["contribution_id"])
    print(f"   Status: {status['status']}")
    print(f"   Provider Payment ID: {status['provider_payment_id']}")
    
    # Step 4: Simulate webhook
    print()
    print("Step 4/4: Simulating Mercado Pago webhook...")
    payment_id = status["provider_payment_id"]
    simulate_webhook(base_url, payment_id, secret)
    
    # Final status check
    print()
    print("Final status check...")
    final_status = check_status(base_url, contribution["contribution_id"])
    print(f"   Status: {final_status['status']}")
    if final_status.get('paid_at'):
        print(f"   Paid at: {final_status['paid_at']}")
    
    print()
    print("=" * 60)
    print("Flow completed!")
    print("=" * 60)
    print()
    print(f"Contribution ID: {contribution['contribution_id']}")
    print(f"Provider Payment ID: {payment_id}")
    print()
    print("To check status anytime:")
    print(f"  curl {base_url}/api/v1/contributions/{contribution['contribution_id']}/status")
    
    # Cleanup
    os.unlink(cookie_file)


def main():
    parser = argparse.ArgumentParser(description="Test complete contribution flow")
    parser.add_argument("--url", default="http://localhost:8000", help="Base API URL")
    parser.add_argument("--amount", type=float, default=10.0, help="Contribution amount")
    parser.add_argument("--email", default="teste@exemplo.com", help="User email")
    parser.add_argument("--password", default="senhaSegura123", help="User password")
    parser.add_argument("--name", default="Teste", help="Payer name")
    parser.add_argument("--secret", default=None, help="Webhook secret (auto-detected from env)")
    
    args = parser.parse_args()
    
    secret = args.secret or settings.MERCADO_PAGO_WEBHOOK_SECRET
    if not secret:
        print("❌ MERCADO_PAGO_WEBHOOK_SECRET not set")
        print("   Add it to apps/api/.env or pass --secret")
        sys.exit(1)
    
    run_flow(args.url, args.amount, args.email, args.password, args.name, secret)


if __name__ == "__main__":
    main()
