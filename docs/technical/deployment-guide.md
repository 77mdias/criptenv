# Deployment Guide — CriptEnv

Complete production deployment guide for the current stack.

---

## Architecture Overview

```
┌─────────────┐   same-origin /api   ┌─────────────┐   HTTPS/TLS   ┌─────────────┐
│ Cloudflare  │ ───────────────────► │ VPS Docker  │ ────────────► │ Supabase    │
│ Pages +     │ Worker API_URL proxy │ FastAPI API │ DATABASE_URL  │ PostgreSQL  │
│ Workers     │                      │ + Redis     │               │ Pooler      │
└─────────────┘                      └─────────────┘               └─────────────┘
                                             ▲
                                             │ DuckDNS + Nginx Proxy Manager
                                             ▼
                                  https://criptenv.duckdns.org
```

| Component | Platform | URL Pattern | Notes |
|-----------|----------|-------------|-------|
| **Web** | Cloudflare Pages + Workers | `https://criptenv.jean-carlos3.workers.dev` | Browser calls use relative `/api/*` |
| **API** | VPS Docker | `https://criptenv.duckdns.org` | Gunicorn/Uvicorn behind Nginx Proxy Manager |
| **Rate limits** | Redis on VPS | internal | Shared counters across API workers |
| **Database** | Supabase | internal | Use pooler URL on port `6543` |
| **CLI** | PyPI future | `pip install criptenv` | Not required for hosting the web/API MVP |

Render Free Tier is now a legacy rollback option for API hosting. The user-facing Render integration provider remains part of the product.

---

## 1. Web — Cloudflare Pages + Workers

### Environment

Set these in Cloudflare Pages:

```bash
NEXT_PUBLIC_API_URL=
API_URL=https://criptenv.duckdns.org
NEXT_PUBLIC_COOKIE_NAME=criptenv_session
NEXT_PUBLIC_APP_URL=https://criptenv.jean-carlos3.workers.dev
```

`NEXT_PUBLIC_API_URL` should stay empty in production so browser requests use the same-origin Worker proxy. The Worker reads `API_URL` at runtime and forwards `/api/*` to the VPS API.

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

## 3. API — VPS Docker

### Prerequisites

- VPS with Docker Engine and Docker Compose plugin.
- DuckDNS subdomain and token.
- Ports `80` and `443` open publicly.
- Port `81` restricted to localhost or trusted IPs only.

### Configure

```bash
cd deploy/vps
cp .env.example .env
```

Fill:

| Variable | Value |
|----------|-------|
| `API_DUCKDNS_HOST` | `criptenv.duckdns.org` |
| `API_URL` | `https://criptenv.duckdns.org` |
| `FRONTEND_URL` | `https://criptenv.jean-carlos3.workers.dev` |
| `CORS_ORIGINS` | `https://criptenv.jean-carlos3.workers.dev` |
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

### Nginx Proxy Manager

Open the admin UI through a trusted path, create a proxy host, then request a Let's Encrypt certificate:

```bash
ssh -L 8181:127.0.0.1:81 root@<VPS_IP>
```

Then open `http://127.0.0.1:8181` locally.

| Setting | Value |
|---------|-------|
| Domain Names | `criptenv.duckdns.org` |
| Scheme | `http` |
| Forward Hostname/IP | `api` |
| Forward Port | `8000` |
| SSL | Let's Encrypt, Force SSL enabled |

Then verify:

```bash
curl https://criptenv.duckdns.org/health
curl https://criptenv.duckdns.org/api/health
curl https://criptenv.jean-carlos3.workers.dev/api/health
```

The compose stack runs API workers with `SCHEDULER_ENABLED=false` and a separate internal `scheduler` service with one worker and `SCHEDULER_ENABLED=true`, preventing duplicate APScheduler jobs.

### DuckDNS Drift Recovery

The DuckDNS record must match the VPS public IPv4. If `curl http://127.0.0.1:8000/health` works on the VPS, but public requests to `https://criptenv.duckdns.org` time out, compare both values from the VPS:

```bash
curl -4 https://api.ipify.org
dig +short criptenv.duckdns.org
```

If they differ, the domain is pointing to the wrong IP. Force an update from the updater container:

```bash
docker exec vps-duckdns-updater-1 sh -c '
IP=$(wget -qO- https://api4.ipify.org)
wget -qO- "https://www.duckdns.org/update?domains=$DUCKDNS_SUBDOMAIN&token=$DUCKDNS_TOKEN&ip=$IP&verbose=true"
'
```

Then re-check:

```bash
dig +short @1.1.1.1 criptenv.duckdns.org
curl -4vk https://criptenv.duckdns.org/health
curl -4vk https://criptenv.duckdns.org/api/health
```

The VPS compose updater sends the detected IPv4 explicitly to DuckDNS instead of relying on DuckDNS to infer the IP from the request source. If the VPS has a fixed public IP, set `DUCKDNS_FORCE_IP` in `deploy/vps/.env`. If the record flips back to another address, look for a second DuckDNS updater using the same subdomain/token.

---

## 4. Render Rollback

`apps/api/render.yaml`, `apps/api/Procfile`, and `apps/api/railway.toml` are retained as rollback/legacy references. If the VPS has an outage during migration, redeploying the previous Render service is acceptable after updating Cloudflare Pages `API_URL` back to the Render API URL.

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
| `API_URL` | Yes | Public DuckDNS API URL |
| `FRONTEND_URL` | Yes | Cloudflare Pages frontend URL |
| `CORS_ORIGINS` | Yes | Allowed frontend origins |
| `RATE_LIMIT_STORAGE` | Yes | `redis` for VPS production |
| `REDIS_URL` | Yes when Redis enabled | `redis://redis:6379/0` |
| `WEB_CONCURRENCY` | VPS compose | API worker count |
| `SCHEDULER_ENABLED` | Compose-controlled | Disabled in `api`, enabled in `scheduler` |
| `DUCKDNS_SUBDOMAIN` | VPS compose | DuckDNS subdomain without `.duckdns.org` |
| `DUCKDNS_TOKEN` | VPS compose | DuckDNS update token |
| `DUCKDNS_FORCE_IP` | No | Optional static public IPv4 override for DuckDNS updates |
| `DUCKDNS_UPDATE_SECONDS` | VPS compose | DuckDNS update interval |

### Web

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | No | Empty in production for same-origin proxy |
| `API_URL` | Yes | Worker runtime backend target |
| `NEXT_PUBLIC_COOKIE_NAME` | Yes | `criptenv_session` |
| `NEXT_PUBLIC_APP_URL` | Yes | Cloudflare Pages URL |

---

## Quick Deployment Checklist

- [ ] Supabase migrations applied/confirmed.
- [x] `deploy/vps/.env` filled on the VPS.
- [x] `docker compose up -d --build` succeeds.
- [x] `curl http://localhost:8000/health` returns `ok` from the container/host path.
- [x] Nginx Proxy Manager proxy host forwards to `api:8000`.
- [x] Let's Encrypt certificate is issued and Force SSL is enabled.
- [x] `curl -4 https://api.ipify.org` matches `dig +short criptenv.duckdns.org`.
- [x] `curl https://criptenv.duckdns.org/health` returns `ok`.
- [x] Cloudflare Pages/Workers has `API_URL=https://criptenv.duckdns.org`.
- [x] Cloudflare Pages/Workers leaves `NEXT_PUBLIC_API_URL` empty.
- [x] `/api/health` works through the deployed frontend Worker.
- [ ] Login/signup and OAuth set HTTP-only cookies on the frontend origin.
- [ ] Vault push/pull validated through the production frontend.

---

**Document Version**: 2.2
**Last Updated**: 2026-05-10
