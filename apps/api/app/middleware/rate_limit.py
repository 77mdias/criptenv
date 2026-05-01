"""Rate Limiting Middleware for M3.4 Public API

Implements rate limiting with different limits per authentication method.
Uses slowapi for FastAPI integration with X-RateLimit-* headers.
"""

import time
from typing import Optional
from datetime import datetime, timezone

from fastapi import Request, HTTPException, status
from starlette.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


# Rate limit constants per authentication method
AUTH_RATE_LIMIT = "5/minute"      # Auth endpoints: 5 req/min per IP
API_KEY_RATE_LIMIT = "1000/minute"  # API key: 1000 req/min per key
CI_TOKEN_RATE_LIMIT = "200/minute"  # CI token: 200 req/min per token
PUBLIC_RATE_LIMIT = "100/minute"    # Public endpoints: 100 req/min per IP

# Error code
RATE_LIMIT_ERROR_CODE = "RATE_LIMIT_EXCEEDED"

# In-memory storage for rate limit counters (replace with Redis in production)
_rate_limit_storage: dict[str, tuple[int, float]] = {}


class RateLimitConfig:
    """Configuration for rate limiting."""
    
    def __init__(
        self,
        default_limit: str = "100/minute",
        enabled: bool = True,
        storage_uri: Optional[str] = None
    ):
        self.default_limit = default_limit
        self.enabled = enabled
        self.storage_uri = storage_uri


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
    
    def __init__(self):
        self._storage = _rate_limit_storage
    
    def get_count(self, key: str) -> int:
        """Get current request count for key."""
        if key not in self._storage:
            return 0
        count, timestamp = self._storage[key]
        # Check if window expired
        if self._is_window_expired(timestamp):
            self.reset(key)
            return 0
        return count
    
    def increment_count(self, key: str) -> int:
        """Increment count and return new value."""
        now = time.time()
        if key not in self._storage or self._is_window_expired(self._storage[key][1]):
            self._storage[key] = (1, now)
            return 1
        count, _ = self._storage[key]
        self._storage[key] = (count + 1, self._storage[key][1])
        return count + 1
    
    def reset(self, key: str):
        """Reset counter for key."""
        if key in self._storage:
            del self._storage[key]
    
    def _is_window_expired(self, timestamp: float) -> bool:
        """Check if the rate limit window has expired (1 minute)."""
        return time.time() - timestamp > 60


def get_rate_limit_key(request: Request) -> Optional[str]:
    """Extract identifier for rate limiting based on auth method.
    
    Returns:
        - API key prefix (e.g., "cek_live_") if API key auth
        - None if session/CI token (will use IP fallback)
    """
    auth_header = request.headers.get("Authorization", "")
    
    if auth_header.startswith("Bearer cek_"):
        # API key - use prefix for rate limiting
        key = auth_header[7:]  # Remove "Bearer "
        return key[:8] if len(key) >= 8 else key  # "cek_live_" or "cek_test_"
    
    # Session or CI token - fallback to IP in middleware
    return None


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
        self.storage = RateLimitStorage()
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks and docs
        if should_bypass_rate_limit(request):
            return await call_next(request)
        
        if not self.config.enabled:
            return await call_next(request)
        
        # Get identifier and auth type
        auth_type = identify_auth_type(request)
        limit_str = get_rate_limit_for_auth_type(auth_type)
        limit_count, window_seconds = parse_rate_limit(limit_str)
        
        # Get rate limit key
        if auth_type == "api_key":
            rate_key = get_rate_limit_key(request)
        else:
            # Use IP for session/CI token/anonymous
            rate_key = f"ip:{request.client.host if request.client else 'unknown'}"
        
        if rate_key:
            current_count = self.storage.get_count(rate_key)
            
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
            self.storage.increment_count(rate_key)
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