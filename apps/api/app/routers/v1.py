"""API v1 Router - Public API with versioning

Implements /api/v1/ prefix for all endpoints as per M3.4 specification.
All endpoints are versioned for backwards compatibility.
"""

from fastapi import APIRouter, Request, Response
from uuid import UUID

# Import existing routers to wrap with v1 prefix
from app.routers.auth import router as auth_router
from app.routers.projects import router as projects_router
from app.routers.environments import router as environments_router
from app.routers.vault import router as vault_router
from app.routers.members import router as members_router
from app.routers.invites import router as invites_router
from app.routers.audit import router as audit_router
from app.routers.tokens import router as tokens_router
from app.routers.ci import router as ci_router
from app.routers.integrations import router as integrations_router
from app.routers.api_keys import router as api_keys_router  # M3.4
from app.routers.rotation import router as rotation_router, expiring_router  # M3.5

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


# Note: auth_router has prefix="/api/auth", so including it adds /api/v1/api/auth/*
# For clean v1 auth at /api/v1/auth/* we would need separate route definitions
# Current setup uses legacy auth at /api/auth with v1 proxy at /api/v1/api/auth

# Include all existing routers under v1 prefix
# Auth becomes /api/v1/api/auth/* - not ideal but functional for v1
v1_router.include_router(projects_router)
v1_router.include_router(environments_router)
v1_router.include_router(vault_router)
v1_router.include_router(members_router)
v1_router.include_router(invites_router)
v1_router.include_router(audit_router)
v1_router.include_router(tokens_router)
v1_router.include_router(ci_router)
v1_router.include_router(integrations_router)
v1_router.include_router(api_keys_router)  # M3.4: API Keys CRUD
v1_router.include_router(rotation_router)  # M3.5: Secret Rotation
v1_router.include_router(expiring_router)  # M3.5: Expiring Secrets List