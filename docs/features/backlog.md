# Backlog — CriptEnv

## Overview

Planned and future features organized by priority.

---

## High Priority

### Phase 3 Features

#### API Infrastructure

- [ ] **Rate Limiting Middleware**
  - Implement in-memory rate limiter
  - Limits: 5 req/min (auth), 100 req/min (API key), 200 req/min (CI)
  - Files: `apps/api/app/middleware/rate_limit.py`
  - Status: Tests exist, implementation needed

- [ ] **API Key Model & Router**
  - Create `APIKey` model in `apps/api/app/models/api_key.py`
  - Create `APIKey` router in `apps/api/app/routers/api_keys.py`
  - Create API key auth middleware
  - Files: `apps/api/app/middleware/api_key_auth.py`

- [ ] **API Versioning**
  - Ensure all endpoints use `/api/v1/` prefix consistently
  - Update OpenAPI docs
  - Files: `apps/api/main.py`

#### CI Auth Enhancement

- [ ] **CLI `ci-login` Command**
  - Login with CI token instead of email/password
  - Store CI session separately from user session
  - File: `apps/cli/src/criptenv/commands/ci.py`

- [ ] **CLI `ci-deploy` Command**
  - Push secrets and optionally sync with provider
  - File: `apps/cli/src/criptenv/commands/ci.py`

- [ ] **CLI `ci-secrets` Command**
  - List secrets available in CI context
  - File: `apps/cli/src/criptenv/commands/ci.py`

#### Cloud Integrations

- [ ] **Vercel Integration**
  - `VercelProvider` strategy
  - Push/pull secrets to Vercel environment variables
  - CLI `criptenv vercel link` command
  - Web: Vercel integration card on `/integrations`

- [ ] **Railway Integration**
  - `RailwayProvider` strategy
  - Push/pull secrets to Railway variables
  - CLI `criptenv railway link` command

- [ ] **Render Integration**
  - `RenderProvider` strategy
  - Push/pull secrets to Render environment variables
  - CLI `criptenv render link` command

#### Secret Expiration UI

- [ ] **Expiration Badge Full Integration**
  - Complete integration into secrets table
  - Color coding: green (fresh), yellow (warning), red (soon), expired (red + strikethrough)

- [ ] **Alert Configuration UI**
  - Per-project alert settings
  - Webhook URL configuration
  - Notification preferences

- [ ] **Rotation Modal**
  - Modal for manual rotation from web UI
  - Preview old vs new value
  - Audit trail entry creation

---

## Medium Priority

### Security Hardening

- [ ] **Resolve CR-01: Session Token Exposure**
  - Remove session token from response body
  - Token should only be in HTTP-only cookie

- [ ] **Resolve CR-02: Token in localStorage**
  - Move token storage to HTTP-only cookies
  - Update frontend auth logic

- [ ] **CSRF Protection**
  - Implement CSRF tokens for state-changing operations
  - Middleware for cross-origin requests

### GitHub Action Polish

- [ ] **Publish to GitHub Marketplace**
  - Complete README
  - Add version tags
  - Submit for review

- [ ] **E2E Tests**
  - Integration tests with real GitHub repository
  - Test against public and private repos

### Webhook Enhancements

- [ ] **Email Notifications**
  - SMTP integration for expiration alerts
  - Configurable email templates

- [ ] **Slack Integration**
  - Slack webhook notifications
  - Interactive "Rotate Now" button

### Documentation

- [ ] **Public API Documentation**
  - OpenAPI spec generation
  - API usage examples
  - Rate limit documentation

- [ ] **Integration Guides**
  - Vercel setup guide
  - Railway setup guide
  - GitHub Actions tutorial

---

## Low Priority

### Phase 3 Features

- [ ] **Auto-Rotation Policy**
  - Automatically rotate secrets on schedule
  - Configurable rotation interval per secret
  - Preserve rotation history

- [ ] **Secret Versioning History**
  - Store previous secret values
  - View/restore old values
  - Diff view between versions

- [ ] **Docker Integration**
  - Docker Compose plugin
  - Inject secrets at container startup

- [ ] **Kubernetes Operator**
  - Kubernetes operator for secret injection
  - Helm chart for deployment

- [ ] **Terraform Provider**
  - Terraform provider for CriptEnv
  - Manage secrets via Infrastructure as Code

### Phase 4: Enterprise

- [ ] **SSO/SAML**
  - Okta integration
  - Azure AD integration
  - Google Workspace integration

- [ ] **SCIM Provisioning**
  - Automated user provisioning
  - Directory sync

- [ ] **SIEM Export**
  - Splunk integration
  - Datadog integration
  - Elastic integration

- [ ] **Self-Hosted Option**
  - Docker Compose distribution
  - Kubernetes Helm chart
  - One-click deployment

- [ ] **Secret Policies**
  - Enforce rotation schedules
  - Naming conventions
  - Complexity requirements

- [ ] **Audit Archive**
  - Long-term audit storage
  - Search and export
  - Compliance reports

---

## Future Ideas

### User Experience

- [ ] **Secret Templates**
  - Predefined templates for common services (AWS, Stripe, etc.)
  - One-click setup for new projects

- [ ] **Command Palette**
  - `Cmd+K` quick actions
  - Fuzzy search for secrets

- [ ] **Dark/Light Theme Toggle**
  - Already exists in frontend
  - Persist preference server-side

- [ ] **Mobile App**
  - Native mobile for viewing secrets
  - Push notifications for alerts

### Developer Experience

- [ ] **VSCode Extension**
  - Inline secret viewing
  - `.env` file auto-completion

- [ ] **GitHub Bot**
  - Auto-detect exposed secrets in PRs
  - Suggest rotation

- [ ] **CLI Plugin System**
  - Extensible CLI commands
  - Community plugins

### Analytics & Insights

- [ ] **Usage Analytics**
  - Secrets accessed per day
  - Popular integrations
  - Team activity

- [ ] **Security Score**
  - Score based on secret age, rotation frequency
  - Recommendations for improvement

---

## Feature Requests (Not Started)

### From User Research

- [ ] **Bulk Operations**
  - Select multiple secrets
  - Bulk rotate, delete, export

- [ ] **Folders/Groups**
  - Organize secrets by category
  - Nested hierarchy

- [ ] **Secret Dependencies**
  - Define dependencies between secrets
  - Auto-inject dependent services

### Technical Improvements

- [ ] **Offline Mode (CLI)**
  - Full offline vault access
  - Sync when connection restored

- [ ] **Merge Tool**
  - Visual merge for conflicting secrets
  - Three-way diff

- [ ] **Audit Export**
  - Export audit logs as CSV/JSON
  - Scheduled export to S3

---

## Ideas (Unvalidated)

These are ideas that have been discussed but not validated with users:

- [ ] **Secret Sharing Links**
  - Time-limited share links for secrets
  - View-only access without account

- [ ] **Secret Gifting**
  - Gift premium features

- [ ] **Secret Auctions**
  - (Completely unvalidated)

---

## Dependency Map

```
Phase 3 (CI/CD)
├── M3.1: GitHub Action ✅
├── M3.2: Cloud Integrations
│   ├── Vercel (P0) ──► Needs IntegrationProvider interface
│   ├── Railway (P1)
│   └── Render (P1)
├── M3.3: CI Tokens Enhancement
│   ├── ci-login ──► Needs CI auth middleware
│   ├── ci-deploy ──► Needs IntegrationService
│   └── ci-secrets ──► Needs CI auth middleware
├── M3.4: Public API
│   ├── API versioning ──► Needs rate limiting first
│   ├── API key model ──► Depends on API versioning
│   └── Rate limiting ──► P0 before public API
└── M3.5: Secret Alerts
    ├── ExpirationBadge (web) ──► In progress
    ├── Rotation modal (web) ──► Needs ExpirationBadge first
    └── Email/Slack webhooks ──► Low priority

Phase 4 (Enterprise)
├── SSO/SAML ──► Depends on user research validation
├── SCIM ──► Depends on SSO
└── Self-hosted ──► Depends on Docker/K8s expertise
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-01