"""API v1 Router - Public API with versioning

Implements /api/v1/ prefix for all endpoints as per M3.4 specification.
All endpoints are versioned for backwards compatibility.
"""

from fastapi import APIRouter, Request

from app.routers.api_keys import router as api_keys_router  # M3.4

API_VERSION = "1.0"
API_PREFIX = "/api/v1"

# Create v1 router with prefix
v1_router = APIRouter(prefix=API_PREFIX)


# Health endpoints with versioning
@v1_router.get("/health", tags=["Health"])
async def v1_health_check():
    """Health check endpoint for v1 API."""
    return {"status": "ok", "service": "criptenv-api", "version": API_VERSION}


@v1_router.get("/health/ready", tags=["Health"])
async def v1_readiness_check(request: Request):
    """Readiness check with database status."""
    from app.database import engine
    from sqlalchemy import text
    
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected", "version": API_VERSION}
    except Exception as e:
        return {
            "status": "not ready",
            "database": "disconnected",
            "version": API_VERSION,
            "error": str(e)
        }


# Most routers already include the /api/v1 prefix and are mounted directly in
# main.py for backwards compatibility. Only routers with relative prefixes
# should be included here.
v1_router.include_router(api_keys_router)  # M3.4: API Keys CRUD
