# User Stories — CriptEnv

## Developer Journey Maps

---

## Epic 1: Secret Management

### US-001: First-Time Setup

```
Story: As a new developer, I want to install and configure CriptEnv in under 5 minutes, so I can start managing my secrets without reading extensive documentation.

Priority: P0 (Must Have)
Points: 5
```

**Acceptance Criteria**:
- [ ] `npm install -g @criptenv/cli` completes in < 30s
- [ ] `criptenv init` prompts for project name and creates local vault
- [ ] `criptenv set KEY=value` works without errors
- [ ] `criptenv list` shows added keys (masked values)
- [ ] Total first-time setup < 5 minutes

**CLI Flow**:
```bash
$ npm install -g @criptenv/cli
$ criptenv init
  ? Project name: my-api
  ? Master password: ********
  ? Confirm password: ********
  ✓ Vault created at ~/.criptenv/projects/my-api/
  ✓ Encryption keys generated

$ criptenv set DATABASE_URL=postgres://localhost:5432/mydb
  ✓ Secret added to development environment

$ criptenv list
  ENVIRONMENT     KEY            UPDATED
  development     DATABASE_URL   just now
```

---

### US-002: Import Existing .env File

```
Story: As a developer with an existing .env file, I want to import it into CriptEnv with one command, so I can migrate to secure secret management without retyping everything.

Priority: P0
Points: 3
```

**Acceptance Criteria**:
- [ ] `criptenv import .env` parses standard .env format
- [ ] Comments (#) are preserved or optionally stripped
- [ ] Quoted values handled correctly
- [ ] Duplicate key warning shown
- [ ] Confirmation prompt before overwriting existing secrets

**CLI Flow**:
```bash
$ criptenv import .env
  Found 15 secrets in .env
  
  DATABASE_URL=postgres://...
  API_KEY=sk_live_xxx...
  STRIPE_KEY=sk_live_xxx...
  ...
  
  ? Import 15 secrets to 'development' environment? (Y/n) y
  ✓ 15 secrets imported and encrypted
  ✓ .env file NOT modified (secure!)
```

---

### US-003: Secure Team Sharing

```
Story: As a developer, I want to push my local secrets to the cloud so my team members can pull them, without any of us ever seeing secrets in plain text.

Priority: P0
Points: 8
```

**Acceptance Criteria**:
- [ ] `criptenv push` encrypts all secrets before upload
- [ ] Push fails if any team member is offline > 7 days (warning)
- [ ] Team members receive notification on push
- [ ] `criptenv pull` merges remote secrets with local
- [ ] No plain-text secrets ever transmitted or stored

**Happy Path**:
```bash
$ criptenv push
  Encrypting 15 secrets with AES-GCM 256-bit... ✓
  Uploading to Supabase... ✓
  Broadcast to team via Realtime... ✓
  
  ✓ Pushed successfully
  ✓ Version 42
  
  Team notified:
  - @alice ✓ (online)
  - @bob ✓ (online)
  - @charlie will sync on next pull
```

**Conflict Scenario**:
```bash
$ criptenv push
  ⚠️ Version conflict detected!
  
  Your version: 41
  Server version: 42 (by @alice, 2 min ago)
  
  ? Resolve conflict:
    [1] Keep my changes (overwrite server)
    [2] Keep server changes (discard local)
    [3] Merge both (manual)
    
$ criptenv sync
  Opening merge editor...
  
  ┌─────────────────────────────────────────────────────┐
  │ CONFLICT: STRIPE_KEY                                │
  ├─────────────────────────────────────────────────────┤
  │ LOCAL:    sk_live_xxx...local                       │
  │ REMOTE:   sk_live_xxx...remote                      │
  │                                                     │
  │ [Keep Local] [Keep Remote] [Enter new value]       │
  └─────────────────────────────────────────────────────┘
```

---

### US-004: Environment Differentiation

```
Story: As a developer, I want to manage secrets for different environments (dev, staging, prod), so I can have separate configurations without accidentally using production credentials in development.

Priority: P0
Points: 5
```

**Acceptance Criteria**:
- [ ] Default environments created on project init (dev, staging, prod)
- [ ] `criptenv set KEY=value --env=production` sets production secret
- [ ] `criptenv env switch staging` changes active environment
- [ ] `criptenv env diff dev prod` shows differences between envs
- [ ] Production secrets require confirmation to modify

**CLI Flow**:
```bash
$ criptenv env list
  ENVIRONMENT    SECRETS   DEFAULT
  development     12        ✓
  staging         15
  production      18

$ criptenv set DEBUG=true --env=development
$ criptenv set DEBUG=false --env=production

$ criptenv env diff dev prod
  ┌─────────────────────────────────────────────────────┐
  │ KEY           │ development │ production            │
  ├─────────────────────────────────────────────────────┤
  │ DEBUG         │ true        │ false                 │
  │ DATABASE_URL  │ postgres:// │ postgres://prod...     │
  └─────────────────────────────────────────────────────┘

$ criptenv set DATABASE_URL=postgres://... --env=production
  ⚠️  WARNING: Modifying production secrets!
  
  ? Type 'confirm' to proceed: confirm
  ✓ Secret updated in production
```

---

### US-005: Secret Retrieval for Development

```
Story: As a developer, I want to quickly access a secret value, so I can use it in my local development workflow without compromising security.

Priority: P1
Points: 3
```

**Acceptance Criteria**:
- [ ] `criptenv get API_KEY` copies to clipboard (not stdout)
- [ ] `criptenv export` generates .env file for shell sourcing
- [ ] Secrets auto-loaded in shell via integration
- [ ] `criptenv doctor` reports any security warnings

**CLI Flow**:
```bash
$ criptenv get STRIPE_KEY
  ✓ Copied to clipboard (auto-clears in 30s)

$ source <(criptenv export)
  Loading 12 secrets into environment...
  ✓ Exported to .env
  
$ eval "$(criptenv env --shell bash)"

$ criptenv doctor
  Checking vault integrity...
  ✓ Encryption: AES-GCM 256-bit OK
  ✓ Local vault: 12 secrets OK
  ✓ Remote sync: 2 team members OK
  ⚠️  Secret 'API_KEY' not updated in 90 days
  ✓ No .env files in git index
```

---

### US-006: Offline Access

```
Story: As a developer working on a plane/internet-free zone, I want to access my secrets, so I can continue working without connectivity.

Priority: P1
Points: 5
```

**Acceptance Criteria**:
- [ ] Local vault accessible without network
- [ ] `criptenv push` queues changes for later sync
- [ ] `criptenv pull --offline` uses cached version
- [ ] Conflict resolution deferred until online
- [ ] Clear indicator when vault is offline-only

**CLI Flow**:
```bash
$ criptenv status
  ┌─────────────────────────────────────────────────────┐
  │ CriptEnv Vault Status                               │
  │ Project: my-api (online)                           │
  ├─────────────────────────────────────────────────────┤
  │ Local:     v43 (synced 5 min ago)                  │
  │ Remote:    v43 (synced 5 min ago)                  │
  │ Status:    ✓ In sync                               │
  └─────────────────────────────────────────────────────┘

$ airplane mode on

$ criptenv push
  ⚠️  Offline - changes queued
  
  Changes queued for sync:
  - STRIPE_KEY (modified)
  - DEBUG (modified)
  
  Will sync automatically when online.

$ criptenv get API_KEY
  ✓ Retrieved from local cache
  ✓ Working offline
```

---

## Epic 2: Team Collaboration

### US-007: Team Onboarding

```
Story: As a team lead, I want to invite a developer to my project, so they can securely access shared secrets within minutes.

Priority: P0
Points: 5
```

**Acceptance Criteria**:
- [ ] Project owner can invite via email
- [ ] Invitee receives secure link with token
- [ ] Invitation expires after 7 days
- [ ] Invited user gets pre-generated wrapped DEK
- [ ] First pull downloads and decrypts team secrets

**CLI Flow (Owner)**:
```bash
$ criptenv invite alice@example.com --role=developer
  ✓ Invitation sent to alice@example.com
  ✓ Link expires in 7 days
  ✓ Role: developer (can read/write secrets)
  
  Team members (3):
  - you (owner)
  - alice@example.com (pending)
  - bob@example.com (developer)
```

**CLI Flow (Invitee)**:
```bash
$ criptenv login
$ criptenv invite accept --project=my-api
  ✓ Joined project 'my-api' as developer
  ✓ Received encrypted vault access
  ✓ Pulling secrets...
  
  Downloading 15 secrets...
  Decrypting with your master password...
  ✓ Vault ready
  
$ criptenv list
  ENVIRONMENT     KEY            TEAM VERSION
  development     DATABASE_URL   alice (2h ago)
  development     API_KEY        bob (5h ago)
```

---

### US-008: Role-Based Access Control

```
Story: As a project owner, I want to control who can view or modify secrets, so I can enforce security policies (e.g., junior devs can't touch production).

Priority: P1
Points: 8
```

**Acceptance Criteria**:
- [ ] Roles: owner, admin, developer, viewer
- [ ] Viewers can see masked secret names but not values
- [ ] Developers can modify secrets in non-production envs
- [ ] Production changes require admin/owner approval
- [ ] All permission changes logged in audit trail

**CLI Flow**:
```bash
$ criptenv team roles
  Team: my-api
  
  ROLE        │ CAN DO
  ────────────┼────────────────────────────────────
  owner       │ Everything + delete project
  admin       │ Manage members + all envs
  developer   │ Dev/staging secrets only
  viewer      │ Read masked names only
  
  Members:
  - you (owner)
  - alice@example.com (admin)
  - bob@example.com (developer)
  - charlie@example.com (viewer)

$ criptenv team add charlie@example.com --role=viewer
  ✓ charlie@example.com added as viewer
  
$ criptenv set API_KEY=xxx --env=production
  ✓ Secret updated (required admin role: alice)
  
$ criptenv team modify bob --role=developer
  ✓ Bob promoted to developer
  ✓ Bob can now modify dev/staging secrets
```

---

### US-009: Audit Trail Visibility

```
Story: As a security-conscious developer, I want to see who accessed what secrets and when, so I can detect and investigate potential security incidents.

Priority: P1
Points: 5
```

**Acceptance Criteria**:
- [ ] All secret operations logged with user, timestamp, IP
- [ ] `criptenv audit` shows recent activity
- [ ] Filter by user, action, date range
- [ ] Export audit logs to JSON for SIEM integration
- [ ] Suspicious activity alerts (optional email)

**CLI Flow**:
```bash
$ criptenv audit
  Recent activity for 'my-api':
  
  2024-01-15 10:30:05  @alice      secret.updated    STRIPE_KEY
  2024-01-15 10:28:00  @bob        secret.viewed     DATABASE_URL
  2024-01-15 09:15:33  @alice      vault.pushed      (15 secrets)
  2024-01-15 09:00:00  @charlie    member.joined     viewer
  2024-01-14 18:45:12  @you        vault.pushed      (2 secrets)

$ criptenv audit --filter=user=alice --days=7
  2024-01-15 10:30:05  @alice      secret.updated    STRIPE_KEY
  2024-01-15 09:15:33  @alice      vault.pushed      (15 secrets)
  2024-01-12 14:22:11  @alice      env.created       preview

$ criptenv audit --export=audit-2024-01.json
  ✓ Exported 47 events to audit-2024-01.json
```

---

## Epic 3: CI/CD Integration

### US-010: GitHub Actions Integration

```
Story: As a DevOps engineer, I want my GitHub Actions pipeline to securely fetch secrets from CriptEnv, so I don't have to manually configure GitHub Secrets.

Priority: P0
Points: 8
```

**Acceptance Criteria**:
- [ ] Official `@criptenv/action` available on GitHub Marketplace
- [ ] `criptenv-action` fetches secrets with CI token
- [ ] Secrets available as environment variables in steps
- [ ] No secrets logged in CI output
- [ ] Works with `pull_request` and `push` triggers

**GitHub Workflow**:
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install CriptEnv
        uses: criptenv/action@v1
        with:
          token: ${{ secrets.CRIPTENV_TOKEN }}
          environment: production
          export-env: true
      
      - name: Run migrations
        run: npm run migrate
        env:
          DATABASE_URL: ${{ env.DATABASE_URL }}
      
      - name: Deploy
        run: npm run deploy
        env:
          API_KEY: ${{ env.API_KEY }}
          STRIPE_KEY: ${{ env.STRIPE_KEY }}
```

**CLI Setup**:
```bash
$ criptenv ci-token create "GitHub Actions - Deploy"
  ✓ Token created: ctv_xxx...secret
  
  ⚠️  Save this token now! It won't be shown again.
  
$ gh secret set CRIPTENV_TOKEN --body="ctv_xxx...secret"
  ✓ Secret saved to my-api/repo
```

---

### US-011: Pull Request Preview Secrets

```
Story: As a developer, I want PR preview environments to automatically get their secrets, so previews work without manual secret configuration.

Priority: P2
Points: 5
```

**Acceptance Criteria**:
- [ ] Vercel/Railway preview deployments auto-fetch secrets
- [ ] PR number used as environment suffix
- [ ] Secrets merged from base + PR-specific overrides
- [ ] Preview envs auto-cleaned on PR close

**CLI Flow**:
```bash
$ criptenv vercel link
  ? Select Vercel project: my-api
  ✓ Linked to Vercel project
  
$ criptenv env create preview --template=production
  ✓ Preview environment created

$ git push --feature/new-login
  Vercel: Creating preview deployment...
  Vercel: Fetching secrets from CriptEnv...
  ✓ Preview URL: https://my-api-git-feature-login-abc123.vercel.app
  
  Secrets used:
  - DATABASE_URL: production (base)
  - API_URL: https://feature-login.preview.example.com
```

---

## Epic 4: Security & Compliance

### US-012: Secret Expiration Alerts

```
Story: As a security team, I want to be notified when secrets haven't been rotated in X days, so I can enforce secret rotation policies.

Priority: P2
Points: 5
```

**Acceptance Criteria**:
- [ ] Project owner sets rotation policy (30/60/90 days)
- [ ] Dashboard shows "stale" secrets with warning
- [ ] Email notification when secret exceeds policy
- [ ] `criptenv rotate` command guides rotation
- [ ] Rotation logs maintained for compliance

**CLI Flow**:
```bash
$ criptenv policy set --rotation=90days
  ✓ Rotation policy set to 90 days
  
$ criptenv policy status
  ┌─────────────────────────────────────────────────────┐
  │ Rotation Policy: 90 days                             │
  ├─────────────────────────────────────────────────────┤
  │ SECRET        │ LAST ROTATED │ STATUS                │
  │ API_KEY       │ 45 days ago  │ ✓ OK                  │
  │ STRIPE_KEY    │ 120 days ago │ ⚠️ EXCEEDED           │
  │ DATABASE_URL  │ 10 days ago  │ ✓ OK                  │
  └─────────────────────────────────────────────────────┘

$ criptenv rotate STRIPE_KEY
  Generating new secret...
  ? Enter new value: sk_live_xxx...new
  ✓ Secret rotated
  ✓ Team notified
  ✓ Audit logged
```

---

### US-013: Two-Factor Authentication

```
Story: As a security-conscious user, I want to enable 2FA on my account, so even if my password is compromised, attackers can't access my secrets.

Priority: P1
Points: 5
```

**Acceptance Criteria**:
- [ ] TOTP-based 2FA via Google Authenticator/Authy
- [ ] 2FA required for: login, pushing secrets, deleting project
- [ ] Recovery codes generated and downloadable
- [ ] 2FA bypass code for account recovery (owner-only)

**CLI Flow**:
```bash
$ criptenv security 2fa enable
  Setting up Two-Factor Authentication...
  
  1. Scan this QR code with your authenticator app:
  
  ┌─────────────────────────────┐
  │  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄   │
  │  ▄▄  ▄▄▄▄  ▄▄  ▄▄▄▄  ▄▄▄   │
  │  ▄▄▄▄  ▄▄  ▄▄▄▄  ▄▄  ▄▄▄   │
  │  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄   │
  └─────────────────────────────┘
  
  2. Enter verification code: 123456
  
  ✓ 2FA enabled successfully
  
  ⚠️  Save these recovery codes (store securely):
  rc_abc123, rc_def456, rc_ghi789, rc_jkl012

$ criptenv login
  Email: you@example.com
  Password: ********
  2FA Code: 123456
  ✓ Logged in successfully
```

---

## Non-Functional Requirements

### Performance

| Metric | Target |
|--------|--------|
| CLI cold start | < 2s |
| `criptenv set` | < 100ms |
| `criptenv push/pull` | < 500ms |
| Encryption (50 vars) | < 200ms |
| Decryption (50 vars) | < 150ms |

### Reliability

| Metric | Target |
|--------|--------|
| Uptime | 99.9% |
| Data loss | 0 |
| Sync conflicts | < 1% |
| Recovery time | < 1min |

### Security

| Metric | Target |
|--------|--------|
| Encryption | AES-GCM 256-bit |
| PBKDF2 iterations | 100,000 |
| 2FA coverage | > 80% of teams |
| Secret scanning | 100% of PRs |

---

**Document Version**: 1.0  
**Total Stories**: 13  
**Total Points**: 71  
**Next**: Guidelines
