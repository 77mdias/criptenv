# Session Compact — VPS Backend Migration

**Date:** 2026-05-06
**Status:** Backend VPS smoke validated; app-level flow validation pending.

## Current Architecture

- Frontend: `https://criptenv.jean-carlos3.workers.dev`
- Backend API: `https://criptenv.duckdns.org`
- Frontend browser calls stay same-origin at `/api/*`.
- Cloudflare Worker runtime forwards `/api/*` to `API_URL=https://criptenv.duckdns.org`.
- VPS stack: Docker Compose with `api`, `scheduler`, `redis`, `nginx-proxy-manager`, and `duckdns-updater`.
- Database: external Supabase PostgreSQL pooler.
- Render/Railway hosting files remain rollback references only; RenderProvider remains a product integration.

## Validated

```bash
curl https://criptenv.duckdns.org/health
curl https://criptenv.duckdns.org/api/health
curl https://criptenv.jean-carlos3.workers.dev/api/health
```

All three returned successfully during the session.

## Important Implementation Notes

- `/api/health` and `/api/health/ready` exist in the backend specifically for the Worker `/api/*` proxy.
- `NEXT_PUBLIC_API_URL` should stay empty in Cloudflare production.
- `FRONTEND_URL` and `CORS_ORIGINS` should use the exact Workers URL, not a wildcard.
- Public API workers run with `SCHEDULER_ENABLED=false`; the dedicated `scheduler` service runs with `SCHEDULER_ENABLED=true`.
- Nginx Proxy Manager admin stays bound to localhost and should be accessed through SSH port forwarding:

```bash
ssh -L 8181:127.0.0.1:81 root@<VPS_IP>
```

## Remaining Gaps

- Confirm Supabase production migrations with `alembic upgrade head`.
- Validate login/signup, OAuth callback, project list, and vault push/pull through the production frontend.
- Add VPS operational baseline: firewall review, OS patch routine, NPM volume backups, log rotation, and uptime monitoring.
- Continue Phase 3 product gaps: Integration Config Encryption, RailwayProvider, and Web Alert UI.
