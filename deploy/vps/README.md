# VPS Deployment

This compose stack runs the CriptEnv API on a VPS and exposes it through Cloudflare Tunnel.

## Services

- `api`: FastAPI service with Gunicorn/Uvicorn workers and Redis rate limits.
- `scheduler`: internal one-worker API process that owns APScheduler jobs.
- `redis`: ephemeral Redis for rate-limit counters only.
- `cloudflare-tunnel`: outbound Cloudflare Tunnel for the public API hostname.

## Domains

- Frontend: `https://criptenv.77mdevseven.tech`
- Backend API: `https://criptenv-api.77mdevseven.tech`
- Worker runtime: `API_URL=https://criptenv-api.77mdevseven.tech`
- Browser bundle: `NEXT_PUBLIC_API_URL=` empty so browser calls stay same-origin at `/api/*`.

## First Run

```bash
cd deploy/vps
cp .env.example .env
# edit .env with Supabase, API_URL, FRONTEND_URL, CORS_ORIGINS, TUNNEL_TOKEN, and secrets
# keep SECRET_KEY and INTEGRATION_CONFIG_SECRET different and persistent
docker compose up -d --build
docker compose ps
curl http://localhost:8000/health
```

In Cloudflare Zero Trust, configure the tunnel public hostname:

```text
Hostname: criptenv-api.77mdevseven.tech
Service:  http://api:8000
```

In Cloudflare Pages/Workers, configure the frontend custom domain and runtime variables:

```bash
NEXT_PUBLIC_API_URL=
API_URL=https://criptenv-api.77mdevseven.tech
NEXT_PUBLIC_COOKIE_NAME=criptenv_session
NEXT_PUBLIC_APP_URL=https://criptenv.77mdevseven.tech
```

The backend must use the frontend domain for redirects and CORS:

```bash
API_URL=https://criptenv-api.77mdevseven.tech
FRONTEND_URL=https://criptenv.77mdevseven.tech
CORS_ORIGINS=https://criptenv.77mdevseven.tech
```

## Smoke Tests

```bash
curl https://criptenv-api.77mdevseven.tech/health
curl https://criptenv-api.77mdevseven.tech/api/health
curl https://criptenv.77mdevseven.tech/api/health
```

If local VPS health passes but the public API hostname fails, inspect the tunnel first:

```bash
docker logs --tail=100 vps-cloudflare-tunnel
docker compose ps
curl http://127.0.0.1:8000/health
```
