# Deployment — CriptEnv

## Overview

Deployment infrastructure for the CriptEnv platform across three main components.

---

## Components

| Component | Platform | Runtime |
|-----------|----------|---------|
| **Backend API** | Railway / Render | FastAPI (Python) |
| **Frontend** | Cloudflare Pages + Workers | Vinext (Node.js) |
| **Database** | PostgreSQL (managed) | PostgreSQL 14+ |

---

## Backend Deployment

### Railway (Recommended)

1. **Create new Railway project**
2. **Add PostgreSQL database**
3. **Connect repository** or deploy via CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize
railway init

# Add database
railway add --database postgresql

# Deploy
railway up
```

**Environment Variables (Railway):**

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
ASYNC_DATABASE_URL=postgresql://user:pass@host:5432/db
SECRET_KEY=<generate-secure-key>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
DEBUG=false
CORS_ORIGINS=https://your-domain.com
SCHEDULER_ENABLED=true
SCHEDULER_INTERVAL_HOURS=24
```

### Render

1. **Create Web Service**
2. **Connect GitHub repository**
3. **Set build command:** `pip install -r requirements.txt`
4. **Set start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`

**Environment Variables (Render):**

Same as Railway configuration.

### Manual Deployment

```bash
cd apps/api

# Install dependencies
pip install -r requirements.txt

# Run with gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

---

## Frontend Deployment

### Cloudflare Pages (Recommended)

1. **Connect GitHub repository** to Cloudflare Pages
2. **Set build command:** `npm run build`
3. **Set output directory:** `.next`
4. **Add environment variables**

**Environment Variables:**

```bash
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

**Build Settings:**
- Framework preset: Next.js
- Build command: `npm run build`
- Output directory: `.next`

### Manual Deployment

```bash
cd apps/web

# Build
npm run build

# Deploy .next/ directory to Cloudflare Pages
npx wrangler pages deploy .next --project-name=criptenv
```

### wrangler.jsonc Configuration

```jsonc
// apps/web/wrangler.jsonc
{
  "name": "criptenv-web",
  "compatibility_date": "2024-01-01",
  "pages": {
    "build_output_dir": ".next"
  },
  "vars": {
    "NEXT_PUBLIC_API_URL": "https://api.criptenv.com"
  }
}
```

---

## Database

### Managed PostgreSQL Options

| Provider | Free Tier | Notes |
|----------|-----------|-------|
| Railway | 500MB | Included with project |
| Render | 1GB | Free for small projects |
| Supabase | 500MB | Alternative option |
| Neon | 3GB | Modern PostgreSQL with branching |
| ElephantSQL | 20MB | Very limited free tier |

### Connection Settings

**Development:**
```bash
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/criptenv
ASYNC_DATABASE_URL=postgresql://user:password@localhost:5432/criptenv
```

**Production:**
```bash
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/prod_db
ASYNC_DATABASE_URL=postgresql://user:password@host:5432/prod_db
```

**Note:** `ASYNC_DATABASE_URL` removes the `asyncpg` prefix for native asyncpg driver compatibility.

---

## Environment Configuration

### Production Checklist

- [ ] Set `DEBUG=false`
- [ ] Use strong `SECRET_KEY` (64+ characters, randomly generated)
- [ ] Configure `CORS_ORIGINS` to specific domains (not `*`)
- [ ] Enable `SCHEDULER_ENABLED` for background jobs
- [ ] Set appropriate `ACCESS_TOKEN_EXPIRE_MINUTES` (30-60 recommended)
- [ ] Configure rate limiting (when implemented)
- [ ] Set up monitoring/logging

### Required Environment Variables

**Backend:**

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ASYNC_DATABASE_URL` | Yes | asyncpg-compatible URL |
| `SECRET_KEY` | Yes | JWT signing key |
| `ALGORITHM` | Yes | Algorithm (default: HS256) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Default: 30 |
| `DEBUG` | No | Default: false |
| `CORS_ORIGINS` | Yes | Allowed origins |
| `SCHEDULER_ENABLED` | No | Default: true |
| `SCHEDULER_INTERVAL_HOURS` | No | Default: 24 |

**Frontend:**

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |

---

## Domain Configuration

### DNS Setup

```
# A records
api.criptenv.com     → Cloudflare Pages IP
app.criptenv.com     → Cloudflare Pages IP (or CNAME to Pages)

# Or CNAME for Cloudflare Pages
www.criptenv.com     → criptenv.pages.dev
criptenv.com         → criptenv.pages.dev (redirect)
```

### SSL/TLS

- Cloudflare provides automatic SSL
- Set SSL mode to "Full" or "Flexible" depending on backend

---

## Health Checks

### Backend Health Endpoint

```
GET /health        # Basic health check
GET /health/ready  # Readiness check (database connection)
```

### Frontend Health

- Cloudflare Pages provides uptime monitoring
- Add synthetic tests for critical routes

---

## Monitoring

### Logging

**Backend:** Use structured logging with `logging` module

```python
import logging
logger = logging.getLogger(__name__)

logger.info("Action completed", extra={"user_id": user_id, "action": "secret.create"})
```

### Error Tracking (Future)

Consider adding:
- Sentry for error tracking
- DataDog for APM
- Cloudflare Analytics for frontend

---

## Deployment Commands

### Make Commands (Root Directory)

```bash
make help          # Show all commands
make api-dev       # Run API locally
make web-dev       # Run frontend locally
make build         # Build for production
make deploy        # Deploy (requires configuration)
```

### Manual Commands

```bash
# Backend
cd apps/api
uvicorn main:app --reload --port 8000

# Frontend
cd apps/web
npm run build
npm run start

# CLI (for internal use)
cd apps/cli
pip install -e .
```

---

## Rollback Procedures

### Backend

1. **Railway:** Use dashboard to select previous deployment
2. **Render:** Use dashboard to select previous deployment
3. **Manual:** Re-deploy previous version with `git checkout <tag>`

### Frontend

1. **Cloudflare Pages:** Use dashboard to select previous deployment
2. **Wrangler:** Use `npx wrangler pages deployment list` then rollback

---

## Current Deployment Status

| Component | Status | Notes |
|-----------|--------|-------|
| Backend API | ⚠️ Not configured | Needs production hosting |
| Frontend | ⚠️ Not configured | Needs Cloudflare setup |
| Database | ⚠️ Not configured | Needs managed PostgreSQL |

**Note:** The project currently runs locally. Production deployment has not been configured yet.

---

## Pending Deployment Tasks

- [ ] Configure Railway/Render for backend
- [ ] Set up Cloudflare Pages for frontend
- [ ] Configure PostgreSQL database
- [ ] Set up custom domains
- [ ] Configure SSL/TLS
- [ ] Set up monitoring
- [ ] Create deployment documentation for users

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-01