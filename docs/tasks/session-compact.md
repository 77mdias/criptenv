# Session Compact — VPS Backend Migration

**Date:** 2026-05-06
**Status:** Backend VPS smoke and app-level flows validated; TASK-068 implemented locally and pending production migration.

## Current Architecture

- Frontend: `https://criptenv.77mdevseven.tech`
- Backend API: `https://criptenv-api.77mdevseven.tech`
- Frontend browser calls stay same-origin at `/api/*`.
- Cloudflare Worker runtime forwards `/api/*` to `API_URL=https://criptenv-api.77mdevseven.tech`.
- VPS stack: Docker Compose with `api`, `scheduler`, `redis`, and `cloudflare-tunnel`.
- Database: external Supabase PostgreSQL pooler.
- Render/Railway hosting files remain rollback references only; RenderProvider remains a product integration.

## Validated

```bash
curl https://criptenv-api.77mdevseven.tech/health
curl https://criptenv-api.77mdevseven.tech/api/health
curl https://criptenv.77mdevseven.tech/api/health
```

All three returned successfully during the session.

## Important Implementation Notes

- `/api/health` and `/api/health/ready` exist in the backend specifically for the Worker `/api/*` proxy.
- `NEXT_PUBLIC_API_URL` should stay empty in Cloudflare production.
- `FRONTEND_URL` and `CORS_ORIGINS` should use the exact frontend custom domain, not a wildcard.
- Public API workers run with `SCHEDULER_ENABLED=false`; the dedicated `scheduler` service runs with `SCHEDULER_ENABLED=true`.
- `integrations.config` is encrypted at rest with `INTEGRATION_CONFIG_SECRET`; set this value before running the TASK-068 migration in production.
- Cloudflare Tunnel should route `criptenv-api.77mdevseven.tech` to `http://api:8000`.

## Remaining Gaps

- Configure `INTEGRATION_CONFIG_SECRET` on the VPS and run `alembic upgrade head` against Supabase production.
- Add VPS operational baseline: firewall review, OS patch routine, tunnel monitoring, log rotation, and uptime monitoring.
- Continue Phase 3 product gaps: RailwayProvider and Web Alert UI.
