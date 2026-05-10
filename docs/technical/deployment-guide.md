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
| **Database** | Supabase | internal | Use pooler URL on port `6543` |
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
```

`NEXT_PUBLIC_API_URL` should stay empty in production so browser requests use the same-origin Worker proxy. The Worker reads `API_URL` at runtime and forwards `/api/*` to the VPS API.

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

## 2. Database — Supabase

Create a Supabase PostgreSQL project and copy the pooler connection string:

```bash
postgresql://postgres.[project]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

Apply migrations from a trusted machine or from the VPS:

```bash
cd apps/api
export DATABASE_URL="postgresql://postgres.xxx:xxx@aws-0-region.pooler.supabase.com:6543/postgres"
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
| `DATABASE_URL` | Yes | Supabase PostgreSQL pooler URL |
| `SECRET_KEY` | Yes | Session signing secret |
| `INTEGRATION_CONFIG_SECRET` | Yes | Encrypts provider integration config at rest |
| `DEBUG` | Yes | `false` in production |
| `API_URL` | Yes | Public API URL |
| `FRONTEND_URL` | Yes | Frontend app URL for OAuth redirects |
| `CORS_ORIGINS` | Yes | Allowed frontend origins |
| `RATE_LIMIT_STORAGE` | Yes | `redis` for VPS production |
| `REDIS_URL` | Yes when Redis enabled | `redis://redis:6379/0` |
| `WEB_CONCURRENCY` | VPS compose | API worker count |
| `SCHEDULER_ENABLED` | Compose-controlled | Disabled in `api`, enabled in `scheduler` |
| `TUNNEL_TOKEN` | VPS compose | Cloudflare Tunnel token |

### Web

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | No | Empty in production for same-origin proxy |
| `API_URL` | Yes | Worker runtime backend target |
| `NEXT_PUBLIC_COOKIE_NAME` | Yes | `criptenv_session` |
| `NEXT_PUBLIC_APP_URL` | Yes | Cloudflare Pages custom frontend URL |

---

## Quick Deployment Checklist

- [ ] Supabase migrations applied/confirmed.
- [x] `deploy/vps/.env` filled on the VPS.
- [x] Cloudflare Tunnel routes `criptenv-api.77mdevseven.tech` to `http://api:8000`.
- [x] Cloudflare Pages custom domain is `criptenv.77mdevseven.tech`.
- [x] `docker compose up -d --build` succeeds.
- [x] `curl http://localhost:8000/health` returns `ok` from the container/host path.
- [x] `curl https://criptenv-api.77mdevseven.tech/health` returns `ok`.
- [x] Cloudflare Pages/Workers has `API_URL=https://criptenv-api.77mdevseven.tech`.
- [x] Cloudflare Pages/Workers leaves `NEXT_PUBLIC_API_URL` empty.
- [x] `/api/health` works through the deployed frontend Worker.
- [ ] Login/signup and OAuth set HTTP-only cookies on the frontend origin.
- [ ] Vault push/pull validated through the production frontend.

---

**Document Version**: 3.0
**Last Updated**: 2026-05-10
