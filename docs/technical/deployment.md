# Deployment — CriptEnv

## Current Production Stack

| Component | Platform | Runtime |
|-----------|----------|---------|
| **Frontend** | Cloudflare Pages + Workers | Vinext + Worker proxy |
| **Backend API** | VPS Docker | FastAPI + Gunicorn/Uvicorn |
| **API Tunnel** | Cloudflare Tunnel | `criptenv-api.77mdevseven.tech` -> `http://api:8000` |
| **DNS** | Cloudflare | Custom frontend/API hostnames |
| **Rate Limit Store** | VPS Docker | Redis |
| **Database** | Supabase PostgreSQL | External managed Postgres |

Render/Railway hosting configs remain as legacy rollback references. Product integrations with Render/Railway are separate from CriptEnv's own hosting.

---

## Backend Deployment

The VPS stack lives in `deploy/vps`.

```bash
cd deploy/vps
cp .env.example .env
# edit .env
docker compose up -d --build
docker compose ps
curl http://localhost:8000/health
```

Cloudflare Tunnel should route:

```text
https://criptenv-api.77mdevseven.tech -> http://api:8000
```

Cloudflare owns the public TLS certificate and forwards traffic through the outbound tunnel container.

The public API service runs multiple workers with `SCHEDULER_ENABLED=false`; the internal `scheduler` service runs one worker with `SCHEDULER_ENABLED=true`.

---

## Frontend Deployment

Cloudflare Pages remains the frontend host. Production should use the same-origin Worker proxy:

```bash
NEXT_PUBLIC_API_URL=
API_URL=https://criptenv-api.77mdevseven.tech
NEXT_PUBLIC_COOKIE_NAME=criptenv_session
NEXT_PUBLIC_APP_URL=https://criptenv.77mdevseven.tech
```

Deploy:

```bash
cd apps/web
npm run build
npm run deploy
```

---

## Database

Use the Supabase pooler URL on port `6543`:

```bash
DATABASE_URL=postgresql://postgres.[project]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

Recommended VPS defaults:

```bash
DB_POOL_SIZE=2
DB_MAX_OVERFLOW=2
DB_POOL_TIMEOUT=10
```

Apply migrations with:

```bash
cd apps/api
alembic upgrade head
```

---

## Rollback

If the VPS migration fails, redeploy the previous Render API using `apps/api/render.yaml` or `apps/api/Procfile`, then set Cloudflare Pages `API_URL` back to the Render URL. The frontend can keep using relative `/api/*` requests because the Worker target is runtime-configured.

---

## Smoke Tests

```bash
curl http://localhost:8000/health
curl http://localhost:8000/health/ready
curl https://criptenv-api.77mdevseven.tech/health
curl https://criptenv-api.77mdevseven.tech/api/health
curl https://criptenv.77mdevseven.tech/api/health
```

Then manually verify signup/signin, OAuth callback, project list, and a vault pull/push flow.

## Current Gaps

- Confirm Supabase production migrations with `alembic upgrade head`.
- Validate login/signup, OAuth callback, project list, and vault push/pull through the Workers frontend.
- Add VPS operations baseline: firewall review, OS patch cadence, tunnel monitoring, log rotation, and uptime monitoring.

---

**Document Version**: 3.0
**Last Updated**: 2026-05-10
