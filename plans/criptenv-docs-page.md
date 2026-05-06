# Plano: Página de Documentação CriptEnv

> Inspirada no design da AbacatePay (docs.abacatepay.com), adaptada para a identidade
> visual do CriptEnv e aprofundada com todo o conteúdo técnico da plataforma.

---

## 1. Análise do Design da AbacatePay (Referência)

### O que a AbacatePay faz bem e vamos replicar:

| Elemento                  | AbacatePay                                      | CriptEnv (adaptação)                                    |
|---------------------------|-------------------------------------------------|---------------------------------------------------------|
| **Tema**                  | Dark-mode (fundo #1a1a1a)                       | Dark-mode (nosso padrão, --background escuro)           |
| **Cor de destaque**       | Verde brilho (marca)                            | Verde/Cyan (criptografia, segurança)                    |
| **Layout**                | 3 colunas: sidebar + conteúdo + TOC             | Idêntico: sidebar esquerda + conteúdo central + TOC dir |
| **Cards**                 | Bordas sutis, cantos arredondados, bg mais claro| Idêntico, com nossos tokens de cor                      |
| **Ícones**                | Monocromáticos line (cor de destaque)           | Lucide icons line (nossa cor primária)                  |
| **Badges HTTP**           | Texto verde em caixa alta (POST, GET)           | Idêntico, com cores por método                          |
| **Blocos de código**      | Fundo mais escuro, botão copiar, syntax highlight| Idêntico (Shiki/rehype-pretty-code)                    |
| **Callout/Alertas**       | Caixas com ícone + borda colorida               | Idêntico (tip, warning, danger, info)                   |
| **Tabelas**               | Bordas sutis, linhas alternadas                 | Idêntico                                               |
| **Busca**                 | Ctrl+K, modal centralizado                      | Idêntico (Algolia DocSearch ou Pagefind)                |
| **Navegação superior**    | Tabs por seção (Comece aqui, Guias, Referência) | Tabs: Início, CLI, API, SDKs, Guias, Segurança         |
| **Footer**                | Social links + powered by                       | Links úteis + GitHub + Discord + MIT License             |
| **Breadcrumb**            | Seção > Página no topo do conteúdo              | Idêntico                                               |
| **Steps numerados**       | Passo a passo com screenshots                   | Idêntico, com screenshots do dashboard                  |

---

## 2. Stack Tecnológico da Documentação

Escolheremos uma das duas opções (recomendo a Opção A):

### Opção A: Mintlify (mesmo da AbacatePay) ✅ RECOMENDADO
- **Prós**: Pronto para uso, dark mode nativo, busca integrada, suporte a MDX,
  API reference automática via OpenAPI, deploy no Mintlify Cloud ou self-hosted
- **Contras**: Lock-in parcial, limitações no plano gratuito
- **Custo**: Free até 1 editor, $150/mês para teams

### Opção B: Fumadocs (Next.js nativo)
- **Prós**: Totalmente customizável, roda dentro do nosso Vinext/Next.js,
  sem dependência externa, open-source
- **Contras**: Mais trabalho manual para features como busca, versionamento
- **Custo**: $0 (open-source)

### Decisão: Opção B (Fumadocs) ou Docusaurus
Como o CriptEnv é open-source e queremos total controle do design,
vamos construir com Fumadocs ou uma implementação custom em Next.js.
Isso nos permite replicar exatamente o design da AbacatePay sem lock-in.

---

## 3. Estrutura de Arquivos

```
apps/web/src/app/(docs)/
├── layout.tsx                    # Layout da documentação (sidebar + TOC)
├── page.tsx                      # Página inicial da docs (welcome)
├── globals.css                   # Estilos específicos das docs
│
├── getting-started/
│   ├── page.tsx                  # Visão geral (Welcome)
│   ├── quickstart/
│   │   └── page.tsx              # Guia rápido (5 min)
│   ├── installation/
│   │   └── page.tsx              # Instalação do CLI
│   └── concepts/
│       └── page.tsx              # Conceitos fundamentais
│
├── cli/
│   ├── page.tsx                  # Visão geral do CLI
│   ├── commands/
│   │   ├── page.tsx              # Referência de comandos
│   │   ├── init.mdx
│   │   ├── login-logout.mdx
│   │   ├── set-get-list-delete.mdx
│   │   ├── push-pull.mdx
│   │   ├── rotate.mdx
│   │   ├── import-export.mdx
│   │   ├── doctor.mdx
│   │   └── ci.mdx
│   └── configuration/
│       └── page.tsx              # Configuração do CLI
│
├── api/
│   ├── page.tsx                  # Visão geral da API (Base URL, Auth, Response Format)
│   ├── authentication/
│   │   └── page.tsx              # Session, API Keys, CI Tokens, OAuth
│   ├── projects/
│   │   └── page.tsx              # CRUD de projetos
│   ├── environments/
│   │   └── page.tsx              # CRUD de ambientes
│   ├── vault/
│   │   └── page.tsx              # Push/Pull de secrets
│   ├── members/
│   │   └── page.tsx              # Gestão de membros
│   ├── invites/
│   │   └── page.tsx              # Sistema de convites
│   ├── audit/
│   │   └── page.tsx              # Logs de auditoria
│   ├── rotation/
│   │   └── page.tsx              # Rotação de secrets
│   ├── integrations/
│   │   └── page.tsx              # Vercel, Railway, Render
│   ├── ci-tokens/
│   │   └── page.tsx              # CI/CD Tokens
│   └── health/
│       └── page.tsx              # Health & Readiness
│
├── security/
│   ├── page.tsx                  # Visão geral de segurança
│   ├── encryption/
│   │   └── page.tsx              # Protocolo de criptografia
│   ├── zero-knowledge/
│   │   └── page.tsx              # Arquitetura zero-knowledge
│   └── threat-model/
│       └── page.tsx              # Modelo de ameaças
│
├── integrations/
│   ├── page.tsx                  # Visão geral
│   ├── github-action/
│   │   └── page.tsx              # GitHub Action
│   ├── vercel/
│   │   └── page.tsx              # Vercel integration
│   ├── railway/
│   │   └── page.tsx              # Railway integration
│   └── render/
│       └── page.tsx              # Render integration
│
├── sdks/
│   ├── page.tsx                  # Visão geral dos SDKs
│   ├── javascript/
│   │   └── page.tsx              # SDK JavaScript/TypeScript
│   └── python/
│       └── page.tsx              # SDK Python
│
└── guides/
    ├── page.tsx                  # Índice de guias
    ├── first-project/
    │   └── page.tsx              # Seu primeiro projeto
    ├── team-setup/
    │   └── page.tsx              # Configurar time
    ├── cicd-setup/
    │   └── page.tsx              # CI/CD com CriptEnv
    ├── secret-rotation/
    │   └── page.tsx              # Rotação de secrets
    └── migration/
        └── page.tsx              # Migrando do .env / Doppler / Infisical
```

---

## 4. Componentes de Design a Construir

### 4.1 Layout da Documentação (`(docs)/layout.tsx`)

```
┌─────────────────────────────────────────────────────────────┐
│  NAVBAR FIXA (logo, versão, busca Ctrl+K, links externos)  │
├────────┬──────────────────────────────────┬─────────────────┤
│        │                                  │                 │
│ SIDEBAR│     CONTEÚDO PRINCIPAL           │  TOC DIREITA    │
│ (fixa) │     (scrollável, max-w-3xl)      │  "Nesta página" │
│        │                                  │  (sticky)       │
│ - Logo │  Breadcrumb > Título             │                 │
│ - Nav  │  Conteúdo MDX                    │  - Seção 1      │
│   hier.│  Cards, tabelas, código          │  - Seção 2      │
│        │  Callouts, steps                 │  - Seção 3      │
│        │                                  │                 │
├────────┴──────────────────────────────────┴─────────────────┤
│  FOOTER (prev/next, social links, copyright)                │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Componentes UI Específicos da Docs

| Componente              | Descrição                                              | Referência AbacatePay    |
|-------------------------|--------------------------------------------------------|--------------------------|
| `<DocSidebar />`        | Sidebar com navegação hierárquica, grupos colapsáveis  | Sidebar esquerda         |
| `<DocTOC />`            | Table of Contents sticky com scroll spy                | Sidebar direita          |
| `<CodeBlock />`         | Bloco de código com syntax highlight + botão copiar     | Todos os exemplos        |
| `<EndpointBadge />`     | Badge colorido por método HTTP (GET/POST/PATCH/DELETE) | Sidebar API reference    |
| `<Callout />`           | Caixa de alerta (tip, warning, danger, info)           | Caixas verdes/vermelhas  |
| `<Card />`              | Card clicável com ícone, título, descrição             | Grids de features        |
| `<CardGrid />`          | Grid responsivo de cards (2-3 colunas)                 | Seções "O que fazer"     |
| `<Steps />`             | Lista numerada de passos                               | "Como criar chave API"   |
| `<Tabs />`              | Tabs para exemplos em múltiplas linguagens             | curl/JS/Python           |
| `<ParamTable />`        | Tabela de parâmetros da API                            | Referência de endpoints  |
| `<ResponseBlock />`     | Bloco de resposta da API com type hints                | Exemplos de resposta     |
| `<SearchModal />`       | Modal de busca (Ctrl+K)                                | Busca global             |
| `<Bleed />`             | Container que ultrapassa largura do conteúdo           | Diagramas                |
| `<Accordion />`         | Seções colapsáveis (FAQ)                               | FAQ                      |

### 4.3 Paleta de Cores (Docs)

```css
/* Modo escuro (padrão) */
--docs-bg:           #0a0a0b;       /* Fundo principal */
--docs-surface:      #141416;       /* Cards, sidebar */
--docs-surface-2:    #1c1c1f;       /* Hover states */
--docs-border:       #2a2a2e;       /* Bordas sutis */
--docs-text:         #e4e4e7;       /* Texto principal */
--docs-text-muted:   #71717a;       /* Texto secundário */
--docs-accent:       #22c55e;       /* Verde (criptografia, segurança) */
--docs-accent-muted: #16a34a;       /* Verde hover */
--docs-code-bg:      #0d0d0f;       /* Fundo de blocos de código */
--docs-info:         #3b82f6;       /* Callout info */
--docs-warning:      #eab308;       /* Callout warning */
--docs-danger:       #ef4444;       /* Callout danger */
--docs-success:      #22c55e;       /* Callout success */

/* Badges HTTP */
--http-get:          #22c55e;       /* GET - verde */
--http-post:         #3b82f6;       /* POST - azul */
--http-patch:        #eab308;       /* PATCH - amarelo */
--http-delete:       #ef4444;       /* DELETE - vermelho */
```

---

## 5. Conteúdo de Cada Página

### 5.1 Página Inicial (`/docs`)

**Estrutura (igual AbacatePay Welcome):**

1. **Hero**
   - Título: "Documentação do CriptEnv"
   - Subtitle: "Tudo que você precisa para gerenciar secrets com segurança de nível militar."
   - Callout: "Índice da documentação disponível em /llms.txt"

2. **O que é o CriptEnv?**
   - Explicação concisa + diagrama de arquitetura simplificado
   - Bloco de código: exemplo rápido (criptenv set/get)

3. **Princípios da API**
   - Card: "Zero-Knowledge" — Secrets criptografados 100% client-side
   - Card: "Consistente" — CLI e API com mesma semântica

4. **O que você pode fazer** (grid de 9 cards)
   - Gerenciar secrets via CLI
   - Sincronizar com cloud (push/pull)
   - Gerenciar times e permissões
   - Configurar CI/CD
   - Integrar com Vercel/Railway/Render
   - Rotacionar secrets automaticamente
   - Auditar todas as operações
   - Importar/exportar .env
   - Monitorar expirações

5. **Primeiros passos** (grid de 4 cards)
   - Instalação do CLI
   - Seu primeiro projeto
   - Configurar CI/CD
   - Entender a criptografia

6. **Saiba mais** (grid de 3 cards)
   - Guia de segurança
   - API Reference
   - GitHub (open-source)

---

### 5.2 Getting Started

#### `getting-started/quickstart` — Guia Rápido (5 min)

```markdown
# Guia Rápido

<Callout type="info">
Em 5 minutos você terá seus primeiros secrets gerenciados pelo CriptEnv.
</Callout>

## 1. Instale o CLI

<Tabs items={["macOS", "Linux", "Windows", "pip"]}>
  <Tab>
    brew install criptenv/tap/criptenv
  </Tab>
  <Tab>
    curl -fsSL https://criptenv.dev/install.sh | sh
  </Tab>
  <Tab>
    scoop install criptenv
  </Tab>
  <Tab>
    pip install criptenv
  </Tab>
</Tabs>

## 2. Inicialize

criptenv init

## 3. Crie um projeto

criptenv projects create "Meu Projeto"

## 4. Defina um secret

criptenv set DATABASE_URL=postgresql://localhost/mydb
criptenv set API_KEY=sk-abc123

## 5. Liste seus secrets

criptenv list

## 6. Obtenha um secret

criptenv get DATABASE_URL
```

#### `getting-started/concepts` — Conceitos Fundamentais

- **Zero-Knowledge**: O que significa, por que importa
- **Projetos**: Unidade de organização, cada um com vault próprio
- **Ambientes**: development, staging, production
- **Vault**: Cofre criptografado (local + cloud)
- **Master Password vs Vault Password**: Diferenças e uso
- **Push/Pull**: Sincronização local ↔ cloud

---

### 5.3 CLI Reference (`/docs/cli`)

#### Visão Geral
- O que é o CLI, filosofia, instalação
- Estrutura de comandos

#### Referência de Comandos (página detalhada por comando)

Cada comando documentado com:
1. Descrição
2. Uso (sintaxe)
3. Opções (tabela)
4. Exemplos (blocos de código)
5. Comportamento (o que acontece internamente)
6. Saída esperada
7. Erros comuns

**Exemplo de documentação de um comando:**

```markdown
# `criptenv set`

<EndpointBadge method="CLI" /> Define ou atualiza um secret. O valor é
criptografado localmente antes de ser armazenado.

## Uso

criptenv set KEY=VALUE [opções]

## Opções

| Opção | Curta | Descrição | Padrão |
|-------|-------|-----------|--------|
| --env | -e | Nome ou ID do ambiente | "default" |
| --project | -p | Nome ou ID do projeto | (prompt) |

## Exemplos

criptenv set DATABASE_URL=postgresql://localhost/mydb
criptenv set API_KEY=sk-abc123 -e production -p meu-projeto

## Comportamento

1. Deriva a chave do ambiente via HKDF a partir da master key
2. Gera IV aleatório de 12 bytes
3. Criptografa o valor com AES-256-GCM
4. Calcula SHA-256 do plaintext para checksum
5. Armazena (ciphertext, iv, auth_tag, checksum) no vault local
6. Se o secret já existe, incrementa a versão

## Erros comuns

<Callout type="danger">
**Vault não inicializado**: Execute `criptenv init` primeiro.
</Callout>
```

---

### 5.4 API Reference (`/docs/api`)

#### Página de Introdução (igual AbacatePay)

```markdown
# Referência da API

## Base URL
https://api.criptenv.dev/v1

<Callout type="info">
O ambiente (desenvolvimento/produção) é determinado pelo tipo de token,
não pela URL.
</Callout>

## Autenticação

Authorization: Bearer SUA_CHAVE_API

### Tipos de Token

| Tipo | Prefixo | TTL | Uso |
|------|---------|-----|-----|
| Session Token | - | 30 dias | Web dashboard |
| API Key | cek_ | Configurável | API pública |
| CI Token | ci_ | 1 hora | CI/CD pipelines |

## Formato de Resposta

### Sucesso
{
  "data": { ... },
  "success": true,
  "error": null
}

### Erro
{
  "data": null,
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API key",
    "request_id": "req_abc123"
  }
}

## Códigos de Status HTTP

| Código | Significado |
|--------|------------|
| 200 | Sucesso |
| 201 | Criado |
| 204 | Sem conteúdo (delete) |
| 400 | Requisição inválida |
| 401 | Não autenticado |
| 403 | Sem permissão |
| 404 | Não encontrado |
| 409 | Conflito de versão (vault) |
| 422 | Erro de validação |
| 429 | Rate limit |
| 5xx | Erro interno |

## Dicas Gerais

<CardGrid cols={2}>
  <Card title="Use tokens de teste" icon="beaker">
    Tokens CI com scope limitado para ambientes de staging.
  </Card>
  <Card title="Armazene em variáveis de ambiente" icon="key">
    Nunca commite chaves de API no código.
  </Card>
  <Card title="Idempotência" icon="refresh">
    Vault push suporta detecção de conflitos por versão.
  </Card>
  <Card title="Webhooks" icon="bell">
    Configure webhooks para receber alertas de expiração.
  </Card>
</CardGrid>
```

#### Cada Endpoint (ex: Vault Push)

Documentado com:
- Método HTTP + path
- Descrição
- Parâmetros de path/query (tabela)
- Body da requisição (JSON schema)
- Exemplo de request (curl, JS, Python em tabs)
- Resposta de sucesso (JSON)
- Resposta de erro (JSON)
- Códigos de erro específicos
- Permissões necessárias

---

### 5.5 Segurança (`/docs/security`)

#### Encryption Protocol

```markdown
# Protocolo de Criptografia

## Fluxo de Derivação de Chaves

Diagrama visual do fluxo:
Master Password → PBKDF2 → Master Key → HKDF → Environment Key → AES-256-GCM

## Parâmetros

| Algoritmo | Parâmetro | Valor |
|-----------|-----------|-------|
| PBKDF2 | Iterações | 100.000 |
| PBKDF2 | Hash | SHA-256 |
| PBKDF2 | Salt | 32 bytes aleatórios |
| HKDF | Hash | SHA-256 |
| HKDF | Info | "criptenv-vault-v1" |
| AES-GCM | Key size | 256 bits |
| AES-GCM | IV | 12 bytes (único por operação) |
| AES-GCM | Auth tag | 128 bits |

## Propriedades de Segurança

- **Confidencialidade**: AES-256-GCM (AEAD)
- **Integridade**: GCM auth tag
- **Forward Secrecy**: Session keys não persistidas
- **Resistência a força bruta**: 100k iterações PBKDF2

## Modelo de Ameaças

| Cenário | Risco | Mitigação |
|---------|-------|-----------|
| Banco de dados comprometido | IMPOSSível descriptografar | Server só tem ciphertext |
| Admin malicioso | Sem acesso a plaintext | Zero-knowledge |
| MITM | Só vê ciphertext | TLS 1.3 + blobs criptografados |
| XSS no frontend | Session token exposto | HttpOnly cookies (planejado) |
```

---

### 5.6 Integrações (`/docs/integrations`)

#### GitHub Action

```markdown
# GitHub Action

O `@criptenv/action` exporta seus secrets como variáveis de ambiente
no GitHub Actions.

## Configuração

1. Crie um CI Token no dashboard ou via CLI
2. Adicione como secret do GitHub: CRIPTENV_TOKEN
3. Use o action no workflow:

```yaml
- uses: criptenv/action@v1
  with:
    token: ${{ secrets.CRIPTENV_TOKEN }}
    environment: production
```

## Variáveis de ambiente exportadas

Cada secret do CriptEnv é exportado como:
- `CRIPTENV_SECRET_KEY` (maiúsculo, prefixo CRIPTENV_)
- Ou diretamente como `KEY` (configurável)
```

---

### 5.7 Guias (`/docs/guides`)

| Guia                        | Descrição                                         |
|-----------------------------|---------------------------------------------------|
| Seu primeiro projeto        | Passo a passo completo com screenshots            |
| Configurar time             | Convites, roles, permissões                       |
| CI/CD com CriptEnv          | GitHub Actions, GitLab CI, CircleCI               |
| Rotação de secrets          | Políticas manual/notify/auto                      |
| Migrando do .env            | Importação automática                             |
| Migrando do Doppler         | Script de migração                                |
| Migrando do Infisical       | Script de migração                                |
| Best practices              | Organização de projetos, naming conventions        |
| Self-hosting                | Deploy do backend em infra própria                |

---

## 6. Funcionalidades Interativas

### 6.1 Busca (Ctrl+K)
- Pagefind (open-source, estático) ou Algolia DocSearch
- Indexa todo o conteúdo MDX
- Modal centralizado com preview de resultados

### 6.2 Playground de API (futuro)
- Sandbox interativo para testar endpoints
- Input de API key, seleção de endpoint, visualização de resposta

### 6.3 Versionamento
- Seletor de versão no navbar (v1, v2)
- Rotas versionadas: /docs/v1/, /docs/v2/

### 6.4 Feedback
- "Esta página foi útil?" (sim/não) no final de cada página
- Link para abrir issue no GitHub

---

## 7. SEO e Descobribilidade

### 7.1 llms.txt
- Arquivo `/llms.txt` listando todas as páginas da docs
- Facilita descoberta por LLMs e agentes de IA

### 7.2 Sitemap
- `/sitemap.xml` gerado automaticamente

### 7.3 Open Graph
- Meta tags para compartilhamento social
- Screenshots gerados automaticamente por página

---

## 8. Deploy

### Estratégia
1. **Desenvolvimento**: Rota `/docs` no app Vinext existente (port 3000)
2. **Produção**: Cloudflare Pages (mesmo domínio do frontend)
3. **Domínio**: `docs.criptenv.dev` ou `criptenv.dev/docs`

### Performance
- Static generation (SSG) para todas as páginas de docs
- ISR (Incremental Static Regeneration) para atualizações
- Edge caching no Cloudflare

---

## 9. Cronograma de Implementação

### Fase 1: Fundação (Semana 1)
- [ ] Configurar rota `(docs)` no Vinext
- [ ] Implementar layout (sidebar + conteúdo + TOC)
- [ ] Implementar componentes base (CodeBlock, Callout, Card, Steps, Tabs)
- [ ] Configurar MDX/Contentlayer para processamento de markdown
- [ ] Página inicial (Welcome)

### Fase 2: Conteúdo CLI (Semana 2)
- [ ] Documentar todos os 30+ comandos CLI
- [ ] Guia de instalação (multi-platforma)
- [ ] Quickstart (5 min)
- [ ] Conceitos fundamentais

### Fase 3: Conteúdo API (Semana 3)
- [ ] Documentar todos os ~50 endpoints
- [ ] Authentication reference
- [ ] Error codes reference
- [ ] Rate limiting reference
- [ ] Exemplos em curl, JavaScript, Python

### Fase 4: Segurança + Integrações (Semana 4)
- [ ] Protocolo de criptografia (com diagramas)
- [ ] Zero-knowledge architecture
- [ ] Threat model
- [ ] GitHub Action guide
- [ ] Vercel/Railway/Render guides

### Fase 5: Guias + Polish (Semana 5)
- [ ] Todos os guias práticos
- [ ] Busca (Ctrl+K)
- [ ] SEO (llms.txt, sitemap, OG tags)
- [ ] Feedback por página
- [ ] Testes cross-browser
- [ ] Deploy em produção

---

## 10. Decisões Técnicas

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Framework | Vinext (existente) | Consistência com o app principal |
| Processamento MDX | Contentlayer ou @next/mdx | Suporte a componentes React no markdown |
| Syntax highlight | Shiki (via rehype-pretty-code) | Qualidade VS Code, dark mode nativo |
| Busca | Pagefind | Open-source, estático, sem custo |
| Ícones | Lucide React | Já usado no projeto |
| Animações | Framer Motion | Já usado no projeto |
| Diagramas | Mermaid ou Excalidraw | Renderizado no browser, interativo |

---

## 11. Métricas de Sucesso

- [ ] Todas as páginas documentadas (>50 páginas)
- [ ] Tempo de carga < 2s (Lighthouse score > 90)
- [ ] Busca funcional com Ctrl+K
- [ ] Responsivo (mobile-first)
- [ ] Acessível (WCAG AA)
- [ ] Zero erros de build
- [ ] Feedback positivo dos primeiros usuários
