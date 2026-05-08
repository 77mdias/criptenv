#!/bin/bash
# Production Webhook Checklist for CriptEnv
# Run this after deploying to production to verify everything is working

set -e

API_URL="${API_URL:-https://criptenv.duckdns.org}"
WEBHOOK_URL="${API_URL}/webhooks/mercadopago"
HEALTH_URL="${API_URL}/api/health"

echo "=========================================="
echo "CriptEnv Production Checklist"
echo "=========================================="
echo ""
echo "API URL: ${API_URL}"
echo "Webhook URL: ${WEBHOOK_URL}"
echo ""

# Check 1: Health endpoint
echo "Check 1: Health endpoint..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
    echo "  ✅ API is online"
else
    echo "  ❌ API returned HTTP $HTTP_STATUS"
    exit 1
fi

# Check 2: Webhook endpoint exists (should return 422 for empty body, not 404)
echo "Check 2: Webhook endpoint exists..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${WEBHOOK_URL}" || echo "000")
if [ "$HTTP_STATUS" = "422" ] || [ "$HTTP_STATUS" = "401" ]; then
    echo "  ✅ Webhook endpoint is reachable (HTTP $HTTP_STATUS)"
else
    echo "  ❌ Webhook endpoint returned HTTP $HTTP_STATUS"
    exit 1
fi

# Check 3: Environment variables
echo "Check 3: Required environment variables..."
REQUIRED_VARS=(
    "MERCADO_PAGO_ACCESS_TOKEN"
    "MERCADO_PAGO_PUBLIC_KEY"
    "MERCADO_PAGO_WEBHOOK_SECRET"
    "API_URL"
    "PAYMENTS_ENABLED"
    "PAYMENTS_ENV"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "  ❌ $var is not set"
    else
        echo "  ✅ $var is set"
    fi
done

echo ""
echo "=========================================="
echo "Manual checks required:"
echo "=========================================="
echo ""
echo "1. Mercado Pago Dashboard:"
echo "   - URL configured: ${WEBHOOK_URL}"
echo "   - Events: Pagamentos ✅"
echo "   - Secret matches MERCADO_PAGO_WEBHOOK_SECRET"
echo ""
echo "2. Mercado Pago Credentials:"
echo "   - MERCADO_PAGO_ACCESS_TOKEN starts with 'APP_USR-' (production)"
echo "   - MERCADO_PAGO_PUBLIC_KEY starts with 'APP_USR-' (production)"
echo "   - PAYMENTS_ENV=production"
echo ""
echo "3. Test a real payment:"
echo "   - Create a Pix contribution via frontend"
echo "   - Pay using a real banking app"
echo "   - Check if webhook updates status to PAID"
echo ""
