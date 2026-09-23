# Deployment Guide — CriptEnv

Complete production deployment guide for the current stack.

---

## Architecture Overview

```
┌─────────────┐   same-origin /api   ┌───────────────────┐   internal HTTP   ┌─────────────┐
│ Cloudflare  │ ───────────────────► │ Cloudflare Tunnel │ ────────────────► │ VPS Docker  │
│ Pages +     │ Worker API_URL proxy │ criptenv-api.*    │                   │ FastAPI API │
│ Workers     │                      └───────────────────┘                   │ + Redis     │
└─────────────┘                                                               └──────┬──────┘
       │                                                                               │
       ▼                                                                               ▼
https://criptenv.77mdevseven.tech                                           Supabase PostgreSQL
```

| Component | Platform | URL Pattern | Notes |
|-----------|----------|-------------|-------|
| **Web** | Cloudflare Pages + Workers | `https://criptenv.77mdevseven.tech` | Browser calls use relative `/api/*` |
| **API** | VPS Docker + Cloudflare Tunnel | `https://criptenv-api.77mdevseven.tech` | Tunnel forwards to `http://api:8000` |
| **Rate limits** | Redis on VPS | internal | Shared counters across API workers |
| **Database** | PostgreSQL 15 in VPS Docker Compose | internal | Persistent `postgres_data` volume; Supabase is a legacy migration source |
| **CLI** | PyPI future | `pip install criptenv` | Not required for hosting the web/API MVP |

Render/Railway hosting configs remain as legacy rollback references. Product integrations with Render/Railway are separate from CriptEnv's own hosting.

---

## 1. Web — Cloudflare Pages + Workers

### Environment

Set these in Cloudflare Pages:

```bash
NEXT_PUBLIC_API_URL=
API_URL=https://criptenv-api.77mdevseven.tech
NEXT_PUBLIC_COOKIE_NAME=criptenv_session
NEXT_PUBLIC_APP_URL=https://criptenv.77mdevseven.tech
# Optional: override the avatar origins allowed by the Worker CSP. Defaults to
# https://avatars.77mdevseven.tech and https://*.r2.dev (the R2 public URLs).
AVATAR_PUBLIC_ORIGIN=https://avatars.77mdevseven.tech
```

`NEXT_PUBLIC_API_URL` should stay empty in production so browser requests use the same-origin Worker proxy. The Worker reads `API_URL` at runtime and forwards `/api/*` to the VPS API.

Avatars are rendered with a plain `<img>` straight from the R2 public URL, so the Worker CSP must list that origin in `img-src`; otherwise the browser blocks the image and the UI falls back to initials. `AVATAR_PUBLIC_ORIGIN` is optional and overrides the built-in defaults.

Configure the custom Pages domain:

```text
criptenv.77mdevseven.tech
```

### Deploy

```bash
cd apps/web
npm install
npm run build
npm run deploy
```

Or from the repository root:

```bash
make web-deploy
```

---

## 2. Database — PostgreSQL on the VPS

The production Compose stack runs PostgreSQL 15 locally. Configure the API with the internal service hostname:

```bash
postgresql+asyncpg://criptenv:[password]@postgres:5432/criptenv
```

Apply migrations from a trusted machine or from the VPS:

```bash
cd apps/api
export DATABASE_URL="postgresql+asyncpg://criptenv:password@postgres:5432/criptenv"
alembic upgrade head
```

The API strips pooler-only query params and disables asyncpg prepared statement caches for pgbouncer compatibility.

---

## 3. API — VPS Docker + Cloudflare Tunnel

### Prerequisites

- VPS with Docker Engine and Docker Compose plugin.
- Cloudflare zone for `77mdevseven.tech`.
- Cloudflare Tunnel token for the API tunnel.
- Supabase PostgreSQL pooler URL.

### Configure

```bash
cd deploy/vps
cp .env.example .env
```

Fill:

| Variable | Value |
|----------|-------|
| `API_URL` | `https://criptenv-api.77mdevseven.tech` |
| `FRONTEND_URL` | `https://criptenv.77mdevseven.tech` |
| `CORS_ORIGINS` | `https://criptenv.77mdevseven.tech` |
| `TUNNEL_TOKEN` | Cloudflare Tunnel token |
| `DATABASE_URL` | Supabase pooler URL |
| `SECRET_KEY` | Random 64+ char secret |
| `INTEGRATION_CONFIG_SECRET` | Different random 64+ char secret |
| `RATE_LIMIT_STORAGE` | `redis` |
| `REDIS_URL` | `redis://redis:6379/0` |
| `WEB_CONCURRENCY` | `3` for the 8GB VPS default |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | `2` / `2` default to protect Supabase pooler |
| `SUPABASE_URL` | Supabase project base URL, e.g. `https://your-project.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service-role key for server-side avatar uploads |
| `SUPABASE_AVATAR_BUCKET` | `avatars` |

### Start

```bash
docker compose up -d --build
docker compose ps
curl http://localhost:8000/health
curl http://localhost:8000/health/ready
```

### Cloudflare Tunnel

In Cloudflare Zero Trust, configure the tunnel public hostname:

```text
Hostname: criptenv-api.77mdevseven.tech
Service:  http://api:8000
```

The API service stays bound to localhost on the VPS and is reached publicly through the outbound `cloudflare-tunnel` container.

Then verify:

```bash
curl https://criptenv-api.77mdevseven.tech/health
curl https://criptenv-api.77mdevseven.tech/api/health
curl https://criptenv.77mdevseven.tech/api/health
```

The compose stack runs API workers with `SCHEDULER_ENABLED=false` and a separate internal `scheduler` service with one worker and `SCHEDULER_ENABLED=true`, preventing duplicate APScheduler jobs.

---

## 4. Render Rollback

`apps/api/render.yaml`, `apps/api/Procfile`, and `apps/api/railway.toml` are retained as rollback/legacy references. If the VPS has an outage, redeploying a hosted API is acceptable after updating Cloudflare Pages `API_URL` to the rollback API URL.

Do not remove `RenderProvider`; it is unrelated to where CriptEnv itself is hosted.

---

## Environment Variables Reference

### API

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL URL; use `postgres` as hostname inside Compose |
| `SECRET_KEY` | Yes | Session signing secret |
| `INTEGRATION_CONFIG_SECRET` | Yes | Encrypts provider integration config at rest |
| `DEBUG` | Yes | `false` in production |
| `API_URL` | Yes | Public API URL |
| `FRONTEND_URL` | Yes | Frontend app URL for OAuth redirects |
| `CORS_ORIGINS` | Yes | Allowed frontend origins |
| `RATE_LIMIT_STORAGE` | Yes | `redis` for VPS production |
| `REDIS_URL` | Yes when Redis enabled | `redis://redis:6379/0` |
| `R2_ACCOUNT_ID` | Yes when R2 is selected | Cloudflare account identifier |
| `R2_ACCESS_KEY_ID` | Yes when R2 is selected | R2 access key, server-side only |
| `R2_SECRET_ACCESS_KEY` | Yes when R2 is selected | R2 secret, server-side only |
| `R2_BUCKET` | Yes when R2 is selected | Avatar bucket name |
| `R2_PUBLIC_URL` | Yes when R2 is selected | Public avatar domain, without query/fragment |
| `WEB_CONCURRENCY` | VPS compose | API worker count |
| `SCHEDULER_ENABLED` | Compose-controlled | Disabled in `api`, enabled in `scheduler` |
| `TUNNEL_TOKEN` | VPS compose | Cloudflare Tunnel token |

When `AVATAR_STORAGE_BACKEND=supabase`, the legacy `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` and `SUPABASE_AVATAR_BUCKET` variables are required instead. `SUPABASE_URL` must be the project base URL.

### Web

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | No | Empty in production for same-origin proxy |
| `API_URL` | Yes | Worker runtime backend target |
| `NEXT_PUBLIC_COOKIE_NAME` | Yes | `criptenv_session` |
| `NEXT_PUBLIC_APP_URL` | Yes | Cloudflare Pages custom frontend URL |
| `AVATAR_PUBLIC_ORIGIN` | No | Comma-separated avatar origins allowed in the Worker CSP `img-src`; defaults to `https://avatars.77mdevseven.tech,https://*.r2.dev` |

---

## Quick Deployment Checklist

- [ ] Current PostgreSQL migrations applied/confirmed with `alembic upgrade head`.
- [ ] `deploy/vps/.env` filled on the VPS.
- [ ] Cloudflare Tunnel routes `criptenv-api.77mdevseven.tech` to `http://api:8000`.
- [ ] Cloudflare Pages custom domain is `criptenv.77mdevseven.tech`.
- [ ] `docker compose up -d` succeeds on the target VPS.
- [ ] Local API health checks return `ok`.
- [ ] Public API health checks return `ok`.
- [ ] Cloudflare Pages/Workers has `API_URL=https://criptenv-api.77mdevseven.tech`.
- [ ] Cloudflare Pages/Workers leaves `NEXT_PUBLIC_API_URL` empty.
- [ ] `/api/health` works through the deployed frontend Worker.
- [ ] Login/signup and OAuth set HTTP-only cookies on the frontend origin.
- [ ] Vault push/pull validated through the production frontend.

---

**Document Version**: 3.1
**Last Updated**: 2026-09-18
