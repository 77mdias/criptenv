# Technical Specifications — CriptEnv

## Complete Technical Reference

---

## Table of Contents

1. [System Architecture](./architecture/README.md)
2. [FastAPI Endpoints](./endpoints/README.md)
3. [Database Schema](./database/README.md)
4. [Encryption Protocol](./encryption/README.md)

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │   CLI       │  │  Web App    │  │   CI/CD     │               │
│  │  (Node.js)  │  │  (Next.js)  │  │  (Actions)  │               │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘               │
│         │                 │                 │                      │
└─────────┼─────────────────┼─────────────────┼──────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        FASTAPI BACKEND                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │  Auth API   │  │  Vault API  │  │  Sync API   │               │
│  │ (BetterAuth)│  │             │  │(Realtime)   │               │
│  └─────────────┘  └─────────────┘  └─────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │ Auth        │  │ PostgreSQL  │  │  Realtime   │               │
│  │ (BetterAuth)│  │             │  │  (WebSocket)│               │
│  └─────────────┘  └─────────────┘  └─────────────┘               │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Encrypted Blob Storage (S3)                    │  │
│  │   NOTE: Server NEVER sees plaintext secrets!                │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Technology Decisions

### Backend: FastAPI

**Why FastAPI over alternatives?**

| Criteria | FastAPI | Express | NestJS | Django |
|----------|--------|---------|--------|--------|
| **Performance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Type Safety** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Async** | Native | ⚠️ Optional | ⚠️ Optional | ❌ Sync |
| **OpenAPI** | Auto | ❌ | ⚠️ Partial | ⚠️ DRF |
| **Serverless** | ⭐⭐⭐⭐⭐ | ❌ | ⚠️ | ❌ |
| **Learning Curve** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |

**Serverless Compatibility**: FastAPI + Mangum = AWS Lambda / Cloudflare Workers / Railway

### Frontend: Next.js + Vinext

**Why Vinext over standard Next.js?**

| Criteria | Vinext | Standard Next.js |
|----------|--------|-----------------|
| **Cold Start** | ~50ms | ~200ms |
| **Vite Ecosystem** | ✅ Yes | ❌ No |
| **Cloudflare Edge** | ✅ Native | ⚠️ Limited |
| **Bundle Size** | Smaller | Larger |
| **Pug Support** | ✅ Native | ⚠️ Plugin |

**Trade-off**: Vinext is newer (less community), but better suited for our "zero-cost edge" goal.

### Auth: BetterAuth

**Why BetterAuth over NextAuth/Clerk?**

| Criteria | BetterAuth | NextAuth | Clerk |
|----------|-----------|----------|-------|
| **Framework Agnostic** | ✅ Yes | ⚠️ Next.js | ⚠️ Limited |
| **Open Source** | ✅ MIT | ✅ MIT | ❌ Proprietary |
| **Database-backed** | ✅ Yes | ⚠️ Optional | ❌ SaaS |
| **2FA** | ✅ Plugin | ⚠️ Custom | ✅ Yes |
| **SSO Plugins** | ✅ Yes | ⚠️ Custom | ✅ Yes |
| **TypeScript** | ✅ First | ✅ Yes | ✅ Yes |

**Key Differentiator**:
- Works with ANY backend (Express, FastAPI, Hono, etc.)
- Database-backed sessions = full control
- MIT License = no vendor lock-in

### Encryption: AES-GCM 256-bit

**Why AES-GCM over alternatives?**

| Algorithm | Key Size | Authenticated | Speed | Standard |
|-----------|----------|---------------|-------|----------|
| **AES-GCM** | 256-bit | ✅ Yes (AEAD) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| ChaCha20-Poly1305 | 256-bit | ✅ Yes | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| AES-CBC | 256-bit | ❌ (needs HMAC) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**AES-GCM chosen** because:
- NIST standard (compliance)
- Hardware acceleration on all CPUs
- Built into Web Crypto API (browser-compatible)
- Provides both confidentiality AND integrity

---

## Deployment Architecture

### Zero-Cost Initial Hosting

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND TIER                                 │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │          Cloudflare Pages + Workers (Free Tier)               │   │
│  │  • Edge Network (300+ cities globally)                       │   │
│  │  • Unlimited bandwidth (no cap)                               │   │
│  │  • Automatic HTTPS                                            │   │
│  │  • Preview deployments via @cloudflare/next-on-pages          │   │
│  │  • Vinext (Next.js + Pug) native support                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        BACKEND TIER                                  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                 Railway (Free Tier) / Render                 │   │
│  │  • FastAPI + Uvicorn                                         │   │
│  │  • 500 hours/mo free                                         │   │
│  │  • Automatic sleep after 15min inactivity                    │   │
│  │  • Custom domain with SSL                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Alternative: Cloudflare Workers (Python support via pyodide)         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        DATA TIER                                     │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Supabase (Free Tier)                        │   │
│  │  • PostgreSQL 500MB                                          │   │
│  │  • Auth (BetterAuth integration)                             │   │
│  │  • Realtime (WebSocket)                                      │   │
│  │  • Storage (encrypted blobs)                                 │   │
│  │  • API auto-generated                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Cost Breakdown (Monthly)

| Service | Free Tier Limits | Cost |
|---------|------------------|------|
| **Cloudflare Pages** | Unlimited bandwidth, 500 builds | $0 |
| **Railway** | 500 hours, sleep after 15min | $0 |
| **Supabase** | 500MB DB, 1GB storage, 50k MAU | $0 |
| **GitHub** | Unlimited repos, Actions CI/CD | $0 |
| **Domain** | .env.security (TBD) | $12/year |
| **Total** | | **~$1/month** |

---

## Environment Variables (Backend)

```bash
# .env.example
NODE_ENV=production
PORT=8000

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# BetterAuth
BETTER_AUTH_SECRET=your-secret-here
BETTER_AUTH_URL=https://api.criptenv.com

# Encryption
MASTER_KEY_SALT=salt_for_pbkdf2

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

# CORS
CORS_ORIGINS=https://criptenv.com,https://www.criptenv.com
```

---

## Security Architecture

### Zero-Knowledge Data Flow

```
Developer Machine                              Supabase
      │                                             │
      │  1. User enters master password             │
      │                                             │
      ▼                                             │
┌─────────────┐                                    │
│ PBKDF2      │ 100,000 iterations                 │
│ (Password → │ Salt: unique per user              │
│  Session Key)│ Output: 256-bit key               │
└─────────────┘                                    │
      │                                             │
      │  2. Session Key encrypts .env content        │
      ▼                                             │
┌─────────────┐     ┌─────────────┐                  │
│ AES-GCM     │────▶│ Encrypted   │                  │
│ 256-bit     │     │ Blob + IV   │                  │
│             │     │ + Auth Tag  │                  │
└─────────────┘     └─────────────┘                  │
      │                     │                        │
      │  3. Upload blob     │                        │
      └─────────────────────┼────────────────────────┤
                            │                        │
                            ▼                        ▼
                    ┌─────────────────────┐    ┌───────────┐
                    │ Encrypted Storage   │    │ PostgreSQL│
                    │ (S3/Supabase)       │    │ (metadata)│
                    │                     │    │           │
                    │ • CANNOT decrypt   │    │ • User    │
                    │ • CANNOT read      │    │ • Project │
                    │ • CANNOT access    │    │ • Env     │
                    └─────────────────────┘    │ • Key ID  │
                                              └───────────┘
```

---

## Error Handling Strategy

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `AUTH_SESSION_EXPIRED` | 401 | Session token expired |
| `AUTH_2FA_REQUIRED` | 403 | 2FA verification needed |
| `VAULT_NOT_FOUND` | 404 | Project/vault doesn't exist |
| `VAULT_ACCESS_DENIED` | 403 | No permission to access vault |
| `ENCRYPTION_FAILED` | 500 | Client-side encryption error |
| `DECRYPTION_FAILED` | 500 | Client-side decryption error |
| `SYNC_CONFLICT` | 409 | Concurrent modification detected |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

### Error Response Format

```json
{
  "error": {
    "code": "VAULT_ACCESS_DENIED",
    "message": "You don't have permission to access this project",
    "details": {
      "project_id": "proj_xxx",
      "required_role": "developer"
    },
    "request_id": "req_abc123"
  }
}
```

---

## Performance Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| CLI command (local) | < 100ms | client-side |
| Encryption (.env 100 vars) | < 200ms | client-side |
| Push to server | < 500ms | end-to-end |
| Pull from server | < 500ms | end-to-end |
| Web page load | < 2s (LCP) | Lighthouse |
| API response (p95) | < 200ms | server-side |
| Realtime sync | < 1s | round-trip |

---

## Monitoring & Observability

### Logging

```python
# Structured JSON logs
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "service": "criptenv-api",
  "request_id": "req_abc123",
  "event": "secret.pushed",
  "user_id": "usr_xxx",
  "project_id": "prj_xxx",
  "duration_ms": 145
}
```

### Metrics (Prometheus)

| Metric | Type | Labels |
|--------|------|--------|
| `http_requests_total` | Counter | method, path, status |
| `http_request_duration_seconds` | Histogram | method, path |
| `secrets_encrypted_total` | Counter | project_id |
| `active_connections` | Gauge | type (cli, web) |
| `sync_operations_total` | Counter | type (push, pull) |

### Health Checks

```
GET /health          → 200 OK {"status": "healthy"}
GET /health/ready   → 200 OK {"db": "ok", "cache": "ok"}
GET /health/live    → 200 OK (kubernetes liveness)
```

---

**Document Version**: 1.0  
**Next**: Architecture Diagrams
