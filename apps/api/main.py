from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, APIKeyHeader
from fastapi.openapi.utils import get_openapi
from contextlib import asynccontextmanager
import time
import logging

from app.config import settings
from app.database import close_db
from app.routers import (
    auth_router,
    oauth_router,
    projects_router,
    environments_router,
    vault_router,
    members_router,
    invites_router,
    audit_router,
    tokens_router,
    ci_router,
    integrations_router,
    contributions_router,
    webhooks_router,
    cli_auth_router
)
from app.routers.v1 import v1_router  # M3.4: API Versioning
from app.middleware.api_version import APIVersionMiddleware  # M3.4: API Version header
from app.middleware.rate_limit import RateLimitConfig, RateLimitMiddleware  # M3.4: Rate limiting

logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# M3.4.6: OpenAPI Security Schemes
bearer_scheme = HTTPBearer(
    scheme_name="BearerAuth",
    description="JWT token obtained from /api/auth/signin or /api/auth/signup",
    auto_error=False,
)
api_key_header = APIKeyHeader(
    name="X-API-Key",
    scheme_name="ApiKeyAuth",
    description="API key with cek_ prefix for programmatic access",
    auto_error=False,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting CriptEnv API...")
    
    # M3.6: Start scheduler if enabled
    scheduler_manager = None
    if getattr(settings, 'SCHEDULER_ENABLED', True):
        try:
            from app.jobs.scheduler import init_scheduler_job
            from app.jobs.expiration_check import create_session_scoped_scheduler_job
            from app.database import async_session_factory
            
            job_func = create_session_scoped_scheduler_job(async_session_factory)
            scheduler_manager = init_scheduler_job(
                job_func,
                interval_hours=getattr(settings, 'SCHEDULER_INTERVAL_HOURS', 1)
            )
            scheduler_manager.start()
            logger.info(
                f"Scheduler started (interval: {getattr(settings, 'SCHEDULER_INTERVAL_HOURS', 1)}h)"
            )
        except ImportError:
            logger.warning("APScheduler not installed, skipping scheduler init")
        except Exception as e:
            logger.warning(f"Failed to start scheduler: {e}")
    
    yield
    
    # Graceful shutdown
    if scheduler_manager:
        scheduler_manager.stop()
        logger.info("Scheduler stopped")
    
    logger.info("Shutting down CriptEnv API...")
    await close_db()


app = FastAPI(
    title="CriptEnv API",
    description="""Secret management platform API for CriptEnv.
    
    ## Authentication

    This API supports two authentication methods:
    - **Bearer Token**: JWT token obtained from `/api/auth/signin` or `/api/auth/signup`
    - **API Key**: For programmatic access, use an API key with `cek_` prefix

    ## Rate Limiting

    Different endpoints have different rate limits:
    - Auth endpoints: 5 requests/minute per IP
    - API Key endpoints: 1000 requests/minute per key
    - Public endpoints: 100 requests/minute per IP

    ## Versioning

    This API is versioned. Current version: **v1** (prefix: `/api/v1/`)

    ## Error Responses

    All errors follow a consistent format with `code`, `message`, and optional `details`.
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json",
    swagger_ui_parameters={"syntaxHighlight": False},
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add API Version middleware (M3.4)
app.add_middleware(APIVersionMiddleware)

# Add Rate Limit middleware (M3.4)
app.add_middleware(
    RateLimitMiddleware,
    config=RateLimitConfig(
        enabled=settings.RATE_LIMIT_ENABLED,
        storage_backend=settings.RATE_LIMIT_STORAGE,
        storage_uri=settings.REDIS_URL or None,
    ),
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    start_time = time.time()

    response = await call_next(request)

    process_time = time.time() - start_time
    logger.info(
        f"{request.method} {request.url.path} "
        f"status={response.status_code} "
        f"duration={process_time:.4f}s "
        f"client={request.client.host if request.client else 'unknown'}"
    )

    response.headers["X-Process-Time"] = str(process_time)

    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": {
            "code": "INTERNAL_ERROR",
            "message": "Internal server error"
        }}
    )


# M3.4: Legacy health endpoints (backwards compatibility)
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "criptenv-api"}


@app.get("/api/health", tags=["Health"])
async def api_health_check():
    return await health_check()


@app.get("/health/ready", tags=["Health"])
async def readiness_check():
    from app.database import engine
    from sqlalchemy import text

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={"status": "not ready", "database": "disconnected"}
        )


@app.get("/api/health/ready", tags=["Health"])
async def api_readiness_check():
    return await readiness_check()


# M3.4: Include v1 API router with /api/v1/ prefix
app.include_router(v1_router)

# Legacy routers (backwards compatibility - no prefix)
app.include_router(auth_router)
app.include_router(oauth_router)
app.include_router(projects_router)
app.include_router(environments_router)
app.include_router(vault_router)
app.include_router(members_router)
app.include_router(invites_router)
app.include_router(audit_router)
app.include_router(tokens_router)
app.include_router(ci_router)
app.include_router(integrations_router)
app.include_router(contributions_router)
app.include_router(webhooks_router)
app.include_router(cli_auth_router)


# Custom OpenAPI schema with dual security schemes
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "description": "JWT session token obtained from /api/auth/signin",
        },
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "Authorization",
            "description": "API key with cek_ prefix passed as Bearer token (e.g., 'Bearer cek_live_xxx')",
        },
    }
    
    # Define dual-auth security for public API read endpoints
    dual_auth = [{"BearerAuth": []}, {"ApiKeyAuth": []}]
    
    # Apply dual auth to read endpoints that support API key access
    public_paths = [
        ("/api/v1/projects", "get"),
        ("/api/v1/projects/{project_id}", "get"),
        ("/api/v1/projects/{project_id}/environments", "get"),
        ("/api/v1/projects/{project_id}/environments/{environment_id}", "get"),
        ("/api/v1/projects/{project_id}/environments/{environment_id}/vault/pull", "get"),
        ("/api/v1/projects/{project_id}/environments/{environment_id}/vault/version", "get"),
    ]
    
    for path, method in public_paths:
        if path in openapi_schema.get("paths", {}):
            if method in openapi_schema["paths"][path]:
                openapi_schema["paths"][path][method]["security"] = dual_auth
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
