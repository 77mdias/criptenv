# Guidelines — CriptEnv

## Design Principles & Conventions

---

## 1. Zero-Cost Initial Hosting

### Philosophy

> "The best security tool is one developers actually use."

CriptEnv deve ser acessível a:
- Solo developers (free tier)
- Startups (minimal cost)
- Open source projects (zero cost)

### Infrastructure Choices

| Service | Selection | Monthly Cost |
|---------|-----------|--------------|
| **Database** | Supabase | $0 (free tier: 500MB) |
| **Backend** | Railway/Render | $0 (500 hours, sleeps) |
| **Frontend** | Cloudflare Pages + Workers (Vinext) | $0 (unlimited bandwidth) |
| **Domain** | .env.security (TBD) | $12/year |
| **CI/CD** | GitHub Actions | $0 |
| **Total** | | **~$1/month** |

### Scaling Strategy

```
Month 1-6: Free tier limits
├── Supabase: < 500MB, < 50k MAU
├── Railway: < 500 hours (sleep after 15min)
└── Cloudflare Pages + Workers: unlimited bandwidth

Month 6-12: First revenue
├── Upgrade Supabase to Pro: $25/month
├── Keep Railway/Render on free (or Pro if needed)
└── Cloudflare Pages + Workers paid features: ~$20/month

Year 2+: Enterprise/paid tiers
├── Self-hosted option
├── Premium features
└── Enterprise support
```

---

## 2. Security Transparency

### Open Source Commitment

**All security-related code is public**:
- Encryption implementation (`/src/crypto/`)
- Protocol documentation (`/docs/security/`)
- Security advisories (disclosed in GitHub)

### Security Review Process

```
1. Code Review (mandatory)
   - 2 approvals required
   - Security-focused review checklist
   - No direct commits to main

2. Automated Scanning
   - Semgrep (SAST)
   - GitHub Dependabot
   - Secret scanning on commits

3. Manual Audit (quarterly)
   - Third-party security firm
   - Bug bounty program (future)

4. Incident Response
   - Security policy document
   - 48-hour disclosure timeline
   - Public post-mortem
```

### Vulnerability Disclosure

```markdown
## Security Policy

### Reporting Vulnerabilities

We take security bugs seriously. Please report vulnerabilities responsibly.

**Private Disclosure**:
1. Email: security@criptenv.com
2. PGP Key: [public key]
3. Response: Within 48 hours
4. Fix: Within 90 days (or public disclosure)

**Public Disclosure**:
-等待 90 days after report
- Coordinate disclosure
- Credit researchers

### Known Issues

Current security considerations are documented in SECURITY.md
```

---

## 3. Developer Experience (DX) Principles

### Command-Line Interface

#### Design Rules

```
1. CONSISTENCY
   - Verb-noun pattern: set, get, list, delete, push, pull
   - Consistent flags: --env, --project, --output
   - Consistent output format

2. FEEDBACK
   - Progress indicators for long operations
   - Clear success/error messages
   - Suggested fixes on errors

3. SAFETY
   - Confirmation prompts for destructive actions
   - Dry-run options
   - Rollback capabilities

4. SPEED
   - Sub-100ms for local operations
   - Parallel network requests
   - Lazy loading of heavy modules
```

#### Output Format

```bash
# Good: Clear, actionable output
$ criptenv set API_KEY=sk_xxx
  ✓ Secret added to 'development'
  ✓ Encrypted with AES-GCM 256-bit
  ✓ Pushed to cloud (optional)

# Bad: Cryptic or missing feedback
$ criptenv set API_KEY=sk_xxx
  (no output)

# Good: Helpful error messages
$ criptenv push
  Error: Version conflict detected
  
  Your version: 41
  Server version: 42 (by @alice, 2 min ago)
  
  Resolution:
  1. Run 'criptenv pull' to merge
  2. Run 'criptenv push --force' to overwrite
  3. Run 'criptenv sync' for interactive merge
  
  Docs: https://docs.criptenv.com/conflicts

# Bad: Cryptic error
$ criptenv push
  Error: CONFLICT
```

### Color & Typography

```bash
# Use colors judiciously
GREEN="\033[0;32m"    # Success
RED="\033[0;31m"      # Error
YELLOW="\033[0;33m"   # Warning
BLUE="\033[0;34m"     # Info
CYAN="\033[0;36m"     # Debug
RESET="\033[0m"

# Status indicators
✓ (success)    ✗ (error)    ⚠ (warning)    ℹ (info)    ● (debug)
```

---

## 4. API Design Guidelines

### REST Conventions

```
Base URL: https://api.criptenv.com/api/v1

Endpoints:
GET     /projects              List projects
POST    /projects              Create project
GET     /projects/:id          Get project
PATCH   /projects/:id          Update project
DELETE  /projects/:id          Delete project

GET     /projects/:id/environments
POST    /projects/:id/environments
GET     /projects/:id/environments/:env
DELETE  /projects/:id/environments/:env

GET     /projects/:id/vault/:env      Get vault
POST    /projects/:id/vault/:env      Push vault
```

### Versioning

```
URL Versioning:
/api/v1/...    (current)
/api/v2/...    (future)

Version Headers (optional):
Accept: application/vnd.criptenv.v1+json
```

### Pagination

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 230,
    "pages": 5,
    "next": "/api/v1/projects?page=2",
    "prev": null
  }
}
```

---

## 5. Database Conventions

### Naming

```
Tables:     snake_case, plural (users, projects, vault_blobs)
Columns:    snake_case (created_at, user_id)
Functions:  snake_case (update_updated_at)
Indexes:    idx_<table>_<column> (idx_users_email)
```

### UUID Format

```sql
-- Use uuid-ossp for UUIDs
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()

-- Prefix with resource type (optional, for readability)
usr_xxx  -- User
prj_xxx  -- Project
env_xxx  -- Environment
```

### Timestamps

```sql
-- Always use timestamptz for consistency
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()

-- Automatic update trigger
CREATE TRIGGER update_updated_at
    BEFORE UPDATE ON table_name
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 6. Code Style Guidelines

### TypeScript (CLI, Frontend)

```typescript
// Use explicit types
interface Secret {
  key: string;
  value: string;
  environment: string;
  version: number;
}

// Async/await preferred over .then()
async function getSecret(key: string): Promise<string | null> {
  const vault = await loadVault();
  return vault.secrets[key] ?? null;
}

// Error handling
try {
  await pushVault();
} catch (error) {
  if (error instanceof ConflictError) {
    await handleConflict(error);
  } else {
    throw error;
  }
}
```

### Python (FastAPI Backend)

```python
# Use Pydantic for request/response
class SecretCreate(BaseModel):
    key: str
    value: str
    environment: str = "development"

# Async throughout
@app.post("/projects/{project_id}/vault/{environment}")
async def push_vault(
    project_id: UUID,
    environment: str,
    data: VaultPush,
    session: AsyncSession = Depends(get_db),
):
    # ...
    await sync_service.push(session, project_id, environment, data)

# Type hints everywhere
def encrypt_vault(plaintext: bytes, key: bytes) -> EncryptedVault:
    ...
```

---

## 7. Git Workflow

### Branch Naming

```
feature/short-description
bugfix/issue-number-short-desc
hotfix/security-vuln-fix
chore/dependency-update
docs/api-reference
```

### Commit Messages

```
feat: add GitHub Actions integration
fix: resolve vault sync conflict detection
docs: update API documentation
refactor: extract encryption module
test: add integration tests for sync
chore: upgrade dependencies
security: harden PBKDF2 parameters
```

### Pull Request Process

```
1. Fork & branch
2. Implement with tests
3. PR description template:
   - Summary
   - Motivation
   - Changes
   - Testing
   - Screenshots (if UI)
4. Code review (2 approvals)
5. CI passing
6. Squash & merge
```

---

## 8. Documentation Standards

### README Structure

```markdown
# Project Name

One-line description

## Quick Start

```bash
npm install -g @criptenv/cli
criptenv init
```

## Features

- Feature 1
- Feature 2

## Documentation

[Link to full docs]

## Contributing

[Link to CONTRIBUTING.md]

## License

MIT
```

### Inline Documentation

```typescript
/**
 * Derive a session key from a master password using PBKDF2.
 * 
 * @param password - The user's master password (never stored)
 * @param salt - Random 32-byte salt (stored per-user)
 * @returns Derived CryptoKey for AES-GCM operations
 * 
 * @throws {CryptoError} If key derivation fails
 */
async function deriveSessionKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Implementation
}
```

---

## 9. Error Handling

### User-Facing Errors

```typescript
// Good: Actionable error message
interface UserError {
  code: string;           // e.g., "CONFLICT_VERSION"
  message: string;       // e.g., "Version conflict detected"
  suggestion?: string;   // e.g., "Run 'criptenv pull' to merge"
  docs?: string;         // Link to documentation
}

// Bad: Cryptic error
throw new Error("Sync failed");
```

### Logging

```typescript
// Structured logging
console.log(JSON.stringify({
  level: "info",
  event: "secret.pushed",
  projectId: "prj_xxx",
  userId: "usr_yyy",
  durationMs: 145,
  timestamp: new Date().toISOString()
}));
```

---

## 10. Testing Standards

### Test Coverage

| Layer | Minimum Coverage |
|-------|-----------------|
| Crypto functions | 100% |
| API endpoints | 90% |
| CLI commands | 85% |
| UI components | 70% |

### Test Types

```bash
# Unit tests (fast, isolated)
npm test -- --testPathPattern=src/crypto

# Integration tests (API, database)
npm test -- --testPathPattern=src/api

# E2E tests (full flow)
npm test:e2e

# Security tests (crypto, auth)
npm test:security
```

---

## 11. Release Process

### Versioning (SemVer)

```
1.0.0  - Initial release
1.1.0  - Minor features, backwards compatible
1.0.1  - Patch, backwards compatible
2.0.0  - Breaking changes

Examples:
v1.0.0 - MVP release
v1.1.0 - Add audit logs
v1.2.0 - Add team invites
v2.0.0 - Breaking: new vault format
```

### Release Checklist

```
□ All tests passing
□ Code reviewed
□ Changelog updated
□ Version bumped
□ GitHub release created
□ npm package published
□ Docker image built
□ Announced (if major)
□ Docs updated
```

---

**Document Version**: 1.0  
**Living Document**: Update as standards evolve  
**Contributing**: See CONTRIBUTING.md for how to propose changes
