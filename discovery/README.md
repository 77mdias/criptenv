# Product Discovery — CriptEnv

## Feature Set Detalhado

---

## 1. Core Features

### 1.1 CLI-First Workflow

O CLI é o produto principal. Deve ser:

- **Rápido**: Resposta < 500ms
- **Intuitivo**: Comandos auto-explicativos
- **Idempotente**: Resultados consistentes
- **Offline-capable**: Funciona sem conexão (cache local)

#### Comandos Principais

```bash
# Inicialização
criptenv init                    # Criar projeto local
criptenv link [project-id]      # Vincular a projeto existente

# Gerenciamento de Secrets
criptenv set KEY=value          # Adicionar secret
criptenv set KEY=value --env=prod   # Adicionar para ambiente específico
criptenv get KEY                 # Obter valor (copia para clipboard)
criptenv list                    # Listar todas as chaves (sem valores)
criptenv delete KEY              # Remover secret
criptenv edit                    # Abrir editor de .env

# Sync & Team
criptenv push                    # Enviar changes para server
criptenv pull                    # Puxar changes do server
criptenv sync                    # Bidirectional sync
criptenv conflicts               # Mostrar conflitos de merge

# Environments
criptenv env list                # Listar ambientes (dev, staging, prod)
criptenv env create staging      # Criar novo ambiente
criptenv env switch prod         # Trocar ambiente ativo
criptenv env diff dev prod       # Comparar environments

# Utils
criptenv doctor                  # Diagnosticar problemas
criptenv import .env             # Importar de arquivo .env
criptenv export                  # Exportar para .env (descriptografado)
criptenv rotate                  # Solicitar rotação de chave
criptenv audit                   # Ver audit log
```

#### Fluxo de Primeiro Uso

```
1. npm install -g @criptenv/cli
2. criptenv init
   → Generate encryption key (PBKDF2 from passphrase)
   → Create local vault (~/.criptenv/vault)
   → Generate SSH key pair for signing
3. criptenv login
   → Authenticate via BetterAuth
   → Link local key to account
4. criptenv create project my-app
   → Create project in Supabase
   → Generate project encryption key (wrapped with user key)
5. criptenv push
   → Encrypt all .env content
   → Upload to Supabase
```

### 1.2 Web Dashboard

Interface visual para:

- **Gestão de equipe**: Convite, roles, permissões
- **Visualização de secrets**: Grid/table view sem expor valores
- **Audit logs**: Timeline de operações
- **Settings**: Configurações de projeto/equipe
- **Templates**: Começar de templates pré-definidos

#### Screens Principais

| Screen | Descrição |
|--------|-----------|
| **Dashboard** | Overview: projetos, activity feed, warnings |
| **Projects List** | Grid de projetos com status |
| **Project Detail** | Environments, secrets count, team |
| **Secrets Browser** | Tabela de secrets (valores masked) |
| **Audit Log** | Timeline filtrável de operações |
| **Team Settings** | Members, roles, invitations |
| **Integrations** | GitHub, Vercel, Railway, etc |
| **Billing** | Usage, plan, upgrade (future) |

### 1.3 Environment Management

#### Tipos de Environment

| Type | Uso | Access |
|------|-----|--------|
| **Development** | Local dev | Apenas owner |
| **Staging** | Homologação | Devs selecionados |
| **Production** | Production | Minimal (on-call only) |
| **Custom** | Ambientes específicos | Conforme configurado |

#### Features de Environment

```bash
# Hierarquia de overrides
criptenv set KEY=value           # Default (todas)
criptenv set KEY=value --env=dev     # Dev override
criptenv set KEY=value --env=prod    # Prod override

# Merge strategy: prod > staging > dev > default
```

#### Secrets Linking

- Possibilidade de "linkar" secret de outro projeto
- Ex: `DATABASE_URL=${shared-project.database-url}`
- Update propagates automaticamente

### 1.4 Audit Logs

#### Eventos Registrados

| Event | Data |
|-------|------|
| `secret.created` | timestamp, key, env, user |
| `secret.updated` | timestamp, key, old_hash, new_hash, user |
| `secret.deleted` | timestamp, key, user |
| `secret.viewed` | timestamp, key, user (opt-in) |
| `secret.exported` | timestamp, key, user, ip |
| `env.created` | timestamp, env_name, user |
| `member.joined` | timestamp, user, role |
| `member.removed` | timestamp, user, by |
| `project.created` | timestamp, user |
| `key.rotated` | timestamp, algorithm, user |

#### Retention

- Free tier: 30 dias
- Pro tier: 1 ano
- Enterprise: Ilimitado + export to SIEM

---

## 2. Secondary Features

### 2.1 Import/Export

#### Import Sources

```bash
criptenv import .env                    # File
criptenv import .env.production          # Named file
criptenv import --format=doppler         # Doppler export
criptenv import --format=infisical       # Infisical export
criptenv import --format=aws-secrets      # AWS Secrets Manager
criptenv import --scan                  # Scan repo for .env patterns
```

#### Export Formats

```bash
criptenv export                          # Current env as .env
criptenv export --format=github-actions   # GitHub Secrets format
criptenv export --format=vercel          # Vercel env vars
criptenv export --format=docker          # docker-compose env file
criptenv export --format=k8s             # Kubernetes secrets
```

### 2.2 Notifications

| Channel | Events |
|---------|--------|
| **Email** | Secret expiring, member joined, breach detected |
| **Slack** | Weekly digest, security alerts |
| **Webhook** | All events (configurable) |

### 2.3 Access Control (RBAC)

#### Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Full access, delete project, manage billing |
| **Admin** | Manage members, all secrets, integrations |
| **Developer** | Read/write secrets in assigned envs |
| **Viewer** | Read-only access to secrets (values masked) |
| **CI/CD** | Read-only via token, no web access |

#### Permission Matrix

| Action | Owner | Admin | Dev | Viewer | CI/CD |
|--------|-------|-------|-----|--------|-------|
| Create secret | ✅ | ✅ | ✅ (own env) | ❌ | ❌ |
| Read secret | ✅ | ✅ | ✅ (own env) | ✅ (masked) | ✅ (unmasked) |
| Update secret | ✅ | ✅ | ✅ (own env) | ❌ | ❌ |
| Delete secret | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create env | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage members | ✅ | ✅ | ❌ | ❌ | ❌ |
| View audit logs | ✅ | ✅ | ✅ | ❌ | ❌ |

### 2.4 Integrations

#### Phase 1 (MVP)

- **GitHub CLI**: `gh secret` commands aliased to CriptEnv
- **Local .env**: Auto-load em development

#### Phase 2

- **GitHub Actions**: Official action `@criptenv/action`
- **Vercel**: Native integration via API
- **Railway**: Native integration via API
- **Render**: Native integration via API
- **Docker**: Plugin for docker-compose

#### Phase 3

- **Kubernetes**: Operator for secret injection
- **Terraform Provider**: Infrastructure as Code
- **Pulumi Provider**: Dynamic secrets
- **CI Systems**: Jenkins, GitLab, Bitbucket

---

## 3. User Flows

### Flow 1: Onboarding (New User)

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Install CLI                                          │
│ $ npm install -g @criptenv/cli                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Create Account (via BetterAuth)                     │
│ $ criptenv signup                                           │
│ → Opens browser for OAuth/GitHub/Google                     │
│ → Returns to CLI with session token                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Initialize Project                                   │
│ $ criptenv init                                             │
│ → Enter project name: my-api                               │
│ → Select environments: dev, staging, prod                  │
│ → Generate encryption key (derived from master password)   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Add Secrets                                         │
│ $ criptenv set DATABASE_URL=postgres://...                  │
│ $ criptenv set API_KEY=sk-xxx...                           │
│ → CLI encrypts and stores locally                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Push to Cloud                                       │
│ $ criptenv push                                             │
│ → Uploads encrypted vault to Supabase                      │
│ → Other team members can now pull                           │
└─────────────────────────────────────────────────────────────┘
```

### Flow 2: Team Sync

```
Developer A: $ criptenv set API_KEY=new-value
Developer A: $ criptenv push
              └─→ Encrypts with project key
                  └─→ Uploads to Supabase
                      └─→ Triggers Realtime event

Developer B: (automatic on push or manual)
Developer B: $ criptenv pull
              └─→ Fetches latest from Supabase
                  └─→ Decrypts locally
                      └─→ Updates local vault
                          └─→ Updates .env file (optional)
```

### Flow 3: CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install CriptEnv
        run: npm install -g @criptenv/cli
      
      - name: Pull Secrets
        run: criptenv ci-deploy --env=production
        env:
          CRIPTENV_TOKEN: ${{ secrets.CRIPTENV_CI_TOKEN }}
      
      - name: Deploy
        run: ./deploy.sh
        # .env is now available in environment
```

---

## 4. Technical Discovery Notes

### 4.1 Encryption Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ CLIENT-SIDE (Developer Machine)                               │
│                                                               │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────────┐ │
│  │ Master Key  │────▶│ PBKDF2 (100k) │────▶│ Session Key  │ │
│  │ (password)  │     │  Derivation   │     │              │ │
│  └─────────────┘     └──────────────┘     └─────────────┘ │
│                                                   │          │
│                                                   ▼          │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────────┐  │
│  │   .env      │────▶│ AES-GCM 256  │────▶│ Encrypted   │  │
│  │   File      │     │   Encrypt    │     │   Blob      │  │
│  └─────────────┘     └──────────────┘     └─────────────┘  │
│                                                   │          │
└───────────────────────────────────────────────────┼──────────┘
                                                    │
                                                    ▼
                                       ┌──────────────────────┐
                                       │   Supabase           │
                                       │   (Blob Storage)     │
                                       │                      │
                                       │   NO plaintext!      │
                                       └──────────────────────┘
```

### 4.2 Key Hierarchy

```
Master Key (User Password)
    │
    ├── PBKDF2 → Session Key (in-memory only)
    │
    └── Key Encryption Key (KEK)
            │
            └── Project Encryption Key (wrapped)
                    │
                    └── Data Encryption Key (DEK)
                            │
                            └── Environment Secrets
```

### 4.3 Real-time Architecture

```
┌────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Supabase   │────▶│ Realtime     │────▶│ CLI Client      │
│ Database   │     │ Broadcast    │     │ (WebSocket)     │
│            │     │              │     │                 │
│ INSERT/    │     │ subscribe()  │     │ criptenv pull   │
│ UPDATE     │     │              │     │ (auto-merge)    │
└────────────┘     └──────────────┘     └─────────────────┘
```

---

## 5. Out of Scope (v1)

- Secret rotation automation
- Secret expiration/alerts
- Mobile app
- SSO/SAML (Phase 3)
- Self-hosted option (Phase 3)
- Plugin marketplace
- API management (Rate limiting)
- Secret scanning in PRs (future)
- PGP/GPG key support
- Hardware key support (YubiKey)

---

**Document Version**: 1.0  
**Status**: Discovery Complete  
**Next**: Roadmap
