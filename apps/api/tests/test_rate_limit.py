"""Test Rate Limiting Middleware for M3.4 Public API

HELL TDD - RED phase: Tests for rate limiting with slowapi.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime, timezone

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def test_rate_limit_key_function_api_key():
    """Each API key must get its own bucket (CR-P1-7).

    The old implementation returned `key[:8]`, which for every `cek_live_*`
    token is the constant "cek_live" — every tenant shared one counter.
    """
    from app.middleware.rate_limit import get_rate_limit_key
    
    request = MagicMock()
    request.headers = {"Authorization": "Bearer cek_live_abc123xyz"}
    key_a = get_rate_limit_key(request)

    request.headers = {"Authorization": "Bearer cek_live_different456"}
    key_b = get_rate_limit_key(request)

    assert key_a is not None and key_b is not None
    assert key_a != key_b, "distinct API keys must not share a rate limit bucket"
    assert key_a.startswith("apikey:")
    # The credential itself must never appear in the bucket name.
    assert "cek_live_abc123xyz" not in key_a
    assert "cek_live" not in key_a

    # Stable across calls for the same key.
    request.headers = {"Authorization": "Bearer cek_live_abc123xyz"}
    assert get_rate_limit_key(request) == key_a
    
    # With CI token (should return None for rate limit by IP)
    request.headers = {"Authorization": "Bearer ci_token_abc"}
    key = get_rate_limit_key(request)
    assert key is None


def test_rate_limit_key_function_session():
    """Session auth returns None for rate limiting by IP."""
    from app.middleware.rate_limit import get_rate_limit_key
    
    request = MagicMock()
    request.headers = {"Authorization": "Bearer session_token"}
    request.client.host = "192.168.1.1"
    
    key = get_rate_limit_key(request)
    # Returns None - will use IP fallback in limiter
    assert key is None


def test_rate_limit_headers_added():
    """Rate limit headers should be added to response."""
    from app.middleware.rate_limit import RateLimitHeaders
    
    headers = RateLimitHeaders(
        limit=1000,
        remaining=999,
        reset_timestamp=1714521600
    )
    
    assert headers.limit == 1000
    assert headers.remaining == 999
    assert headers.reset == 1714521600
    assert headers.to_dict() == {
        "X-RateLimit-Limit": "1000",
        "X-RateLimit-Remaining": "999",
        "X-RateLimit-Reset": "1714521600"
    }


def test_rate_limit_exceeded_error():
    """RateLimitExceeded should have correct format."""
    from app.middleware.rate_limit import RateLimitExceeded
    
    error = RateLimitExceeded(
        limit=1000,
        retry_after=60
    )
    
    assert error.status_code == 429
    # detail is a dict with code, message, and retry_after
    assert error.detail["code"] == "RATE_LIMIT_EXCEEDED"
    assert "retry_after" in error.detail
    assert error.detail["retry_after"] == 60


def test_auth_endpoints_limit_5_per_minute():
    """Auth endpoints should have 5 requests per minute limit."""
    from app.middleware.rate_limit import AUTH_RATE_LIMIT
    
    assert AUTH_RATE_LIMIT == "5/minute"


def test_api_key_endpoints_limit_1000_per_minute():
    """API key endpoints should have 1000 requests per minute limit."""
    from app.middleware.rate_limit import API_KEY_RATE_LIMIT
    
    assert API_KEY_RATE_LIMIT == "1000/minute"


def test_ci_token_endpoints_limit_200_per_minute():
    """CI token endpoints should have 200 requests per minute limit."""
    from app.middleware.rate_limit import CI_TOKEN_RATE_LIMIT
    
    assert CI_TOKEN_RATE_LIMIT == "200/minute"


def test_public_endpoints_limit_100_per_minute():
    """Public endpoints should have 100 requests per minute limit."""
    from app.middleware.rate_limit import PUBLIC_RATE_LIMIT
    
    assert PUBLIC_RATE_LIMIT == "100/minute"


def test_rate_limit_config_defaults():
    """Default rate limit configuration."""
    from app.middleware.rate_limit import RateLimitConfig
    
    config = RateLimitConfig()
    
    assert config.default_limit == "100/minute"
    assert config.enabled is True


def test_rate_limit_config_custom():
    """Custom rate limit configuration."""
    from app.middleware.rate_limit import RateLimitConfig
    
    config = RateLimitConfig(
        default_limit="200/minute",
        enabled=False,
        storage_uri="redis://localhost:6379"
    )
    
    assert config.default_limit == "200/minute"
    assert config.enabled is False
    assert config.storage_uri == "redis://localhost:6379"


def test_rate_limit_key_extractor_patterns():
    """Test various rate limit key extraction patterns."""
    from app.middleware.rate_limit import get_rate_limit_key
    
    # No auth header - uses IP
    request = MagicMock()
    request.headers = {}
    request.client.host = "10.0.0.1"
    
    key = get_rate_limit_key(request)
    assert key is None  # Will fall back to IP
    
    # Malformed auth header
    request.headers = {"Authorization": "invalid"}
    key = get_rate_limit_key(request)
    assert key is None
    
    # Empty Bearer
    request.headers = {"Authorization": "Bearer "}
    key = get_rate_limit_key(request)
    assert key is None


def test_rate_limit_error_code():
    """Rate limit error should have correct code."""
    from app.middleware.rate_limit import RATE_LIMIT_ERROR_CODE
    
    assert RATE_LIMIT_ERROR_CODE == "RATE_LIMIT_EXCEEDED"


def test_get_identifiers_for_different_auth_types():
    """Different auth types get different rate limit treatment."""
    from app.middleware.rate_limit import get_rate_limit_key, identify_auth_type
    
    # API key auth
    request = MagicMock()
    request.headers = {"Authorization": "Bearer cek_live_abc123"}
    assert identify_auth_type(request) == "api_key"
    
    # CI token auth
    request.headers = {"Authorization": "Bearer ci_token_abc"}
    assert identify_auth_type(request) == "ci_token"
    
    # Session auth
    request.headers = {"Authorization": "Bearer session_abc"}
    assert identify_auth_type(request) == "session"
    
    # No auth
    request.headers = {}
    assert identify_auth_type(request) == "anonymous"


def test_rate_limit_bypass_for_health_checks():
    """Health check endpoints should bypass rate limiting."""
    from app.middleware.rate_limit import should_bypass_rate_limit
    
    # Use a proper mock URL
    request = MagicMock()
    mock_url = MagicMock()
    mock_url.path = "/health"
    request.url = mock_url
    
    # /health bypasses rate limiting
    assert should_bypass_rate_limit(request) is True
    
    # /api/v1/health is NOT in bypass list (only /health, /health/ready, /docs, /redoc, /openapi.json)
    mock_url.path = "/api/v1/health"
    assert should_bypass_rate_limit(request) is False  # Not in bypass list
    
    # Normal API endpoints should not bypass
    mock_url.path = "/api/v1/projects"
    assert should_bypass_rate_limit(request) is False
    
    # OpenAPI spec is bypassed
    mock_url.path = "/openapi.json"
    assert should_bypass_rate_limit(request) is True


def test_rate_limit_storage_interface():
    """Rate limit storage interface for Redis/in-memory."""
    from app.middleware.rate_limit import RateLimitStorage
    
    storage = RateLimitStorage()
    
    # Should implement get/set interface
    assert hasattr(storage, 'get_count')
    assert hasattr(storage, 'increment_count')
    assert hasattr(storage, 'reset')


def test_redis_rate_limit_storage_requires_url():
    """Redis storage should fail clearly when enabled without REDIS_URL."""
    from app.middleware.rate_limit import RateLimitStorage

    with pytest.raises(ValueError, match="REDIS_URL"):
        RateLimitStorage(storage_backend="redis")


class FakeRedis:
    """Tiny async Redis double for shared counter behavior."""

    def __init__(self):
        self.values: dict[str, int] = {}
        self.expirations: dict[str, int] = {}

    async def get(self, key: str):
        value = self.values.get(key)
        if value is None:
            return None
        return str(value).encode()

    async def incr(self, key: str):
        self.values[key] = self.values.get(key, 0) + 1
        return self.values[key]

    async def expire(self, key: str, seconds: int):
        self.expirations[key] = seconds
        return True

    async def delete(self, key: str):
        self.values.pop(key, None)
        self.expirations.pop(key, None)
        return 1


@pytest.mark.asyncio
async def test_redis_rate_limit_storage_shares_counters_between_instances():
    """Redis-backed counters should be shared across API worker instances."""
    from app.middleware.rate_limit import RateLimitStorage

    redis_client = FakeRedis()
    storage_a = RateLimitStorage(storage_backend="redis", redis_client=redis_client)
    storage_b = RateLimitStorage(storage_backend="redis", redis_client=redis_client)

    assert await storage_a.increment_count("rate:shared", 60) == 1
    assert await storage_b.get_count("rate:shared") == 1
    assert await storage_b.increment_count("rate:shared", 60) == 2
    assert redis_client.expirations["rate:shared"] == 60


# ─── Auth-path limits and trusted proxy identity (CR-P1-6) ───────────────────


def _request(path: str, *, client_host: str = "203.0.113.9", headers: dict | None = None):
    request = MagicMock()
    mock_url = MagicMock()
    mock_url.path = path
    request.url = mock_url
    request.headers = headers or {}
    request.client.host = client_host
    return request


@pytest.mark.parametrize(
    "path",
    [
        "/api/auth/signin",
        "/api/auth/signup",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
        "/api/auth/change-password",
        "/api/auth/2fa/challenge/verify",
        "/api/auth/cli/token",
    ],
)
def test_auth_paths_get_the_strict_limit(path):
    """Credential endpoints must use AUTH_RATE_LIMIT, not the anonymous bucket."""
    from app.middleware.rate_limit import resolve_rate_limit, build_rate_limit_key

    request = _request(path)
    assert resolve_rate_limit(request) == "5/minute"
    assert build_rate_limit_key(request, "203.0.113.9") == "auth:203.0.113.9"


def test_non_auth_paths_keep_their_limit():
    """A normal API read must not be throttled to 5/min."""
    from app.middleware.rate_limit import resolve_rate_limit

    assert resolve_rate_limit(_request("/api/v1/projects")) == "100/minute"


def test_device_poll_is_excluded_from_the_auth_bucket():
    """The CLI polls device/poll every 5s, so it must not be capped at 5/min."""
    from app.middleware.rate_limit import resolve_rate_limit, is_auth_rate_limited_path

    assert is_auth_rate_limited_path("/api/auth/cli/device/poll") is False
    assert resolve_rate_limit(_request("/api/auth/cli/device/poll")) == "100/minute"


def test_forwarded_for_ignored_from_untrusted_peer():
    """A client-supplied X-Forwarded-For must not spoof the rate limit identity."""
    from app.middleware.rate_limit import get_client_ip

    request = _request(
        "/api/auth/signin",
        client_host="203.0.113.9",
        headers={"x-forwarded-for": "1.2.3.4"},
    )

    assert get_client_ip(request, {"127.0.0.1"}) == "203.0.113.9"


def test_forwarded_for_used_from_trusted_proxy():
    """A trusted proxy may assert the real client address."""
    from app.middleware.rate_limit import get_client_ip

    request = _request(
        "/api/auth/signin",
        client_host="127.0.0.1",
        headers={"x-forwarded-for": "198.51.100.7"},
    )

    assert get_client_ip(request, {"127.0.0.1"}) == "198.51.100.7"


def test_forwarded_for_chain_stops_at_first_untrusted_hop():
    """A client-injected left-hand entry must be ignored.

    `X-Forwarded-For: 9.9.9.9, 198.51.100.7` where only the rightmost hop came
    from our own proxy still resolves to 198.51.100.7, not the forged 9.9.9.9.
    """
    from app.middleware.rate_limit import get_client_ip

    request = _request(
        "/api/auth/signin",
        client_host="127.0.0.1",
        headers={"x-forwarded-for": "9.9.9.9, 198.51.100.7, 127.0.0.1"},
    )

    assert get_client_ip(request, {"127.0.0.1"}) == "198.51.100.7"


def test_ipv4_mapped_ipv6_is_normalized():
    """`::ffff:127.0.0.1` must match the configured trusted proxy."""
    from app.middleware.rate_limit import get_client_ip

    request = _request(
        "/api/auth/signin",
        client_host="::ffff:127.0.0.1",
        headers={"x-forwarded-for": "198.51.100.7"},
    )

    assert get_client_ip(request, {"127.0.0.1"}) == "198.51.100.7"


def test_no_trusted_proxies_falls_back_to_peer_address():
    """With no configured proxy, forwarded headers are never trusted."""
    from app.middleware.rate_limit import get_client_ip

    request = _request(
        "/api/auth/signin",
        client_host="127.0.0.1",
        headers={"x-forwarded-for": "198.51.100.7"},
    )

    assert get_client_ip(request, set()) == "127.0.0.1"
