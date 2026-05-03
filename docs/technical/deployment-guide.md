# Deployment Guide — CriptEnv

Complete guide for deploying CriptEnv to production.

---

## Architecture Overview

```
┌─────────────┐      HTTPS       ┌─────────────┐      HTTPS       ┌─────────────┐
│   Cloudflare│ ◄──────────────► │   FastAPI   │ ◄──────────────► │  PostgreSQL  │
│  Pages +    │   NEXT_PUBLIC_   │   API       │   DATABASE_URL   │  (Render/    │
│  Workers    │   API_URL        │  (Render/   │                  │   Railway/   │
│             │                  │   Railway)  │                  │   Supabase)  │
└─────────────┘                  └─────────────┘                  └─────────────┘
```

| Component | Platform | URL Pattern |
|-----------|----------|-------------|
| **Web** | Cloudflare Pages + Workers | `https://criptenv.com` |
| **API** | Render or Railway | `https://api.criptenv.com` |
| **Database** | Render PostgreSQL or Railway Postgres or Supabase | Internal |
| **CLI** | PyPI | `pip install criptenv` |

---

## 1. Web — Cloudflare Pages + Workers

### Prerequisites

- Cloudflare account (free tier works)
- Domain configured in Cloudflare (optional, `.pages.dev` works too)
- Node.js 20+ and npm

### Step 1: Configure Environment Variables

Edit `apps/web/.env.production`:

```bash
NEXT_PUBLIC_API_URL=https://api.criptenv.com
NEXT_PUBLIC_COOKIE_NAME=criptenv_session
NEXT_PUBLIC_APP_URL=https://criptenv.com
```

### Step 2: Authenticate Wrangler

```bash
cd apps/web
npx wrangler login
```

Follow the OAuth flow in your browser.

### Step 3: Build and Deploy

```bash
cd apps/web
npm run build
npx wrangler deploy
```

Or use the Makefile from project root:

```bash
make web-deploy
```

### Cloudflare-specific Settings

1. **Pages Domain**: Add custom domain in Cloudflare Pages dashboard
2. **Environment Variables**: Set in Cloudflare Pages dashboard → Settings → Environment Variables
3. **Compatibility Date**: Set in `wrangler.jsonc` (currently `2026-04-30`)

---

## 2. API — Render

### Prerequisites

- Render account (free tier works)
- Git repository pushed to GitHub/GitLab

### Step 1: Blueprint Deploy (Recommended)

Render supports `render.yaml` blueprints.

1. Go to Render Dashboard → Blueprints
2. Connect your Git repository
3. Render will auto-detect `apps/api/render.yaml`
4. Click "Apply"

### Step 2: Manual Service Creation

1. **New Web Service** → Connect Git repo
2. **Root Directory**: `apps/api`
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT`
5. **Environment Variables**:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `SECRET_KEY`: Random 32+ char string
   - `DEBUG`: `false`
   - `CORS_ORIGINS`: `https://criptenv.com`
   - `FRONTEND_URL`: `https://criptenv.com`
   - `SCHEDULER_ENABLED`: `true`

### Step 3: Database Migration

After first deploy, run migrations:

```bash
# Via Render Shell
alembic upgrade head

# Or locally with production DATABASE_URL
cd apps/api
DATABASE_URL=postgresql+asyncpg://... alembic upgrade head
```

---

## 3. API — Railway

### Prerequisites

- Railway account (free tier available)
- Railway CLI installed: `npm install -g @railway/cli`

### Step 1: Login and Init

```bash
railway login
railway init
```

### Step 2: Add PostgreSQL Database

```bash
railway add --database postgres
```

### Step 3: Configure Environment Variables

```bash
railway variables set SECRET_KEY="your-secret-key-min-32-chars"
railway variables set DEBUG="false"
railway variables set CORS_ORIGINS="https://criptenv.com"
railway variables set FRONTEND_URL="https://criptenv.com"
railway variables set SCHEDULER_ENABLED="true"
```

### Step 4: Deploy

```bash
cd apps/api
railway up
```

### Step 5: Run Migrations

```bash
railway run alembic upgrade head
```

---

## 4. CLI — PyPI

### Prerequisites

- PyPI account
- API token from https://pypi.org/manage/account/token/

### Step 1: Build

```bash
cd apps/cli
python -m build
```

This creates:
- `dist/criptenv-0.1.0.tar.gz`
- `dist/criptenv-0.1.0-py3-none-any.whl`

### Step 2: Upload

```bash
python -m twine upload dist/* \
  --username __token__ \
  --password "$PYPI_API_TOKEN"
```

Or set `PYPI_API_TOKEN` and use the deploy script:

```bash
PYPI_API_TOKEN=pypi-xxx... ./scripts/deploy.sh cli
```

### Step 3: Verify

```bash
pip install criptenv
criptenv --version
```

---

## 5. GitHub Action — Marketplace Publishing

### Step 1: Tag Release

```bash
cd packages/github-action
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

### Step 2: Create GitHub Release

1. Go to GitHub → Releases → Draft New Release
2. Choose tag `v1.0.0`
3. Add release notes
4. **Check "Publish this Action to the GitHub Marketplace"**
5. Publish release

---

## Environment Variables Reference

### Web (`apps/web/.env.production`)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://api.criptenv.com` |
| `NEXT_PUBLIC_COOKIE_NAME` | Session cookie name | `criptenv_session` |
| `NEXT_PUBLIC_APP_URL` | Frontend URL | `https://criptenv.com` |

### API (`apps/api/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL async URL (`postgresql+asyncpg://...`) |
| `SECRET_KEY` | ✅ | Min 32 chars, used for session signing |
| `DEBUG` | ✅ | `false` in production |
| `CORS_ORIGINS` | ✅ | Comma-separated allowed origins |
| `FRONTEND_URL` | ✅ | For OAuth redirects |
| `SCHEDULER_ENABLED` | ⚠️ | `true` to enable background jobs |
| `GITHUB_CLIENT_ID` | ⚠️ | For GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | ⚠️ | For GitHub OAuth |
| `GOOGLE_CLIENT_ID` | ⚠️ | For Google OAuth |
| `GOOGLE_CLIENT_SECRET` | ⚠️ | For Google OAuth |
| `DISCORD_CLIENT_ID` | ⚠️ | For Discord OAuth |
| `DISCORD_CLIENT_SECRET` | ⚠️ | For Discord OAuth |

---

## Troubleshooting

### Web Build Fails

```bash
cd apps/web
rm -rf node_modules dist .vinext
npm install
npm run build
```

### API Import Error on Deploy

Ensure `apps/api` is the root directory for the service. The import path must be `main:app`.

### Database Connection Failed

- Verify `DATABASE_URL` uses `postgresql+asyncpg://` scheme
- Check if IP is allowlisted (Render/Railway usually handle this)
- For Supabase: use connection pooler URL for serverless environments

### CLI Upload to PyPI Fails

- Verify `PYPI_API_TOKEN` starts with `pypi-`
- Check version is unique (PyPI doesn't allow overwrites)
- Bump version in `apps/cli/pyproject.toml` if re-uploading

### Wrangler Authentication Issues

```bash
cd apps/web
npx wrangler logout
npx wrangler login
```

---

## Quick Deploy Checklist

- [ ] Web: `NEXT_PUBLIC_API_URL` points to production API
- [ ] Web: Build passes (`npm run build`)
- [ ] API: `DATABASE_URL` configured and migrations run
- [ ] API: `SECRET_KEY` is strong and unique
- [ ] API: `DEBUG=false`
- [ ] API: `CORS_ORIGINS` includes web domain
- [ ] API: OAuth credentials configured (if using OAuth)
- [ ] CLI: Version bumped in `pyproject.toml`
- [ ] CLI: Build passes (`python -m build`)
- [ ] GitHub Action: `dist/index.js` is compiled and committed

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-03
