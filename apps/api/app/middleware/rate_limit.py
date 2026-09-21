"""Rate Limiting Middleware for M3.4 Public API

Implements rate limiting with different limits per authentication method.
Uses slowapi for FastAPI integration with X-RateLimit-* headers.
"""

import hashlib
import time
from typing import Optional
from datetime import datetime, timezone

from fastapi import Request, HTTPException, status
from starlette.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.models.api_key import API_KEY_PREFIX


# Rate limit constants per authentication method
AUTH_RATE_LIMIT = "5/minute"      # Auth endpoints: 5 req/min per IP
API_KEY_RATE_LIMIT = "1000/minute"  # API key: 1000 req/min per key
CI_TOKEN_RATE_LIMIT = "200/minute"  # CI token: 200 req/min per token
PUBLIC_RATE_LIMIT = "100/minute"    # Public endpoints: 100 req/min per IP

# Paths that verify credentials, so they get the strict AUTH_RATE_LIMIT instead
# of the generic anonymous bucket. These are the brute-force surfaces (signin,
# password reset, 2FA challenge) plus the unauthenticated CLI code exchange.
#
# NOTE: /api/auth/cli/device/poll is deliberately absent — the CLI polls it every
# `interval` seconds (12 requests/minute), so a 5/min limit would break the
# device flow. It is not a credential-guessing endpoint.
AUTH_RATE_LIMIT_PATHS = (
    "/api/auth/signin",
    "/api/auth/signup",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/change-password",
    "/api/auth/send-verification",
    "/api/auth/verify-email",
    "/api/auth/2fa/challenge/verify",
    "/api/auth/2fa/disable",
    "/api/auth/cli/initiate",
    "/api/auth/cli/token",
    "/api/auth/invites/accept",
)

# Error code
RATE_LIMIT_ERROR_CODE = "RATE_LIMIT_EXCEEDED"

# In-memory fallback for local development; VPS production uses Redis storage.
_rate_limit_storage: dict[str, tuple[int, float]] = {}


class RateLimitConfig:
    """Configuration for rate limiting."""
    
    def __init__(
        self,
        default_limit: str = "100/minute",
        enabled: bool = True,
        storage_uri: Optional[str] = None,
        storage_backend: str = "memory",
        trusted_proxies: Optional[set[str]] = None,
    ):
        self.default_limit = default_limit
        self.enabled = enabled
        self.storage_uri = storage_uri
        self.storage_backend = storage_backend
        self.trusted_proxies = trusted_proxies or set()


class RateLimitHeaders:
    """Rate limit header values."""
    
    def __init__(self, limit: int, remaining: int, reset_timestamp: int):
        self.limit = limit
        self.remaining = remaining
        self.reset = reset_timestamp
    
    def to_dict(self) -> dict[str, str]:
        """Convert to header dict."""
        return {
            "X-RateLimit-Limit": str(self.limit),
            "X-RateLimit-Remaining": str(self.remaining),
            "X-RateLimit-Reset": str(self.reset)
        }


class RateLimitExceeded(HTTPException):
    """Exception raised when rate limit is exceeded."""
    
    def __init__(self, limit: int, retry_after: int):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": RATE_LIMIT_ERROR_CODE,
                "message": f"Rate limit exceeded. Limit: {limit} requests per minute.",
                "retry_after": retry_after
            }
        )


class RateLimitStorage:
    """Storage interface for rate limit counters.
    
    GRASP Protected Variations: Can be swapped between in-memory and Redis.
    """
    
    def __init__(
        self,
        storage_backend: str = "memory",
        storage_uri: Optional[str] = None,
        redis_client: Optional[object] = None,
    ):
        self.storage_backend = storage_backend.strip().lower()
        self._storage = _rate_limit_storage
        self._redis = redis_client
        self._storage_uri = storage_uri

        if self.storage_backend not in {"memory", "redis"}:
            raise ValueError("RATE_LIMIT_STORAGE must be 'memory' or 'redis'")

        if self.storage_backend == "redis" and self._redis is None:
            if not storage_uri:
                raise ValueError("REDIS_URL is required when RATE_LIMIT_STORAGE=redis")
            try:
                from redis.asyncio import Redis
            except ImportError as exc:
                raise RuntimeError(
                    "redis package is required when RATE_LIMIT_STORAGE=redis"
                ) from exc
            self._redis = Redis.from_url(storage_uri, decode_responses=False)
    
    async def get_count(self, key: str) -> int:
        """Get current request count for key."""
        if self.storage_backend == "redis":
            value = await self._redis.get(key)
            if value is None:
                return 0
            return int(value)

        if key not in self._storage:
            return 0
        count, timestamp = self._storage[key]
        # Check if window expired
        if self._is_window_expired(timestamp):
            await self.reset(key)
            return 0
        return count
    
    async def increment_count(self, key: str, window_seconds: int = 60) -> int:
        """Increment count and return new value."""
        if self.storage_backend == "redis":
            count = int(await self._redis.incr(key))
            if count == 1:
                await self._redis.expire(key, window_seconds)
            return count

        now = time.time()
        if key not in self._storage or self._is_window_expired(self._storage[key][1]):
            self._storage[key] = (1, now)
            return 1
        count, _ = self._storage[key]
        self._storage[key] = (count + 1, self._storage[key][1])
        return count + 1
    
    async def reset(self, key: str):
        """Reset counter for key."""
        if self.storage_backend == "redis":
            await self._redis.delete(key)
            return

        if key in self._storage:
            del self._storage[key]
    
    def _is_window_expired(self, timestamp: float) -> bool:
        """Check if the rate limit window has expired (1 minute)."""
        return time.time() - timestamp > 60


def get_rate_limit_key(request: Request) -> Optional[str]:
    """Extract identifier for rate limiting based on auth method.
    
    Returns:
        - A per-key digest if API key auth
        - None if session/CI token (will use IP fallback)
    """
    token = _extract_bearer_token(request)
    if token and token.startswith(API_KEY_PREFIX):
        return api_key_rate_limit_key(token)

    # Session or CI token - fallback to IP in middleware
    return None


def _extract_bearer_token(request: Request) -> Optional[str]:
    """Return the bearer token from the Authorization header, if any."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


def api_key_rate_limit_key(token: str) -> str:
    """Build a stable, per-key rate limit bucket.

    Hashing the full token gives each API key its own counter without storing or
    logging the credential. Truncating the raw token instead (the previous
    behaviour) collapsed every live key into the same `cek_live` bucket, so one
    noisy key throttled all API consumers.
    """
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    return f"apikey:{digest[:24]}"


def _normalize_ip(value: str) -> str:
    """Strip the IPv4-mapped IPv6 prefix so `::ffff:1.2.3.4` matches `1.2.3.4`."""
    value = value.strip()
    if value.lower().startswith("::ffff:"):
        return value[7:]
    return value


def get_client_ip(request: Request, trusted_proxies: Optional[set[str]] = None) -> str:
    """Resolve the client address used for rate limiting and abuse tracking.

    `X-Forwarded-For` is only consulted when the immediate peer is a configured
    trusted proxy; anything else could be set by the client itself. The chain is
    walked from the hop closest to us back towards the client and stops at the
    first untrusted address, so a client-injected left-hand value is ignored.
    """
    peer = _normalize_ip(request.client.host) if request.client else "unknown"
    trusted = {_normalize_ip(entry) for entry in (trusted_proxies or set())}

    if peer not in trusted:
        return peer

    forwarded_for = request.headers.get("x-forwarded-for")
    if not forwarded_for:
        return peer

    chain = [_normalize_ip(hop) for hop in forwarded_for.split(",") if hop.strip()]
    for hop in reversed(chain):
        if hop not in trusted:
            return hop
    return chain[0] if chain else peer


def is_auth_rate_limited_path(path: str) -> bool:
    """Whether `path` is one of the credential-verifying endpoints."""
    return path.rstrip("/") in AUTH_RATE_LIMIT_PATHS


def build_rate_limit_key(request: Request, client_ip: str) -> str:
    """Bucket a request by credential when present, otherwise by client IP."""
    if is_auth_rate_limited_path(request.url.path):
        return f"auth:{client_ip}"

    api_key = get_rate_limit_key(request)
    if api_key:
        return api_key

    return f"ip:{client_ip}"


def resolve_rate_limit(request: Request) -> str:
    """Pick the rate limit string that applies to this request."""
    if is_auth_rate_limited_path(request.url.path):
        return AUTH_RATE_LIMIT
    return get_rate_limit_for_auth_type(identify_auth_type(request))


def identify_auth_type(request: Request) -> str:
    """Identify the authentication type being used."""
    auth_header = request.headers.get("Authorization", "")
    
    if auth_header.startswith("Bearer cek_"):
        return "api_key"
    elif auth_header.startswith("Bearer ci_"):
        return "ci_token"
    elif auth_header.startswith("Bearer "):
        return "session"
    else:
        return "anonymous"


def should_bypass_rate_limit(request: Request) -> bool:
    """Check if request should bypass rate limiting (health checks)."""
    path = request.url.path
    bypass_paths = ["/health", "/health/ready", "/docs", "/redoc", "/openapi.json"]
    return any(path.startswith(p) for p in bypass_paths)


def get_rate_limit_for_auth_type(auth_type: str) -> str:
    """Get rate limit string based on authentication type."""
    limits = {
        "api_key": API_KEY_RATE_LIMIT,
        "ci_token": CI_TOKEN_RATE_LIMIT,
        "session": "100/minute",
        "anonymous": PUBLIC_RATE_LIMIT
    }
    return limits.get(auth_type, PUBLIC_RATE_LIMIT)


def parse_rate_limit(limit_str: str) -> tuple[int, int]:
    """Parse rate limit string like '100/minute' into (count, window_seconds)."""
    count_str, window_str = limit_str.split("/")
    count = int(count_str)
    
    if window_str == "minute":
        window = 60
    elif window_str == "hour":
        window = 3600
    elif window_str == "day":
        window = 86400
    else:
        window = 60
    
    return count, window


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware that enforces rate limits and adds rate limit headers.
    
    GRASP: Indirection - mediates rate limit enforcement.
    """
    
    def __init__(self, app, config: Optional[RateLimitConfig] = None):
        super().__init__(app)
        self.config = config or RateLimitConfig()
        self.storage = RateLimitStorage(
            storage_backend=self.config.storage_backend,
            storage_uri=self.config.storage_uri,
        )
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks and docs
        if should_bypass_rate_limit(request):
            return await call_next(request)
        
        if not self.config.enabled:
            return await call_next(request)
        
        # Pick the limit for this route, then bucket by credential or client IP.
        limit_str = resolve_rate_limit(request)
        limit_count, window_seconds = parse_rate_limit(limit_str)
        client_ip = get_client_ip(request, self.config.trusted_proxies)
        rate_key = build_rate_limit_key(request, client_ip)

        if rate_key:
            current_count = await self.storage.get_count(rate_key)
            
            if current_count >= limit_count:
                # Rate limit exceeded
                reset_time = int(time.time()) + window_seconds
                response = JSONResponse(
                    status_code=429,
                    content={
                        "error": {
                            "code": RATE_LIMIT_ERROR_CODE,
                            "message": f"Rate limit exceeded. Try again in {window_seconds} seconds.",
                            "retry_after": window_seconds
                        }
                    }
                )
                response.headers["X-RateLimit-Limit"] = str(limit_count)
                response.headers["X-RateLimit-Remaining"] = "0"
                response.headers["X-RateLimit-Reset"] = str(reset_time)
                return response
            
            # Increment counter
            await self.storage.increment_count(rate_key, window_seconds)
            remaining = limit_count - current_count - 1
        else:
            remaining = limit_count - 1
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        reset_time = int(time.time()) + window_seconds
        response.headers["X-RateLimit-Limit"] = str(limit_count)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        response.headers["X-RateLimit-Reset"] = str(reset_time)
        
        return response
