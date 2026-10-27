import os
import sys
from pathlib import Path


API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

os.environ.setdefault("DATABASE_URL", "postgresql://user:pass@localhost:5432/test")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("INTEGRATION_CONFIG_SECRET", "test-integration-config-secret-32-chars")
os.environ.setdefault("MERCADO_PAGO_ACCESS_TOKEN", "TEST-access-token")
os.environ.setdefault("MERCADO_PAGO_WEBHOOK_SECRET", "test-webhook-secret")
os.environ["DEBUG"] = "true"


import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_rate_limit_counters():
    """The in-memory limiter is a module-level dict; without a reset, request
    counts leak across tests and late HTTP tests get 429s depending on order."""
    from app.middleware import rate_limit

    rate_limit._rate_limit_storage.clear()
    yield
