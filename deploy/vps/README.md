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
# keep SECRET_KEY and INTEGRATION_CONFIG_SECRET different and persistent
docker compose up -d --build
docker compose ps
curl http://localhost:8000/health
```

Current production values:

- API: `https://criptenv.duckdns.org`
- Frontend: `https://criptenv.jean-carlos3.workers.dev`
- Worker runtime: `API_URL=https://criptenv.duckdns.org`
- Browser bundle: `NEXT_PUBLIC_API_URL=` empty

In Nginx Proxy Manager, create a proxy host:

- Domain: the `API_DUCKDNS_HOST` value.
- Scheme: `http`.
- Forward hostname: `api`.
- Forward port: `8000`.
- SSL: request a Let's Encrypt certificate and force SSL.

Keep admin port `81` bound to localhost or restrict it with the VPS firewall. The recommended access path is:

```bash
ssh -L 8181:127.0.0.1:81 root@<VPS_IP>
```

Then open `http://127.0.0.1:8181` locally.

## Smoke Tests

```bash
curl https://criptenv.duckdns.org/health
curl https://criptenv.duckdns.org/api/health
curl https://criptenv.jean-carlos3.workers.dev/api/health
```

## DuckDNS Drift Runbook

If the API is healthy inside the VPS but `https://criptenv.duckdns.org` times
out publicly, first compare the VPS public IPv4 with the DuckDNS A record:

```bash
curl -4 https://api.ipify.org
dig +short criptenv.duckdns.org
```

Those values must match. A mismatch means traffic is going to the wrong host,
even if Docker, Nginx Proxy Manager, and FastAPI are all healthy.

Confirm local service health on the VPS:

```bash
curl http://127.0.0.1:8000/health
curl -vk --resolve criptenv.duckdns.org:443:127.0.0.1 \
  https://criptenv.duckdns.org/health
```

Force a DuckDNS update from the updater container:

```bash
docker exec vps-duckdns-updater-1 sh -c '
IP=$(wget -qO- https://api4.ipify.org)
wget -qO- "https://www.duckdns.org/update?domains=$DUCKDNS_SUBDOMAIN&token=$DUCKDNS_TOKEN&ip=$IP&verbose=true"
'
```

The compose updater sends the detected IPv4 explicitly to DuckDNS. If the VPS
has a fixed public IP, set `DUCKDNS_FORCE_IP` in `deploy/vps/.env` to avoid
runtime IP detection entirely.

If the record flips back to another IP, search for another DuckDNS updater using
the same subdomain/token. Two updaters competing for `criptenv` will make the
domain unstable.
