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

### Backend API

```bash
cd apps/api && pip install -r requirements.txt && uvicorn main:app --reload
```

## 🏗️ Tech Stack

| Camada          | Tecnologia                                        |
| --------------- | ------------------------------------------------- |
| **CLI**         | Python Click + cryptography + httpx + aiosqlite   |
| **Frontend**    | Next.js 16 + React 19 + TailwindCSS v4 + Radix UI |
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
│   └── web/                  # Web Dashboard (Next.js)
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

| Serviço    | Plano                      | Uso                            |
| ---------- | -------------------------- | ------------------------------ |
| PostgreSQL | Free Tier                  | Database                       |
| FastAPI    | Railway/Render             | Backend API                    |
| Frontend   | Cloudflare Pages + Workers | Edge Deployment                |
| CLI        | pip install                | Distribuição via PyPI (futuro) |

## 📚 Documentação

- [PRD](./prd/README.md) — Product Requirements Document
- [Discovery](./discovery/README.md) — Descoberta do Produto
- [Roadmap](./roadmap/README.md) — Plano de Execução
- [Specs](./specs/README.md) — Especificações Técnicas
- [User Stories](./user-stories/README.md) — Journey Maps
- [Guidelines](./guidelines/README.md) — Diretrizes de Design

## 🤝 Contributing

Contribuições são bem-vindas! Por favor, leia o [CONTRIBUTING.md](./CONTRIBUTING.md) para detalhes.

## 📄 License

MIT License — see [LICENSE](./LICENSE) for details.

---

**Built with 🔒 by developers, for developers.**
