# 🔐 CriptEnv

**Secret Management for Developers** — Uma alternativa Open Source a Doppler e Infisical, projetada para gerenciar arquivos `.env` criptografados e chaves de API com arquitetura Zero-Knowledge.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.11+-green.svg)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## 🎯 Problema

**Secret Sprawl** — O problema de variáveis de ambiente e secrets espalhados por múltiplas plataformas, arquivos plain-text, repositórios Git e equipes sem controle centralizado.

### Solução

CriptEnv oferece:

- 🔒 **Zero-Knowledge Encryption** — Seus secrets nunca saem do seu dispositivo sem criptografia AES-GCM 256-bit
- ⚡ **CLI-First** — Fluxo de trabalho direto no terminal
- 🌐 **Web Dashboard** — Interface visual para equipes
- 📋 **Audit Logs** — Trilha completa de auditoria
- 🔄 **Sync de Equipe** — Compartilhamento seguro sem exposição de plain-text

## 🚀 Quick Start

### CLI

```bash
# Instalar CLI
cd apps/cli && pip install -e .

# Inicializar (cria ~/.criptenv/, pede master password)
criptenv init

# Login no servidor
criptenv login --email user@example.com

# Adicionar secrets (encriptados localmente com AES-256-GCM)
criptenv set DATABASE_URL=postgres://...
criptenv set API_KEY=secret123

# Listar secrets (apenas nomes, valores nunca expostos)
criptenv list

# Obter valor decriptado
criptenv get DATABASE_URL

# Importar de arquivo .env
criptenv import .env

# Exportar para .env
criptenv export -o .env.exported

# Sincronizar com cloud
criptenv push -p <project-id>
criptenv pull -p <project-id>

# Diagnóstico
criptenv doctor
```

### Web Dashboard

```bash
cd apps/web && npm install && npm run dev
```

Ou pela raiz:

```bash
make web-dev
```

### Backend API

```bash
cd apps/api && pip install -r requirements.txt && uvicorn main:app --reload
```

## 🏗️ Tech Stack

| Camada          | Tecnologia                                        |
| --------------- | ------------------------------------------------- |
| **CLI**         | Python Click + cryptography + httpx + aiosqlite   |
| **Frontend**    | Vinext (API Next.js 16 em Vite) + React 19 + TailwindCSS v4 + Radix UI |
| **Backend**     | FastAPI + SQLAlchemy async + asyncpg              |
| **Database**    | PostgreSQL                                        |
| **Auth**        | Custom session tokens (JWT-like)                  |
| **Encryption**  | AES-256-GCM + PBKDF2HMAC + HKDF (Zero-Knowledge)  |
| **Local Vault** | SQLite (~/.criptenv/vault.db)                     |

## 📂 Estrutura do Projeto

```
criptenv/
├── apps/
│   ├── cli/                  # CLI (Python + Click)
│   │   ├── src/criptenv/     # Source code
│   │   │   ├── commands/     # CLI commands (init, login, set, get, etc.)
│   │   │   ├── crypto/       # AES-256-GCM encryption module
│   │   │   ├── vault/        # Local SQLite vault
│   │   │   ├── api/          # HTTP client for backend API
│   │   │   └── session.py    # Encrypted session management
│   │   └── tests/            # 93 unit tests
│   ├── api/                  # Backend API (FastAPI)
│   └── web/                  # Web Dashboard (Vinext/App Router)
├── docs/                     # Documentation
│   ├── phase-1/              # CLI implementation plan & milestones
│   └── development/          # Changelog, phase reviews
├── plans/                    # Implementation plans
├── prd/                      # Product Requirements Document
├── roadmap/                  # Roadmap de fases
└── specs/                    # Technical specifications
```

## 🔒 Segurança

- **Zero-Knowledge**: O servidor NUNCA tem acesso aos secrets descriptografados
- **AES-256-GCM**: Criptografia de 256 bits para todos os dados
- **PBKDF2HMAC**: 100.000 iterações para derivação de chave mestra
- **HKDF**: Chaves por ambiente derivadas da chave mestra
- **Audit Logs**: Rastreabilidade completa de todas as operações
- **Local Vault**: Secrets encriptados no SQLite local, nunca em plain-text

## 📦 Deploy

| Serviço    | Plano                      | Uso                            | Custo |
| ---------- | -------------------------- | ------------------------------ | ----- |
| PostgreSQL | Supabase Free Tier         | Database (permanente, 500MB)   | **$0** |
| FastAPI    | VPS Docker + Nginx Proxy Manager | Backend API via DuckDNS + Let's Encrypt | VPS existente |
| Redis      | VPS Docker                 | Rate limit counters            | VPS existente |
| Frontend   | Cloudflare Pages + Workers | Vinext + Worker proxy `/api/*` | **$0** |
| CLI        | PyPI                       | Distribuição via pip           | Grátis para usuários |

O deploy antigo da API no Render Free Tier fica apenas como rollback/legado. A integração Render do produto continua existindo para sincronizar secrets com contas Render de usuários.

## 📚 Documentação

> ⚠️ **Nova documentação organizada disponível em [`./docs/index.md`](./docs/index.md)** — Fonte da verdade para desenvolvedores e agentes de IA.

### Documentação Principal

- [Documentação Index](./docs/index.md) — Índice completo da documentação
- [Estado Atual](./docs/project/current-state.md) — O que está implementado, em progresso, pendente
- [Arquitetura](./docs/project/architecture.md) — Visão geral do sistema
- [Tech Stack](./docs/tech-stack.md) — Tecnologias utilizadas
- [Decisões Técnicas](./docs/project/decisions.md) — Log de decisões (ADR)
- [Tarefa Atual](./docs/tasks/current-task.md) — O que trabalhar agora

### Documentação Legada (em transição)

- [PRD](./prd/README.md) — Product Requirements Document
- [Discovery](./discovery/README.md) — Descoberta do Produto
- [Roadmap](./roadmap/README.md) — Plano de Execução
- [Specs](./specs/README.md) — Especificações Técnicas
- [User Stories](./user-stories/README.md) — Journey Maps
- [Guidelines](./guidelines/README.md) — Diretrizes de Design

### Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 (CLI MVP) | ✅ COMPLETE | 14 commands, AES-256-GCM, local vault |
| Phase 2 (Web UI) | ✅ COMPLETE | Dashboard, auth, CRUD, audit |
| Phase 3 (CI/CD) | 🔄 IN PROGRESS | GitHub Action, rotation, cloud integrations |
| Phase 4 (Enterprise) | 📋 PLANNED | SSO/SAML, SCIM, self-hosted |

## 🤝 Contributing

Contribuições são bem-vindas! Por favor, leia o [CONTRIBUTING.md](./CONTRIBUTING.md) para detalhes.

## 📄 License

MIT License — see [LICENSE](./LICENSE) for details.

---

**Built with 🔒 by developers, for developers.**
