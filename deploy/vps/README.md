# VPS Deployment

This compose stack runs the CriptEnv API on a VPS behind Nginx Proxy Manager.

## Services

- `api`: public FastAPI service with Gunicorn/Uvicorn workers and Redis rate limits.
- `scheduler`: internal one-worker API process that owns APScheduler jobs.
- `redis`: ephemeral Redis for rate-limit counters only.
- `nginx-proxy-manager`: reverse proxy and Let's Encrypt certificates.
- `duckdns-updater`: keeps the DuckDNS record pointed at the VPS public IP.

## First Run

```bash
cd deploy/vps
cp .env.example .env
# edit .env with Supabase, DuckDNS, API_URL, FRONTEND_URL, and secrets
docker compose up -d --build
docker compose ps
curl http://localhost:8000/health
```

In Nginx Proxy Manager, create a proxy host:

- Domain: the `API_DUCKDNS_HOST` value.
- Scheme: `http`.
- Forward hostname: `api`.
- Forward port: `8000`.
- SSL: request a Let's Encrypt certificate and force SSL.

Keep admin port `81` bound to localhost or restrict it with the VPS firewall.
