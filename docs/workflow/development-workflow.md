# Development Workflow — CriptEnv

## Getting Started

### Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.11+ (for backend and CLI)
- **PostgreSQL** 14+ (for local development)
- **npm** or **pnpm** (for frontend dependencies)

---

## Project Structure

```
criptenv/
├── apps/
│   ├── api/          # Python FastAPI backend
│   ├── cli/          # Python CLI application
│   └── web/          # TypeScript/Next.js frontend
├── packages/
│   └── github-action/  # GitHub Action (TypeScript)
├── docs/             # Documentation
├── plans/            # Implementation plans
├── specs/            # Technical specifications
└── prd/              # Product Requirements
```

---

## Running Locally

### Backend (FastAPI)

```bash
# Navigate to API directory
cd apps/api

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database URL and secret key

# Run the server
uvicorn main:app --reload --port 8000

# API docs available at http://localhost:8000/docs (when DEBUG=true)
```

### Frontend (Vinext/Next.js)

```bash
# Navigate to web directory
cd apps/web

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with NEXT_PUBLIC_API_URL

# Run development server
npm run dev

# Access at http://localhost:3000
```

### CLI (Local Development)

```bash
# Navigate to CLI directory
cd apps/cli

# Install in editable mode
pip install -e .

# Run CLI
criptenv --help

# Or run directly
python -m criptenv.cli --help
```

### Using Make (Root Directory)

```bash
# Show all available commands
make help

# Run specific services
make api-dev      # Backend development
make web-dev      # Frontend development
make cli-dev      # CLI development

# Run all tests
make test

# Lint code
make lint
```

---

## Running Tests

### API Tests

```bash
cd apps/api

# Run all tests
python -m pytest

# Run specific test file
python -m pytest tests/test_auth_routes.py -v

# Run tests matching a pattern
python -m pytest tests/ -v -k "test_name"
```

### CLI Tests

```bash
cd apps/cli

# Run all tests
python -m pytest

# Run with coverage
python -m pytest --cov=src/criptenv tests/

# Run specific test
python -m pytest tests/test_crypto.py -v
```

---

## Development Workflow

### 1. Creating a New Feature

1. **Create a branch**:
   ```bash
   git checkout -b feature/my-feature-name
   ```

2. **Write tests first** (TDD approach):
   - For CLI: Create test in `apps/cli/tests/`
   - For API: Create test in `apps/api/tests/`

3. **Implement the feature**:
   - Follow existing patterns in the codebase
   - Use service layer for business logic
   - Use strategy pattern for complex flows

4. **Run tests**:
   ```bash
   make test
   ```

5. **Update documentation** if needed

6. **Commit**:
   ```bash
   git add .
   git commit -m "feat: add my feature"
   ```

### 2. Bug Fixes

1. **Create a branch**:
   ```bash
   git checkout -b fix/bug-description
   ```

2. **Write a test that reproduces the bug**

3. **Fix the bug**

4. **Verify the fix passes the test**

5. **Commit with descriptive message**

### 3. Code Review

- Ensure all tests pass
- Check for linting errors: `npm run lint` (frontend), `flake8` (backend)
- Verify no secrets or sensitive data in commits
- Update CHANGELOG.md if applicable

---

## Database Management

### Running Migrations

> Note: Current project uses manual migrations (no Alembic configured).

For now, database schema changes are applied manually or through SQL scripts in `apps/api/migrations/` if created.

### Resetting Local Database

```bash
# Drop and recreate database (development only!)
psql -U postgres -c "DROP DATABASE criptenv;"
psql -U postgres -c "CREATE DATABASE criptenv;"

# Restart the API server to recreate tables
```

---

## Environment Variables

### Backend (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ASYNC_DATABASE_URL` | Yes | Same URL without asyncpg prefix |
| `SECRET_KEY` | Yes | JWT signing key (min 32 chars) |
| `ALGORITHM` | Yes | JWT algorithm (default: HS256) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Token expiration (default: 30) |
| `DEBUG` | No | Enable debug mode |
| `CORS_ORIGINS` | No | Allowed CORS origins |
| `SCHEDULER_ENABLED` | No | Enable background scheduler |
| `SCHEDULER_INTERVAL_HOURS` | No | Scheduler check interval |

### Frontend (.env.local)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |

---

## Building for Production

### Frontend

```bash
cd apps/web
npm run build
npm run start
```

Output is in `.next/` directory, ready for Cloudflare Pages deployment.

### Backend

```bash
cd apps/api
pip install -r requirements.txt
gunicorn main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

---

## Debugging

### Backend Debugging

1. Set `DEBUG=true` in `.env`
2. Use `logger.info()` / `logger.debug()` in code
3. Access logs in terminal running `uvicorn`

### CLI Debugging

1. Use `click.echo()` for output
2. Check `criptenv doctor` for diagnostic info
3. Vault is at `~/.criptenv/vault.db` (SQLite)

### Frontend Debugging

1. React DevTools browser extension
2. Network tab for API calls
3. Console logs in browser

---

## Common Issues

### "Module not found" errors

```bash
# Backend
pip install -r apps/api/requirements.txt

# Frontend
cd apps/web && npm install
```

### Database connection issues

```bash
# Check PostgreSQL is running
pg_isready

# Test connection
psql -U postgres -d criptenv
```

### Port already in use

```bash
# Find and kill process on port 8000 (backend)
lsof -ti:8000 | xargs kill -9

# Find and kill process on port 3000 (frontend)
lsof -ti:3000 | xargs kill -9
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-01