# Deployment Guide — CriptEnv

Complete guide for deploying CriptEnv to production.

---

## Architecture Overview

```
┌─────────────┐      HTTPS       ┌─────────────┐      HTTPS       ┌─────────────┐
│   Cloudflare│ ◄──────────────► │   FastAPI   │ ◄──────────────► │  PostgreSQL  │
│  Pages +    │   NEXT_PUBLIC_   │   API       │   DATABASE_URL   │  (Supabase   │
│  Workers    │   API_URL        │  (Render    │                  │   Free Tier) │
│             │                  │   Free)     │                  │              │
└─────────────┘                  └─────────────┘                  └─────────────┘
```

| Component | Platform | URL Pattern | Cost |
|-----------|----------|-------------|------|
| **Web** | Cloudflare Pages + Workers | `https://criptenv.com` | **Free** |
| **API** | Render Free Tier | `https://api.criptenv.com` | **Free** (cold starts after 15min) |
| **Database** | Supabase Free Tier | Internal | **Free** (500MB, permanent) |
| **CLI** | PyPI | `pip install criptenv` | Free to users |

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

## 2. Database — Supabase (Free Tier)

### Prerequisites

- Supabase account (free tier is permanent and generous)

### Step 1: Create Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a region close to your Render service (e.g., US East)
3. Wait for provisioning (~2 minutes)

### Step 2: Get Connection String

1. Go to **Project Settings** → **Database**
2. Copy **Connection String** → **URI** (the pooler one, port `6543`)
   ```
   postgresql://postgres.[project]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
3. This URL already works with the API — `config.py` auto-converts `postgresql://` to `postgresql+asyncpg://` and strips Prisma-only params

### Step 3: Run Migrations

```bash
cd apps/api
# Set DATABASE_URL to your Supabase connection string
export DATABASE_URL="postgresql://postgres.xxx:xxx@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

# Run migrations
alembic upgrade head
```

> The API already configures `statement_cache_size=0` and `prepared_statement_cache_size=0` for pgbouncer compatibility.

---

## 3. API — Render (Free Tier)

### Prerequisites

- Render account (free tier)
- Git repository pushed to GitHub/GitLab
- Supabase project created (see above)

### Important Free Tier Limitations

| Limitation | Detail |
|------------|--------|
| **Cold starts** | Service sleeps after 15min of inactivity → 30-60s first request |
| **Uptime** | Not suitable for high-traffic production, perfect for MVP/demo |
| **Custom domains** | Supported on free tier |

### Step 1: Blueprint Deploy (Recommended)

Render supports `render.yaml` blueprints.

1. Go to Render Dashboard → **Blueprints**
2. Connect your Git repository
3. Render will auto-detect `apps/api/render.yaml` (configured for `plan: free`)
4. Click **Apply**

### Step 2: Set Environment Variables

After the blueprint creates the service, add these in Render Dashboard:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Supabase connection string (port 6543) |
| `SECRET_KEY` | Random 32+ char string |
| `DEBUG` | `false` |
| `CORS_ORIGINS` | `https://criptenv.com,https://*.pages.dev` |
| `FRONTEND_URL` | `https://criptenv.com` |
| `SCHEDULER_ENABLED` | `true` |

### Step 3: Manual Service Creation (Alternative)

1. **New Web Service** → Connect Git repo
2. **Root Directory**: `apps/api`
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   > Use `uvicorn` directly on free tier (lighter than gunicorn + 4 workers)
5. **Plan**: Select **Free**

---

## 4. API — Railway (Alternative to Render)

If Render's cold starts become a problem, Railway is a good upgrade path.

### Prerequisites

- Railway account
- Railway CLI: `npm install -g @railway/cli`

### Deploy

```bash
railway login
railway init
cd apps/api
railway up
```

Railway gives **$5/month credit** which often covers a small API + DB.

---

## 5. CLI — PyPI

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

## 6. GitHub Action — Marketplace Publishing

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
| `DATABASE_URL` | ✅ | Supabase connection string (port `6543` pooler) |
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

> **Supabase tip:** Use the **Connection Pooler** URL (port `6543`), not the direct connection (port `5432`). The pooler handles connection limits better for serverless environments.

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
- [ ] **Supabase**: Project created and connection string copied (port 6543)
- [ ] **Supabase**: Migrations run (`alembic upgrade head`)
- [ ] API: `DATABASE_URL` pointing to Supabase pooler
- [ ] API: `SECRET_KEY` is strong and unique
- [ ] API: `DEBUG=false`
- [ ] API: `CORS_ORIGINS` includes web domain + `.pages.dev`
- [ ] API: OAuth credentials configured (if using OAuth)
- [ ] CLI: Version bumped in `pyproject.toml`
- [ ] CLI: Build passes (`python -m build`)
- [ ] GitHub Action: `dist/index.js` is compiled and committed

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-03
