# Contributing to CriptEnv

Thank you for your interest in contributing to CriptEnv! This document provides guidelines and instructions for contributing to our Zero-Knowledge secret management platform.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Getting Started

### Prerequisites

- Python 3.11+ (backend & CLI)
- Node.js 20+ (frontend & GitHub Action)
- PostgreSQL 14+ (or Docker)
- Redis (for production-like local setup)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/77mdias/criptenv.git
cd criptenv

# Install all dependencies (web + api + cli)
make install

# Run all tests
make test

# Run full check (lint, build, tests)
make check
```

### App-Specific Setup

**Backend (API):**
```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**CLI:**
```bash
cd apps/cli
pip install -e ".[dev]"
python -m pytest tests -q
```

**Frontend (Web):**
```bash
cd apps/web
npm install
npm run dev
```

**GitHub Action:**
```bash
cd packages/github-action
npm install
npm run build
```

## Project Structure

```
criptenv/
├── apps/
│   ├── api/                  # FastAPI Backend (Python)
│   │   ├── app/
│   │   │   ├── routers/      # API route handlers
│   │   │   ├── services/     # Business logic
│   │   │   ├── models/       # SQLAlchemy ORM models
│   │   │   ├── schemas/      # Pydantic schemas
│   │   │   ├── middleware/   # Auth, rate limit, CORS
│   │   │   └── strategies/   # Access control, integrations
│   │   ├── migrations/       # Alembic migrations
│   │   └── tests/            # pytest suite
│   ├── cli/                  # Python CLI Application
│   │   ├── src/criptenv/
│   │   │   ├── commands/     # CLI commands
│   │   │   ├── crypto/       # AES-256-GCM encryption
│   │   │   ├── vault/        # Local SQLite persistence
│   │   │   └── api/          # HTTP client
│   │   └── tests/            # pytest suite
│   └── web/                  # Web Dashboard (TypeScript/Vinext)
│       ├── src/app/          # App Router pages
│       ├── src/components/   # React components
│       ├── src/lib/api/      # API client modules
│       ├── src/stores/       # Zustand stores
│       └── tests/            # Jest + Cypress tests
├── packages/
│   └── github-action/        # TypeScript GitHub Action
├── docs/                     # Documentation
│   ├── project/              # Overview, architecture, decisions
│   ├── technical/            # API, database, deployment
│   ├── features/             # Feature tracking
│   ├── workflow/             # Development workflows
│   └── development/          # CHANGELOG
├── deploy/
│   └── vps/                  # Docker Compose production stack
├── plans/                    # Implementation plans
├── specs/                    # Technical specifications
├── Makefile                  # Build orchestration
└── README.md
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/short-description
# or
git checkout -b bugfix/issue-number
# or
git checkout -b chore/dependency-update
```

### 2. Make Changes

- Write code following our style guidelines
- Add/update tests
- Update documentation if needed
- Follow the conventions in [`AGENTS.md`](AGENTS.md)

### 3. Commit

We use **Conventional Commits**:

```bash
git commit -m "feat(cli): add import command for .env files"
git commit -m "fix(api): resolve session race condition"
git commit -m "docs: update deployment guide"
git commit -m "refactor(web): simplify secrets table component"
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation changes
- `style` — Formatting, no code change
- `refactor` — Code restructuring
- `test` — Adding or updating tests
- `chore` — Maintenance tasks
- `security` — Security-related changes

**Format:**
```
type(scope): subject

<body>

<footer>
```

**Example:**
```
feat(api): add webhook notification service

Implements async webhook delivery with exponential backoff.
Supports HMAC-SHA256 signature verification.

Closes #123
```

### 4. Push & Create PR

```bash
git push origin feature/short-description
```

Then open a Pull Request on GitHub.

## Pull Request Process

1. **Fill out the PR template** completely
2. **Pass all CI checks** (tests, linting, type checking)
3. **Get 2 approvals** from maintainers
4. **Squash and merge** your commits

### PR Template

```markdown
## Summary
Brief description of changes

## Motivation
Why is this change needed?

## Changes
- Change 1
- Change 2

## Testing
How was this tested?

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console.log or debug code left behind
- [ ] Security considerations addressed
- [ ] No plaintext secrets in logs or error messages
```

## Adding New Features

### New CLI Command

1. Create command file in `apps/cli/src/criptenv/commands/`
2. Import in `apps/cli/src/criptenv/cli.py`
3. Add to `__all__` in commands `__init__.py`
4. Write tests in `apps/cli/tests/`

### New API Endpoint

1. Add router in `apps/api/app/routers/`
2. Add service method in `apps/api/app/services/`
3. Add schema in `apps/api/app/schemas/`
4. Write tests in `apps/api/tests/`

### New Frontend Page

1. Create in `apps/web/src/app/(dashboard)/` or appropriate route group
2. Add navigation link in sidebar/top-nav
3. Add API calls in `apps/web/src/lib/api/`
4. Add tests if applicable

## Testing Guidelines

| Layer | Framework | Minimum Coverage |
|-------|-----------|-----------------|
| Crypto functions | pytest | 100% |
| API endpoints | pytest | 90% |
| CLI commands | pytest | 85% |
| UI components | vitest | 70% |

Run tests before submitting a PR:

```bash
make api-test       # Backend tests
make cli-test       # CLI tests
make web-test-unit  # Frontend unit tests
make web-test-e2e   # Full E2E suite
```

## Security Contributions

### Reporting Vulnerabilities

Please report security vulnerabilities responsibly:

1. **Email**: security@criptenv.com
2. **Response**: Within 48 hours
3. **Disclosure**: After 90 days or fix deployment

### Security-Sensitive Changes

For cryptographic or authentication changes:

1. Discuss with maintainers first
2. Provide threat model analysis
3. Get security review approval
4. Document security properties

### Security Rules

- Never commit `.env` files or credentials
- Never persist crypto keys to localStorage
- Do not weaken encryption parameters (iterations, key sizes)
- Verify no plaintext secrets in logs or error messages

## Code Style

### Python (Backend + CLI)
- Type hints everywhere
- Async throughout the backend
- Service layer: all DB mutations go through service classes
- Use dependency injection with `get_db()`

### TypeScript (Frontend)
- Path alias `@/*` maps to `./src/*`
- Separate client state (Zustand) from server state (React Query)
- Crypto store is **never persisted**
- Use dynamic imports with `ssr: false` for animation libraries (GSAP, Three.js)

## Documentation

When making changes, update relevant documentation:

- `docs/development/CHANGELOG.md` — version history
- `docs/project/decisions.md` — technical decisions (ADR format)
- `docs/technical/*.md` — technical docs as needed
- `README.md` — if changing major features or setup

## Questions?

- **Docs**: See [`docs/index.md`](docs/index.md)
- **Issues**: https://github.com/77mdias/criptenv/issues
- **Discussions**: https://github.com/77mdias/criptenv/discussions

---

Thank you for contributing to CriptEnv! 🔐
