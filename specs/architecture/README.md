# System Architecture — CriptEnv

## Data Flow Diagrams

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CriptEnv System Architecture                      │
└─────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │   End Users     │
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
           ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
           │   CLI Client    │      │   Web Browser   │      │   CI/CD Agent   │
           │   (Node.js)     │      │   (Next.js)     │      │ (GitHub Action) │
           └────────┬────────┘      └────────┬────────┘      └────────┬────────┘
                    │                        │                        │
                    │   HTTPS + JWT          │   HTTPS + Session      │   HTTPS + CI Token
                    │                        │                        │
┌───────────────────┼────────────────────────┼────────────────────────┼───────────────────┐
│                   ▼                        ▼                        ▼                   │
│           ┌─────────────────────────────────────────────────────────────────────┐       │
│           │                           FastAPI Backend                           │       │
│           │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │       │
│           │  │  Auth API   │  │  Vault API  │  │  Sync API   │  │  Admin API  │ │       │
│           │  │ (BetterAuth)│  │             │  │ (WebSocket) │  │             │ │       │
│           │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │       │
│           │           │                │                │                 │     │       │
│           │           └────────────────┼────────────────┘                 │     │       │
│           │                            ▼                                  │     │       │
│           │                    ┌─────────────┐                            │     │       │
│           │                    │  Middleware │                            │     │       │
│           │                    │ • Auth      │                            │     │       │
│           │                    │ • Rate Lim  │                            │     │       │
│           │                    │ • Logging   │                            │     │       │
│           │                    │ • CORS      │                            │     │       │
│           │                    └─────────────┘                            │     │       │
│           └───────────────────────────────────────────────────────────────┘             │
│                                       │                                                 │
│                                       │ HTTPS                                           │
│                                       ▼                                                 │
│           ┌─────────────────────────────────────────────────────────────────────────┐   │
│           │                          Supabase                                       │   │
│           │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │   │
│           │   │    Auth     │  │  PostgreSQL │  │  Realtime   │  │    Storage    │  │   │
│           │   │(BetterAuth) │  │             │  │ (WebSocket) │  │(S3-compatible)│  │   │
│           │   └─────────────┘  └─────────────┘  └─────────────┘  └───────────────┘  │   │
│           │          │                │                │                  │         │   │
│           │          └────────────────┼────────────────┘                  │         │   │
│           │                           ▼                                   │         │   │
│           │                   ┌─────────────┐                             │         │   │
│           │                   │ Encrypted   │                             │         │   │
│           │                   │ Blobs ONLY  │                             │         │   │
│           │                   │ (Server can │                             │         │   │
│           │                   │  NEVER read)│                             │         │   │
│           │                   └─────────────┘                             │         │   │
│           └───────────────────────────────────────────────────────────────┘         │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Encryption Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Zero-Knowledge Encryption Flow                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT-SIDE ONLY                                      │
│                                                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    Developer Machine                                  │   │
│   │                                                                       │   │
│   │   ┌───────────────┐                                                 │   │
│   │   │  Master Password │  (never transmitted, never stored)             │   │
│   │   │  "MyS3cur3P@ss!" │                                               │   │
│   │   └─────────┬───────┘                                                 │   │
│   │             │                                                          │   │
│   │             ▼                                                          │   │
│   │   ┌───────────────────────┐                                          │   │
│   │   │        PBKDF2          │  PBKDF2-HMAC-SHA256                      │   │
│   │   │   Key Derivation       │  • 100,000 iterations                   │   │
│   │   │                       │  • 128-bit salt (unique per user)       │   │
│   │   │                       │  • Output: 256-bit Session Key           │   │
│   │   └───────────┬───────────┘                                          │   │
│   │               │                                                        │   │
│   │               │ In-memory only (never persisted)                      │   │
│   │               ▼                                                        │   │
│   │   ┌───────────────────────┐                                          │   │
│   │   │   Key Encryption Key   │  (KEK)                                   │   │
│   │   │       (KEK)            │                                          │   │
│   │   └───────────┬───────────┘                                          │   │
│   │               │                                                        │   │
│   │        ┌──────┴──────┐                                                │   │
│   │        ▼             ▼                                                │   │
│   │   ┌─────────┐   ┌─────────┐                                            │   │
│   │   │ Project │   │ Project │  (DEK - Data Encryption Key)              │   │
│   │   │  Key A  │   │  Key B  │  • Wrapped by KEK                        │   │
│   │   │ (DEK)   │   │ (DEK)   │  • Stored in Supabase                     │   │
│   │   └────┬────┘   └────┬────┘                                            │   │
│   │        │             │                                                 │   │
│   │        ▼             ▼                                                 │   │
│   │   ┌─────────────────────────────┐                                    │   │
│   │   │      AES-GCM 256-bit          │                                    │   │
│   │   │     Encryption Process         │                                    │   │
│   │   │                               │                                    │   │
│   │   │  ┌───────────────────────┐   │                                    │   │
│   │   │  │  Plaintext .env       │   │    DATABASE_URL=postgres://...     │   │
│   │   │  │  Content              │   │    API_KEY=sk-xxx...                │   │
│   │   │  └───────────────────────┘   │    STRIPE_KEY=sk_live_xxx...       │   │
│   │   │              │               │                                    │   │
│   │   │              ▼               │                                    │   │
│   │   │  ┌───────────────────────┐   │                                    │   │
│   │   │  │    AES-GCM Encrypt   │────┼────▶  Encrypted Blob              │   │
│   │   │  │    + AES-GCM 256     │   │    │  • IV: random 12 bytes          │   │
│   │   │  │    + Auth Tag        │   │    │  • Ciphertext                  │   │
│   │   │  └───────────────────────┘   │    │  • Auth Tag: 128 bits          │   │
│   │   └─────────────────────────────┘                                    │   │
│   │                                                                           │   │
│   └───────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                          │
│                                       │  ONLY encrypted data travels              │
│                                       ▼                                          │
└───────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                              SUPABASE (Server)                                 │
│                                                                                │
│   ┌─────────────────────────────────────────────────────────────────────┐    │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │    │
│   │  │   Users     │  │  Projects  │  │   Envs      │  │  Encrypted  │ │    │
│   │  │             │  │             │  │             │  │   Blobs     │ │    │
│   │  │ • id        │  │ • id        │  │ • id        │  │             │ │    │
│   │  │ • email     │  │ • name      │  │ • project_id│  │ • project_id│ │    │
│   │  │ • kdf_salt  │  │ • owner_id  │  │ • name      │  │ • env_name  │ │    │
│   │  │ • wrapped_DEK│ │ • created_at│  │ • created_at│  │ • iv        │ │    │
│   │  │ (encrypted) │  │             │  │             │  │ • ciphertext│ │    │
│   │  └─────────────┘  └─────────────┘  └─────────────┘  │ • auth_tag  │ │    │
│   │                                                        └─────────────┘ │    │
│   │                                                                      │    │
│   │  ⚠️  SERVER CANNOT DECRYPT                                           │    │
│   │  ⚠️  • No access to master password                                 │    │
│   │  ⚠️  • No access to KEK                                             │    │
│   │  ⚠️  • Only stores/retrieves encrypted blobs                         │    │
│   │                                                                      │    │
│   └──────────────────────────────────────────────────────────────────────┘    │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Authentication Flow (BetterAuth)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Authentication Flow with BetterAuth                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│    Client    │         │   FastAPI    │         │   Supabase   │
│   (CLI/Web)  │         │   Backend    │         │    (Auth)    │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                          │                          │
       │  1. POST /api/auth/signup                          │
       │  {email, password}                                │
       │──────────────────────────▶                         │
       │                          │                         │
       │                          │  2. Create user        │
       │                          │───────────────────────▶│
       │                          │                         │
       │                          │  3. Return session     │
       │                          │◀───────────────────────│
       │                          │                         │
       │  4. Return session token │                         │
       │◀──────────────────────────                          │
       │                          │                         │
       │  [Session established]   │                         │
       │                          │                         │
       │                          │                         │
       │  5. GET /api/vault       │                         │
       │  Authorization: Bearer   │                         │
       │  <session_token>         │                         │
       │──────────────────────────▶                         │
       │                          │                         │
       │                          │  6. Validate session    │
       │                          │───────────────────────▶│
       │                          │                         │
       │                          │  7. Return user data    │
       │                          │◀───────────────────────│
       │                          │                         │
       │  8. Return vault data    │                         │
       │◀──────────────────────────                          │
       │                          │                         │
       │                          │                         │

┌─────────────────────────────────────────────────────────────────────────────┐
│                         BetterAuth Integration                               │
│                                                                               │
│  FastAPI Handler (Express-compatible):                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │   app.all("/api/auth/*", toNodeHandler(auth));                       │   │
│  │                                                                       │   │
│  │   // BetterAuth creates:                                              │   │
│  │   // • /api/auth/signup    → Create account                          │   │
│  │   // • /api/auth/signin    → Login                                   │   │
│  │   // • /api/auth/signout   → Logout                                  │   │
│  │   // • /api/auth/session   → Get current session                     │   │
│  │   // • /api/auth/verify-2fa → Verify 2FA                             │   │
│  │   // • /api/auth/oauth/:provider → OAuth providers                    │   │
│  │   //                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Sync Flow (Realtime)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Team Sync Flow (Realtime)                            │
└─────────────────────────────────────────────────────────────────────────────┘

 Developer A                           Supabase                          Developer B
    │                                    │                                    │
    │  $ criptenv set API_KEY=xyz        │                                    │
    │                                    │                                    │
    │  [Local encryption]                │                                    │
    │                                    │                                    │
    │  $ criptenv push                   │                                    │
    │──────────────────▶                  │                                    │
    │                                    │                                    │
    │              ┌─────────────────────┼─────────────────────┐              │
    │              │ INSERT INTO encrypted_vaults               │              │
    │              │ {project_id, env, iv, ciphertext, tag}    │              │
    │              └─────────────────────┼─────────────────────┘              │
    │                                    │                                    │
    │                                    │  Publish to Realtime channel      │
    │                                    │  Channel: project:{id}             │
    │                                    │                                    │
    │                                    ▼                                    │
    │              ┌─────────────────────────────────────────────┐              │
    │              │            WebSocket Broadcast              │              │
    │              │  { event: "vault_updated", project_id }     │              │
    │              └─────────────────────────────────────────────┘              │
    │                           │                    │                         │
    │                           ▼                    ▼                         │
    │◀────────────────── (no response)                                    ──────▶│
    │                                                                              │
    │                                                               $ criptenv pull
    │                                                               ◀─────────────
    │                                                                              │
    │                                                               [Fetch vault]
    │                                                               ◀─────────────
    │                                                               [Decrypt]
    │                                                               [Update local]
    │                                                               [Done]
    │                                                                              │


┌─────────────────────────────────────────────────────────────────────────────┐
│                         Conflict Resolution                                  │
└─────────────────────────────────────────────────────────────────────────────┘

  Same secret modified by both developers simultaneously:

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                                                                          │
  │   Developer A                    Server                     Developer B  │
  │       │                            │                            │        │
  │       │  push: KEY="value_A"       │                            │        │
  │       │───────────────────────────▶│                            │        │
  │       │                            │                            │        │
  │       │                    ┌───────┴───────┐                    │        │
  │       │                    │ Check version │                    │        │
  │       │                    │ Server: v1     │                    │        │
  │       │                    │ Client A: v1   │                    │        │
  │       │                    │ ➡️  NO CONFLICT │                    │        │
  │       │                    └───────┬───────┘                    │        │
  │       │                            │                            │        │
  │       │  success                   │                            │        │
  │       │◀───────────────────────────│                            │        │
  │       │                            │                            │        │
  │       │                            │  push: KEY="value_B"       │        │
  │       │                            │◀────────────────────────────│        │
  │       │                            │                            │        │
  │       │                    ┌───────┴───────┐                    │        │
  │       │                    │ Check version │                    │        │
  │       │                    │ Server: v2     │                    │        │
  │       │                    │ Client B: v1   │                    │        │
  │       │                    │ ⚠️  CONFLICT   │                    │        │
  │       │                    └───────┬───────┘                    │        │
  │       │                            │                            │        │
  │       │                            │  409 Conflict Response       │        │
  │       │                            │◀────────────────────────────│        │
  │       │                            │                            │        │
  │       │                            │  ⚠️  "Run criptenv sync"    │        │
  │       │                            │◀────────────────────────────│        │
  │       │                            │                            │        │
  │       │                                                               │
  │       │  $ criptenv sync                                                      │
  │       │  ┌─────────────────────────────────────────────────────────────┐  │
  │       │  │  SHOW CONFLICT:                                             │  │
  │       │  │                                                             │  │
  │       │  │  KEY       │ Local      │ Remote     │                     │  │
  │       │  │  API_KEY   │ value_A    │ value_B    │                     │  │
  │       │  │                                                             │  │
  │       │  │  [Keep Local] [Keep Remote] [Merge Manually]               │  │
  │       │  └─────────────────────────────────────────────────────────────┘  │
  │       │                                                               │
  └───────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Database ERD

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CriptEnv Database Schema                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                USERS                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK │ id                  │ uuid          │ Unique identifier                │
│    │ email               │ varchar(255)  │ Unique, indexed                    │
│    │ name                │ varchar(255)  │ Display name                       │
│    │ password_hash       │ varchar(255)  │ Bcrypt hash (optional)            │
│    │ kdf_salt            │ varchar(32)   │ PBKDF2 salt for key derivation     │
│    │ wrapped_dek         │ bytea         │ User's DEK wrapped with KEK        │
│    │ two_factor_secret   │ bytea         │ Encrypted TOTP secret               │
│    │ two_factor_enabled  │ boolean       │ Default: false                     │
│    │ created_at          │ timestamptz   │ Default: now()                     │
│    │ updated_at          │ timestamptz   │ Default: now()                     │
│    │ last_login_at       │ timestamptz   │ Last successful login             │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ 1:N
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PROJECTS                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK │ id                  │ uuid          │ Unique identifier                │
│ FK │ owner_id            │ uuid          │ REFERENCES users(id)              │
│    │ name                │ varchar(255)  │ Project name                       │
│    │ slug                │ varchar(100)  │ URL-friendly name, unique          │
│    │ description         │ text          │ Optional description              │
│    │ encryption_key_id   │ varchar(64)   │ Reference to key in vault         │
│    │ settings            │ jsonb         │ Project settings                   │
│    │ created_at          │ timestamptz   │ Default: now()                     │
│    │ updated_at          │ timestamptz   │ Default: now()                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ 1:N
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             ENVIRONMENTS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK │ id                  │ uuid          │ Unique identifier                │
│ FK │ project_id          │ uuid          │ REFERENCES projects(id)           │
│    │ name                │ varchar(100)  │ dev, staging, prod, custom        │
│    │ display_name        │ varchar(255)  │ "Development", "Staging", etc     │
│    │ is_default          │ boolean       │ True for first env                 │
│    │ secrets_version     │ integer       │ Optimistic locking                 │
│    │ created_at          │ timestamptz   │ Default: now()                     │
│    │ updated_at          │ timestamptz   │ Default: now()                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ 1:N
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            VAULT_BLOBS                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK │ id                  │ uuid          │ Unique identifier                │
│ FK │ project_id          │ uuid          │ REFERENCES projects(id)           │
│ FK │ environment_id      │ uuid          │ REFERENCES environments(id)      │
│    │ key_id              │ varchar(64)   │ Hash of secret key (not name)     │
│    │ iv                  │ bytea         │ AES-GCM IV (12 bytes)              │
│    │ ciphertext          │ bytea         │ AES-GCM ciphertext                 │
│    │ auth_tag            │ bytea         │ AES-GCM auth tag (16 bytes)        │
│    │ version             │ integer       │ For conflict detection             │
│    │ created_at          │ timestamptz   │ Default: now()                     │
│    │ updated_at          │ timestamptz   │ Default: now()                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ 1:N
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AUDIT_LOGS                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK │ id                  │ uuid          │ Unique identifier                │
│ FK │ user_id             │ uuid          │ REFERENCES users(id)              │
│ FK │ project_id          │ uuid          │ REFERENCES projects(id)           │
│    │ action              │ varchar(50)   │ secret.created, secret.updated    │
│    │ resource_type        │ varchar(50)   │ secret, env, project, member      │
│    │ resource_id          │ uuid          │ ID of affected resource           │
│    │ metadata            │ jsonb         │ Additional context                 │
│    │ ip_address          │ inet          │ Client IP                          │
│    │ user_agent          │ text          │ Client user agent                  │
│    │ created_at          │ timestamptz   │ Default: now()                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            PROJECT_MEMBERS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK │ id                  │ uuid          │ Unique identifier                │
│ FK │ project_id          │ uuid          │ REFERENCES projects(id)           │
│ FK │ user_id             │ uuid          │ REFERENCES users(id)              │
│    │ role                │ varchar(20)   │ owner, admin, developer, viewer    │
│    │ invited_by          │ uuid          │ REFERENCES users(id)              │
│    │ created_at          │ timestamptz   │ Default: now()                     │
│    │ accepted_at         │ timestamptz   │ When invitation was accepted      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           CI_TOKENS                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK │ id                  │ uuid          │ Unique identifier                │
│ FK │ project_id          │ uuid          │ REFERENCES projects(id)           │
│    │ name                │ varchar(255)  │ Token name (e.g., "GitHub CI")    │
│    │ token_hash          │ varchar(255)  │ SHA-256 hash of token             │
│    │ last_used_at        │ timestamptz   │ Last usage timestamp              │
│    │ expires_at          │ timestamptz   │ Optional expiration               │
│    │ created_at          │ timestamptz   │ Default: now()                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLI Component Map                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              @criptenv/cli                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Command Layer                                   │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │   │
│  │  │   init  │  │  login  │  │  logout │  │   set   │  │   get   │ │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘ │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │   │
│  │  │  list   │  │ delete  │  │  push   │  │  pull   │  │  sync   │ │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘ │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │   │
│  │  │  env    │  │ doctor  │  │ import  │  │ export  │  │  audit  │ │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Service Layer                                  │   │
│  │                                                                       │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐          │   │
│  │  │ VaultService   │  │ CryptoService │  │ SyncService   │          │   │
│  │  │               │  │               │  │               │          │   │
│  │  │ • local CRUD  │  │ • PBKDF2      │  │ • push/pull   │          │   │
│  │  │ • import/export│  │ • AES-GCM    │  │ • conflict    │          │   │
│  │  │ • env manage  │  │ • key wrap   │  │ • merge       │          │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘          │   │
│  │                                                                       │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐          │   │
│  │  │ ApiService    │  │ AuthService   │  │ AuditService  │          │   │
│  │  │               │  │               │  │               │          │   │
│  │  │ • REST calls  │  │ • session mgmt │  │ • log events  │          │   │
│  │  │ • error handle│  │ • token store │  │ • local log   │          │   │
│  │  │ • retry logic │  │ • 2FA flow    │  │ • export      │          │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Crypto Layer                                   │   │
│  │                                                                       │   │
│  │                    ┌─────────────────────┐                          │   │
│  │                    │   Web Crypto API    │                          │   │
│  │                    │   (Node.js built-in) │                          │   │
│  │                    └─────────────────────┘                          │   │
│  │                                                                       │   │
│  │  PBKDF2 ──▶ AES-GCM ──▶ Key Wrapping ──▶ Secure Random               │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Platform Layer                                   │   │
│  │                                                                       │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐          │   │
│  │  │  FileSystem   │  │   Clipboard   │  │    Config     │          │   │
│  │  │               │  │               │  │               │          │   │
│  │  │ ~/.criptenv/  │  │ Copy to paste │  │ ~/.config/    │          │   │
│  │  │   vault.db    │  │ board         │  │ criptenv.json │          │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. API Request/Response Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLI Command: criptenv push                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│    CLI        │      │   FastAPI     │      │   Supabase    │
│   Client      │      │   Backend     │      │    Storage    │
└───────┬───────┘      └───────┬───────┘      └───────┬───────┘
        │                      │                      │
        │  1. Read local vault │                      │
        │  ~/.criptenv/vault   │                      │
        │                      │                      │
        │  2. Encrypt secrets  │                      │
        │  (AES-GCM 256-bit)   │                      │
        │                      │                      │
        │  3. POST /api/vault/push                      │
        │  {                                           │
        │    project_id: "proj_xxx",                  │
        │    environment: "production",                │
        │    encrypted_blob: "base64...",             │
        │    iv: "base64...",                          │
        │    auth_tag: "base64...",                   │
        │    version: 42                               │
        │  }                                           │
        │─────────────────────────▶                   │
        │                      │                       │
        │                      │  4. Validate JWT      │
        │                      │  5. Check RLS         │
        │                      │                       │
        │                      │  6. UPSERT vault_blob │
        │                      │─────────────────────────────────────────▶
        │                      │                       │          │
        │                      │  7. Publish Realtime  │          │
        │                      │  event                │          │
        │                      │─────────────────────────────────────────▶
        │                      │                       │          │
        │                      │  8. 200 OK            │          │
        │                      │  { success: true,     │          │
        │                      │    version: 43 }      │          │
        │  9. Update local     │◀─────────────────────│          │
        │  version counter     │                      │          │
        │                      │                      │          │
        │  [Done]             │                       │          │
        │                      │                      │          │
        │                      │                      ▼          │
        │                      │              ┌─────────────┐     │
        │                      │              │ vault_blobs │     │
        │                      │              │ table       │     │
        │                      │              └─────────────┘     │
        │                      │                      │          │
        │                      │                      │ 9. INSERT │
        │                      │                      │ / UPDATE  │
        │                      │                      │◀──────────│
        │                      │                      │          │
        └──────────────────────┴──────────────────────┴──────────┘
```

---

**Document Version**: 1.0  
**Next**: FastAPI Endpoints
