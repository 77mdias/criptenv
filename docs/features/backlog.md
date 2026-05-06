# Backlog — CriptEnv

## Overview

Planned and future features organized by priority.

---

## High Priority

### Phase 3 Closure

#### Railway Integration

- [ ] **RailwayProvider**
  - Implement `RailwayProvider` strategy following RenderProvider pattern
  - push_secrets/pull_secrets/validate_connection
  - Files: `apps/api/app/strategies/integrations/railway.py`
  - Status: Not started

#### Web Alert Configuration UI

- [ ] **Alert Configuration Page**
  - Per-project alert settings
  - Webhook URL configuration
  - Notification preferences
  - Files: `apps/web/src/app/(dashboard)/projects/[id]/settings/page.tsx`
  - Status: Not started

---

## Medium Priority

### GitHub Action Polish

- [ ] **Publish to GitHub Marketplace**
  - Complete README with usage examples
  - Add version tags
  - Submit for review
  - Files: `packages/github-action/README.md`
  - Status: Not started

- [ ] **E2E Tests**
  - Integration tests with real GitHub repository
  - Test against public and private repos
  - Status: Not started

### Webhook Enhancements

- [ ] **Email Notifications**
  - SMTP integration for expiration alerts
  - Configurable email templates
  - Status: Not started

- [ ] **Slack Integration**
  - Slack webhook notifications
  - Interactive "Rotate Now" button
  - Status: Not started

### Documentation

- [ ] **Integration Guides**
  - Vercel setup guide
  - Railway setup guide
  - GitHub Actions tutorial
  - Files: `docs/technical/integration-guides/`
  - Status: Not started

- [ ] **Public API Documentation**
  - API usage examples
  - Rate limit documentation
  - Files: `docs/technical/api-reference/`
  - Status: Partial (OpenAPI docs exist)

---

## Low Priority

### Phase 3 Features

- [ ] **Auto-Rotation Policy**
  - Automatically rotate secrets on schedule
  - Configurable rotation interval per secret
  - Preserve rotation history
  - Status: Not started

- [ ] **Secret Versioning History**
  - Store previous secret values
  - View/restore old values
  - Diff view between versions
  - Status: Not started

- [ ] **Docker Integration**
  - Docker Compose plugin
  - Inject secrets at container startup
  - Status: Not started

- [ ] **Kubernetes Operator**
  - Kubernetes operator for secret injection
  - Helm chart for deployment
  - Status: Not started

- [ ] **Terraform Provider**
  - Terraform provider for CriptEnv
  - Manage secrets via Infrastructure as Code
  - Status: Not started

### Phase 4: Enterprise

- [ ] **SSO/SAML**
  - Okta integration
  - Azure AD integration
  - Google Workspace integration
  - Status: Planned

- [ ] **SCIM Provisioning**
  - Automated user provisioning
  - Directory sync
  - Status: Planned

- [ ] **SIEM Export**
  - Splunk integration
  - Datadog integration
  - Elastic integration
  - Status: Planned

- [ ] **Self-Hosted Option**
  - Docker Compose distribution
  - Kubernetes Helm chart
  - One-click deployment
  - Status: Planned

- [ ] **Secret Policies**
  - Enforce rotation schedules
  - Naming conventions
  - Complexity requirements
  - Status: Planned

- [ ] **Audit Archive**
  - Long-term audit storage
  - Search and export
  - Compliance reports
  - Status: Planned

---

## Future Ideas

### User Experience

- [ ] **Secret Templates**
  - Predefined templates for common services (AWS, Stripe, etc.)
  - One-click setup for new projects

- [ ] **Command Palette**
  - `Cmd+K` quick actions
  - Fuzzy search for secrets

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
Phase 3 (CI/CD) — 92% Complete
├── M3.1: GitHub Action ✅ (publishing pending)
├── M3.2: Cloud Integrations
│   ├── Vercel ✅
│   ├── Render ✅
│   └── Railway ──► Next pending task
├── M3.3: CI Tokens ✅
├── M3.4: Public API ✅
├── M3.5: Secret Alerts
│   ├── ExpirationBadge ✅
│   ├── Web alert config ──► P1 pending
│   └── Rotation modal ──► P1 pending
├── M3.6: APScheduler ✅
├── M3.7: OAuth ✅
└── Integration Config Encryption ✅

Phase 4 (Enterprise)
├── SSO/SAML ──► Depends on user research validation
├── SCIM ──► Depends on SSO
└── Self-hosted ──► Depends on Docker/K8s expertise
```

---

**Document Version**: 1.1  
**Last Updated**: 2026-05-03
