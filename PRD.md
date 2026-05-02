# PRD — Product Requirements Document

## CriptEnv: Secret Management for Developers

---

## 1. Executive Summary

### O Problema: Secret Sprawl

**Secret Sprawl** é a problemática de secrets (chaves de API, credenciais de banco, tokens) espalhados por:

- Arquivos `.env` em múltiplas máquinas
- Repositórios Git (acidentalmente commitados)
- Slack, Email, WhatsApp para compartilhar com equipes
- Notas pessoais, arquivos de texto
- Variáveis de ambiente em dashboards de hospedagem
- Senhas em gerenciadores de senha genéricos (LastPass, 1Password sem contexto DevOps)

### Impacto

| Problema | Impacto Real |
|----------|-------------|
| **Data Breaches** | 2023: 75% das breaches envolveram credenciais expostas |
| **Produtividade** | Devs gastam ~2.5h/semana buscando/configurando secrets |
| **Compliance** | GDPR, SOC2, HIPAA requerem controle de acesso a secrets |
| **Cost** | Rotação manual de secrets = tempo + risco |

### Solução: CriptEnv

Plataforma de **Secret Management** com arquitetura **Zero-Knowledge** onde:

1. **Criptografia ocorre 100% no cliente** — O servidor NUNCA vê secrets em plain-text
2. **CLI-First** — Fluxo natural no terminal do desenvolvedor
3. **Web Dashboard** — Interface visual para equipes não-técnicas
4. **Audit Completo** — logs de todas as operações

### Frontend Deployment Positioning

O dashboard web será entregue com runtime compatível com Next.js via `vinext` e deploy oficial em **Cloudflare Pages + Workers**. Isso mantém o produto alinhado com a estratégia de edge hosting de baixo custo e influencia decisões de bundling, SSR e integrações frontend.

---

## 2. Target Audience

### Primary: Developers (80%)

| Persona | Descrição | Pain Points |
|---------|-----------|-------------|
| **Backend Dev** | Trabalha com múltiplos serviços, APIs, databases | Gerencia 20+ env vars por projeto |
| **Full-Stack Dev** | Alterna entre frontend e backend | Compartilha creds com equipe de forma insegura |
| **DevOps/SRE** | Mantém infraestrutura | Rotation de secrets é manual e arriscada |
| **Freelancer** | Multi-cliente sem ferramenta corporativa |-Isolar credenciais por projeto |

### Secondary: Teams (15%)

- Startups com 2-10 devs
- Open-source maintainers
- Agências digitais

### Tertiary: Enterprises (5%)

- Enterprise-ready (SSO, RBAC, Compliance)
- Future roadmap phase 3

---

## 3. Core Objectives

### OKR Framework

#### Objective 1: Eliminar Secret Sprawl

- **KR1**: Reduzir tempo de setup de novo ambiente de 45min para 5min
- **KR2**: 100% dos secrets de projeto em criptografia Zero-Knowledge
- **KR3**: Zero secrets em plain-text em repositórios Git (detecção automática)

#### Objective 2: Melhorar Segurança

- **KR1**: 100% dos secrets transmitidos com AES-GCM 256-bit
- **KR2**: Audit logs cobrindo 100% das operações de secret
- **KR3**: 2FA enabled por padrão para todos os usuários

#### Objective 3: Aumentar Produtividade

- **KR1**: Comandos CLI completos em < 500ms
- **KR2**: Sync de secrets entre equipe em < 2s
- **KR3**: Onboarding de novo dev em novo projeto em < 10min

---

## 4. Success Metrics

### North Star Metric

```
NSM = (Secrets Criptografados / Total Secrets Gerenciados) × 100
Target: > 95% em 6 meses
```

### KPIs by Phase

| Métrica | Phase 1 (MVP) | Phase 2 (Web) | Phase 3 (CI/CD) |
|---------|---------------|---------------|------------------|
| **DAU** (Developers) | 50 | 500 | 5,000 |
| **Secrets managed** | 10,000 | 100,000 | 1,000,000 |
| **Teams created** | 20 | 200 | 2,000 |
| **CLI installs** | 500 | 5,000 | 50,000 |
| **GitHub stars** | 100 | 1,000 | 10,000 |
| **Avg session duration** | 5 min | 15 min | 30 min |

### Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Uptime | 99.9% | Monitoring |
| CLI response time | < 500ms p95 | APM |
| Encryption latency | < 100ms | Client-side |
| Zero security incidents | 0 breaches | Security audit |
| NPS Score | > 50 | User survey |

---

## 5. Competitive Landscape

### Comparativo

| Feature | CriptEnv | Doppler | Infisical | HashiCorp Vault |
|---------|----------|---------|-----------|----------------|
| **Pricing** | Free/Open | $6/seat | Free tier | Self-hosted |
| **Zero-Knowledge** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **CLI-First** | ✅ Yes | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial |
| **Self-Hosted** | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |
| **Encryption** | AES-GCM 256 | AES-256 | AES-256 | Multiple |
| **Audit Logs** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Open Source** | ✅ MIT | ❌ No | ⚠️ Partial | ✅ Yes |

### Diferencial Principal

> **Zero-Knowledge Real**: Criptografia acontece 100% no cliente. O servidor Supabase armazena apenas blobs criptografados. Mesmo com acesso completo ao banco, attackers NUNCA conseguem descriptografar secrets.

---

## 6. Product Vision

### Tagline

**"Secrets seguros, equipe feliz, zero debug."**

### Elevator Pitch

> CriptEnv é a ferramenta de gestão de secrets que criptografa seus arquivos `.env` antes mesmo de sair do seu computador. Compartilhe com sua equipe sem medo de exponha credenciais. Zero-knowledge significa que nem mesmo o servidor consegue ver seus secrets.

### 3-Year Vision

- **Year 1**: Líder em CLI de secret management open source
- **Year 2**: Plataforma completa com Web UI e integrações enterprise
- **Year 3**: 100k+ desenvolvedores, enterprise-ready com SSO/SAML

---

## 7. Constraints & Assumptions

### Technical Constraints

| Constraint | Impact |
|------------|--------|
| Supabase free tier | Limite de 500MB database, 2GB transfer |
| Zero-knowledge architecture | Não há "forgot password" para secrets |
| Browser-only encryption key derivation | Performance mobile limitada |
| Frontend em Cloudflare Pages + Workers | Requer compatibilidade com runtime Workers e build baseado em Vite/vinext |

### Business Assumptions

| Assumption | Risk |
|-----------|------|
| Devs preferem CLI sobre GUI | Medium — validar com user research |
| Zero-knowledge é vendável | Low — mercado já valida com 1Password |
| Open source足够的 adoption | High — depends on community |

### Non-Goals (v1)

- Mobile app nativo
- Secret rotation automation
- SSO/SAML (Phase 3)
- Plugin ecosystem

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| **Secret** | Qualquer valor sensível: API key, password, token, certificate |
| **Environment** | Conjunto de secrets para um contexto (dev, staging, prod) |
| **Project** | Coleção de environments para uma aplicação |
| **Zero-Knowledge** | Arquitetura onde servidor nunca vê dados descriptografados |
| **Secret Sprawl** | Problema de secrets espalhados sem controle centralizado |

### References

- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [1Password Security Model](https://1password.com/security/)
- [Doppler Docs](https://docs.doppler.com/)
- [Infisical Architecture](https://infisical.com/docs)

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Owner**: CriptEnv Team
