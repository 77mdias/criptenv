# ===========================================
# CriptEnv API - Dockerfile (Multi-stage)
# ===========================================
# Supports both development and production builds.
#
# Development:  docker compose -f docker-compose.dev.yml up
# Production:   docker compose -f docker-compose.yml up
# Image build:  docker build -t criptenv-api -f apps/api/Dockerfile .

# ---------- Stage 1: Dependencies ----------
FROM python:3.11-slim AS deps

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY apps/api/requirements.txt ./requirements.txt
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

# ---------- Stage 2: Runtime (Production) ----------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

COPY apps/api/ ./

RUN chmod +x entrypoint.sh \
    && useradd --create-home --shell /usr/sbin/nologin --uid 10001 criptenv \
    && chown -R criptenv:criptenv /app

USER criptenv

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
CMD ["gunicorn", "main:app", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "60", "--access-logfile", "-", "--error-logfile", "-"]
