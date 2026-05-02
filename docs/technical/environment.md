# Environment Configuration — CriptEnv

## Environment Variables

### Backend (apps/api)

**Required variables:**

```bash
# Database Connection
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/database
ASYNC_DATABASE_URL=postgresql://user:password@host:5432/database

# Authentication
SECRET_KEY=your-secret-key-at-least-32-characters-long
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Application
DEBUG=true
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

**Optional variables:**

```bash
# Scheduler (for expiration checks)
SCHEDULER_ENABLED=true
SCHEDULER_INTERVAL_HOURS=24

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_AUTH=5/minute
RATE_LIMIT_API_KEY=100/minute
RATE_LIMIT_CI_TOKEN=200/minute

# Webhook Notifications
WEBHOOK_TIMEOUT_SECONDS=30
WEBHOOK_MAX_RETRIES=3
```

**Location:** `apps/api/.env` (not committed to git)

### Frontend (apps/web)

**Required variables:**

```bash
# API Connection
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Optional variables:**

```bash
# Auth (if different from default)
NEXT_PUBLIC_COOKIE_NAME=criptenv_session
NEXT_PUBLIC_COOKIE_DOMAIN=localhost
```

**Location:** `apps/web/.env.local` (not committed to git)

### CLI

CLI uses a local vault at `~/.criptenv/vault.db`. No `.env` file needed — configuration is stored in the vault database.

**Environment variables for development:**

```bash
# When running CLI against local API
CRIPTENV_API_URL=http://localhost:8000
```

---

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Clone repository
git clone https://github.com/77mdias/criptenv.git
cd criptenv

# Backend
cd apps/api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd apps/web
npm install

# CLI
cd apps/cli
pip install -e .
```

### 2. Configure Backend

```bash
cd apps/api

# Copy example environment file
cp .env.example .env

# Edit .env with your values
nano .env

# Key settings to configure:
# - DATABASE_URL (PostgreSQL connection)
# - SECRET_KEY (generate a secure random string)
# - DEBUG (true for development)
```

### 3. Configure Frontend

```bash
cd apps/web

# Copy example environment file
cp .env.example .env.local

# Edit .env.local
nano .env.local

# Set NEXT_PUBLIC_API_URL to your backend URL
```

### 4. Database Setup

```bash
# Create PostgreSQL database
psql -U postgres -c "CREATE DATABASE criptenv;"

# Grant permissions
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE criptenv TO your_user;"

# The API will create tables on startup (if using create_all)
# Or run migrations manually
```

### 5. Run Services

```bash
# Backend (terminal 1)
cd apps/api
uvicorn main:app --reload --port 8000

# Frontend (terminal 2)
cd apps/web
npm run dev

# CLI (terminal 3)
criptenv init
criptenv login --email your@email.com
```

---

## Using Make

From the root directory:

```bash
make help          # Show all available commands
make api-dev       # Run backend development server
make web-dev       # Run frontend development server
make api-test      # Run API tests
make cli-test      # Run CLI tests
make test          # Run all tests
make lint          # Run linters
```

---

## Environment Files

### .env.example (API)

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/criptenv
ASYNC_DATABASE_URL=postgresql://user:password@localhost:5432/criptenv

# Auth
SECRET_KEY=change-this-to-a-secure-random-string-at-least-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# App
DEBUG=true
CORS_ORIGINS=http://localhost:3000

# Scheduler
SCHEDULER_ENABLED=true
SCHEDULER_INTERVAL_HOURS=24
```

### .env.example (Web)

```bash
# API
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Troubleshooting

### "Database connection refused"

1. Check PostgreSQL is running: `pg_isready`
2. Verify `DATABASE_URL` in `.env`
3. Check firewall settings

### "Module not found"

1. Backend: `pip install -r requirements.txt`
2. Frontend: `npm install`
3. CLI: `pip install -e .`

### "CORS error"

1. Check `CORS_ORIGINS` in backend `.env`
2. Ensure frontend URL is in the list
3. Check for protocol mismatch (http vs https)

### "Token expired" errors

1. Check system time is correct
2. Verify `ACCESS_TOKEN_EXPIRE_MINUTES` setting
3. Check clock skew between machines

---

## Production Environment

For production deployment:

### Backend

```bash
# Use strong SECRET_KEY
SECRET_KEY=<generate-64-char-random-string>

# Disable DEBUG
DEBUG=false

# Set specific CORS origins
CORS_ORIGINS=https://your-domain.com,https://app.your-domain.com

# Configure rate limiting
RATE_LIMIT_ENABLED=true

# Use production PostgreSQL
DATABASE_URL=postgresql://user:password@prod-host:5432/criptenv
```

### Frontend

```bash
# Production API URL
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-01