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

```bash
# Instalar CLI
npm install -g @criptenv/cli

# Inicializar projeto
criptenv init

# Adicionar secrets
criptenv set DATABASE_URL=postgres://...

# Sincronizar com equipe
criptenv push

# Puxar secrets do time
criptenv pull
```

## 🏗️ Arquitetura Tech Stack

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | Next.js 14 + Vinext + TailwindCSS + Pug |
| **Backend** | Python FastAPI |
| **Database** | Supabase (PostgreSQL + Realtime) |
| **Auth** | BetterAuth |
| **Encryption** | AES-GCM 256-bit (Zero-Knowledge) |

## 📂 Estrutura do Projeto

```
criptenv/
├── prd/                    # Product Requirements Document
├── discovery/              # Product Discovery
├── roadmap/                # Roadmap de fases
├── specs/                  # Especificações Técnicas
│   ├── architecture/       # Diagramas de arquitetura
│   ├── endpoints/          # FastAPI endpoints
│   ├── database/           # Schema Supabase
│   └── encryption/         # Protocolo de criptografia
├── user-stories/           # User stories
└── guidelines/             # Diretrizes de design
```

## 🔒 Segurança

- **Zero-Knowledge**: O servidor NUNCA tem acesso aos secrets descriptografados
- **AES-GCM 256-bit**: Criptografia militar para todos os dados
- **Audit Logs**: Rastreabilidade completa de todas as operações
- **2FA Support**: Suporte a autenticação em dois fatores via BetterAuth

## 📦 Deploy Zero-Cost

| Serviço | Plano | Uso |
|---------|-------|-----|
| Supabase | Free Tier | PostgreSQL + Auth + Realtime |
| FastAPI | Railway/Render | Serverless Python |
| Frontend | Vercel/Cloudflare | Edge Deployment |
| CLI | npm Global | Distribuição |

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
