from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time
import logging

from app.config import settings
from app.database import close_db
from app.routers import (
    auth_router,
    projects_router,
    environments_router,
    vault_router,
    members_router,
    invites_router,
    audit_router,
    tokens_router,
    ci_router,
    integrations_router
)

logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting CriptEnv API...")
    yield
    logger.info("Shutting down CriptEnv API...")
    await close_db()


app = FastAPI(
    title="CriptEnv API",
    description="Secret management platform API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
        content={"detail": "Internal server error"}
    )


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "criptenv-api"}


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


app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(environments_router)
app.include_router(vault_router)
app.include_router(members_router)
app.include_router(invites_router)
app.include_router(audit_router)
app.include_router(tokens_router)
app.include_router(ci_router)
app.include_router(integrations_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
