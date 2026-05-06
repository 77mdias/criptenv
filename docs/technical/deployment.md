# Deployment — CriptEnv

## Current Production Stack

| Component | Platform | Runtime |
|-----------|----------|---------|
| **Frontend** | Cloudflare Pages + Workers | Vinext + Worker proxy |
| **Backend API** | VPS Docker | FastAPI + Gunicorn/Uvicorn |
| **Reverse Proxy** | VPS Docker | Nginx Proxy Manager + Let's Encrypt |
| **DNS** | DuckDNS | Free API hostname |
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

Nginx Proxy Manager should route:

```text
https://<API_DUCKDNS_HOST> -> http://api:8000
```

Enable a Let's Encrypt certificate and Force SSL in Nginx Proxy Manager. Keep admin port `81` bound to localhost or restricted by firewall.

The public API service runs multiple workers with `SCHEDULER_ENABLED=false`; the internal `scheduler` service runs one worker with `SCHEDULER_ENABLED=true`.

---

## Frontend Deployment

Cloudflare Pages remains the frontend host. Production should use the same-origin Worker proxy:

```bash
NEXT_PUBLIC_API_URL=
API_URL=https://<API_DUCKDNS_HOST>
NEXT_PUBLIC_COOKIE_NAME=criptenv_session
NEXT_PUBLIC_APP_URL=https://<project>.pages.dev
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
curl https://<API_DUCKDNS_HOST>/health
curl https://<cloudflare-pages-host>/api/health
```

Then manually verify signup/signin, OAuth callback, project list, and a vault pull/push flow.

---

**Document Version**: 2.0
**Last Updated**: 2026-05-06
