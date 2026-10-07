# Plano — Internacionalização (pt-BR · en · es)

**Branch:** `feature/i18n-support`
**Status:** Proposto (aguardando aprovação)
**Autor:** análise assistida por agente
**Data:** 2026-09-23

---

## 1. Sumário executivo

O pedido parte da premissa de que "o projeto está apenas em Português do Brasil (pt-BR)". **A auditoria do código mostra que essa premissa vale para apenas um dos três apps.**

| App | Idioma real do copy de usuário | Volume aproximado | Esforço de i18n |
|---|---|---|---|
| `apps/web` (Vinext/TS) | **pt-BR** ✅ (premissa correta) | ~2.500–3.500 strings em 179 arquivos | **Alto** — o grosso do trabalho |
| `apps/api` (FastAPI) | **Inglês** ❌ (6 literais em pt-BR) | ~275 strings distintas | Médio — falta *contrato de erro*, não tradução |
| `apps/cli` (Click) | **Inglês** ❌ (0 caracteres acentuados) | ~520 unidades | Médio-alto — falta *ponto de estrangulamento* |

**Consequências diretas para o planejamento:**

1. Para **web**, o trabalho é extrair pt-BR e traduzir para en/es (o que o pedido descreve).
2. Para **API e CLI**, o trabalho é o inverso: exportar o inglês existente para um catálogo com `en` como base e **adicionar** `pt-BR` + `es`. É um trabalho de *plumbing*, não de tradução.
3. A API tem hoje **dois envelopes de erro incompatíveis** e um `app/schemas/error.py` que é código morto. Sem resolver isso antes, não existe chave estável para pendurar tradução — este é o **maior bloqueador estrutural** e precede qualquer catálogo.

**Recomendação de stack (validada empiricamente, ver §8):**

| Camada | Escolha | Por quê |
|---|---|---|
| Web | **`next-intl` 4.x** + segmento `[locale]` + middleware em `src/proxy.ts` | vinext detecta `next-intl` nativamente; build + workerd validados nesta análise |
| API | **Catálogo JSON + `Depends(get_translator)`** (não `gettext`) | corpus pequeno, sem plurais reais, sem `pyproject.toml`, sem CI; `.mo` não se paga |
| CLI | **Catálogo JSON + módulo `ui.py` novo** (não `gettext`) | Click congela `help` no import; `gettext` faria `--lang` parecer quebrado |

---

## 2. Reconhecimento — evidências

### 2.1 Frontend (`apps/web`)

- **60 páginas**, 6 layouts, 3 error boundaries, `vinext check` → **100% compatível** (16 supported, 0 issues).
- **77 de 160** arquivos `.tsx` são `"use client"` — dashboard e docs renderizam no cliente; **marketing e páginas legais são Server Components** (SEO/E-E-A-T, ver DEC-055).
- Distribuição estimada de unidades traduzíveis (heurística sobre literais + nós de texto JSX):

  | Arquivo | Unidades |
  |---|---|
  | `src/app/(docs)/docs/api/page.tsx` | 162 |
  | `src/app/(dashboard)/account/page.tsx` | 144 |
  | `src/app/(docs)/docs/cli/commands/page.tsx` | 142 |
  | `src/app/(marketing)/page.tsx` | 130 |
  | `src/app/(marketing)/termos-de-uso/page.tsx` | 125 |
  | `src/app/(marketing)/politica-de-privacidade/page.tsx` | 104 |

  O **route group `(docs)` (40 páginas) concentra a maior parte do volume** e tem o menor retorno por esforço.
- **Não existe `middleware.ts`**, mas **existe `src/proxy.ts`** (convenção do Next 16) com o guard de autenticação: matcher `"/((?!_next/static|_next/image|favicon.ico).*)"`, `protectedRoutes = ["/dashboard", "/projects"]`, cookie `session_token`, redirect para `/login?redirect=`.
- **31 arquivos** importam `next/link`, **32** importam `next/navigation` → todos precisam migrar para a navegação ciente de locale.
- **`src/lib/validators/schemas.ts`** define schemas Zod com mensagens pt-BR **em escopo de módulo** (`z.string().min(1, "Senha obrigatória")`). Isso é intratável com i18n por requisição e exige refatoração para *factory* (§6.1.4).
- **`src/app/layout.tsx`** fixa `<html lang="pt-BR">` e metadata pt-BR em escopo de módulo.
- **`src/components/layout/dashboard-nav.ts`** tem labels fixos ("Dashboard", "Projects", "Help", "Account") em array de módulo.
- **`src/components/docs/doc-sidebar.tsx`** tem ~43 labels/títulos fixos.
- **SEO:** `public/sitemap.xml` e `public/robots.txt` **estáticos**; `metadataBase` + `openGraph.locale: "pt_BR"` no layout raiz. Não há `hreflang`/`alternates` por locale.
- **Worker de emergência** (`worker/error-page.ts`) tem HTML estático com strings pt-BR hardcoded (DEC-055).

### 2.2 API (`apps/api`)

- **93 arquivos `.py`**, **3.063 constantes de string ≥3 chars**, das quais **exatamente 5 têm acento** e **6 são português** — todas em 2 arquivos:
  - `app/routers/invites.py:165-166` — notificação de convite (pt-BR)
  - `app/services/email_service.py:426,454,463,483` — e-mail de agradecimento de contribuição (**bilíngue pt/en por design**)
- **235 chamadas `HTTPException(...)`** em 22 arquivos → **120 payloads `detail` distintos** (102 string simples + 18 `{"code","message"}`).
- Literais mais repetidos: `"Project not found or insufficient permissions"` ×23, `"Project not found"` ×22, `"Invalid project ID"` ×15, `"Invalid ID"` ×14.
- **Dois envelopes incompatíveis:**
  - `{"detail": "<string>"}` — a maioria (102 strings, **sem código algum**)
  - `{"detail": {"code","message",...}}` — CI, middleware, rate limit (12 códigos estáveis)
  - `app/schemas/error.py` declara um `ErrorResponse` canônico que **nunca é usado** (só reexportado em `schemas/__init__.py`). Usa `class Config` no estilo Pydantic v1 sob Pydantic 2.13.5.
- **Apenas 1 exception handler** (`main.py:195`, `Exception` → 500). **Não há handler de `RequestValidationError`** → erros de validação Pydantic saem em inglês cru (`{"detail":[{"loc","msg","type"}]}`).
- **`Accept-Language` não é lido em lugar nenhum** (0 ocorrências). Nenhum uso de `gettext`/`babel`/`locale`.
- **E-mails = a maior superfície** (`email_service.py`, 653 linhas, 9 senders): HTML em f-strings + fallback texto duplicado, layout com `<html lang="en">` fixo. `email_alert_service.py` tem um **segundo** template independente.
- **`_format_brl`** formata `R$ 1.234,56` — formatação dependente de locale, não apenas texto.
- **Sem `pyproject.toml`**; deploy é **Docker** (`apps/api/Dockerfile:43` → `COPY apps/api/ ./`, contexto na raiz). `requirements.txt` com 18 pins. **Sem CI.**
- **Não existe `user.locale`.** E-mails de jobs agendados (`jobs/expiration_check.py`) **não têm request** → não dá para derivar locale de header. Coluna + migration são pré-requisito para i18n de e-mail.
- **Notificações são persistidas renderizadas** (`alert_delivery_service.py:150` → `NotificationService.create_notification`) → locale congelado na escrita.
- **178 asserções de teste acopladas a mensagem** em ~20 dos 43 módulos. Só 3 tocam pt-BR.

### 2.3 CLI (`apps/cli`)

- **5.789 LOC**, 20 arquivos de saída, 16 arquivos de teste.
- **Não existe módulo helper de console.** 398 `click.echo` inline, 0 `click.secho`, 0 `print`, 0 Rich/Typer/logging, 12 `click.style` em 3 arquivos.
- Convenção real de cor = **glifos**: `✓`×54, `✗`×9, `⚠`×4, `ℹ`×1, `•`×6. **89 chamadas com `err=True`**.
- **9 tabelas artesanais** com larguras hardcoded de cabeçalho em inglês (`f"{'NAME':<30}"` + `"─"*88`) — traduzir sem recalcular quebra o alinhamento.
- **Zero `gettext`/`_()`**; zero `--lang`, `--json`, `--no-color`, `--verbose` global (só `doctor --verbose`).
- **Não há error boundary**: `cli_context()` é gerenciador de recursos, não captura erro. Existem **47 `except Exception as e: click.echo(f"Error: {e}", err=True)`**.
- **`CriptEnvAPIError.__str__` embute o `detail` do servidor** → hoje o texto do servidor vaza cru. Com API traduzida, isso produziria **saída bilíngue**.
- **`--lang` e help text:** ~85 `help="..."` e ~85 docstrings viram `--help`. Click **cacheia `help`/`short_help` em tempo de declaração** → um `_ = gettext.gettext` em escopo de módulo **congelaria o idioma no import** e `--lang` pareceria não funcionar.
- **12 prompts `getpass.getpass`** (`projects.py`, `auth.py`, `login.py`, `context.py`, `remote_vault.py`) **não passam pelo Click** — um wrapper de `click.echo` não os alcança.
- `~/.criptenv/config.toml` é **declarado e nunca lido**; o único store vivo é a tabela `config` do SQLite (`get_config`/`set_config`), já usada por `current_project_id`.
- **Cascata de precedência já existe** em `context.resolve_project_id()` (flag → env → config salva) — é o molde para resolver locale.
- **~139 linhas de asserção sobre `result.output`**, ~95 sobre conteúdo; `test_team_commands.py` sozinho tem ~40 (`"2 member(s)"`, `"Added member"`…).
- **Empacotamento:** hatchling com `packages = ["src/criptenv"]`. **Validado nesta análise: hatchling já inclui arquivos não-`.py` do diretório do pacote** (wheel de teste continha `mypkg/locales/en.json`) → **nenhuma mudança de empacotamento é necessária** para os catálogos JSON.

---

## 3. Decisões de ferramentas

### 3.1 Web — `next-intl` 4.x (decidido)

**Escolha:** `next-intl@^4` + roteamento por prefixo de locale (`[locale]`) + middleware em `src/proxy.ts`.

**Justificativa baseada no código do framework, não em suposição:**
- `node_modules/vinext/dist/check.js:204` marca `next-intl` como **`status: "supported"`**, com o detalhe *"auto-detected from `i18n/request.{ts,tsx,js,jsx}`; `createNextIntlPlugin` wrapper not needed"*.
- `config/next-config.js` → `detectNextIntlConfig()` registra o alias `next-intl/config` automaticamente e **avisa para NÃO usar `createNextIntlPlugin()`** (ele quebra porque faz `require('next/package.json')`).
- `entries/app-rsc-entry.js:58,1017` propaga `i18nConfig` para o render do App Router; `shims/server.js:287` implementa `NextURL.locale`.

**Alternativas rejeitadas:**

| Alternativa | Motivo da rejeição |
|---|---|
| `react-i18next` / `i18next` | Não tem integração de SSR/RSC com App Router sem gambiarra; `vinext check` não o reconhece; exigiria provider cliente em tudo, perdendo SSR das páginas de marketing (regressão de SEO já conquistada em DEC-055). |
| **Context/hook caseiro + JSON** | Zero dependências e totalmente edge-safe, mas exige reimplementar plurais (`Intl.PluralRules`), interpolação, formatação de número/data/moeda, negociação de locale e navegação ciente de prefixo. `next-intl` faz tudo isso e é oficialmente detectado pelo vinext. Recomendado apenas como plano B se `next-intl` quebrar num upgrade de vinext. |
| Prefixo de locale **sem** `[locale]` (só cookie) | URL única por idioma → **SEO impossível**, e no Cloudflare a resposta é cacheada por URL, servindo o idioma errado. |
| `i18n` no `next.config.ts` (chave suportada pelo vinext) | O vinext suporta, mas a semântica de detecção/redirect está implementada em `pages-i18n.js` (Pages Router). Para App Router é uma extensão específica do vinext; `[locale]` + `next-intl` é o caminho portável e testável. |

**Estratégia de prefixo — `as-needed` com default `pt-BR` (recomendado):**

| | `as-needed` (recomendado) | `always` |
|---|---|---|
| URLs pt-BR | `/docs`, `/login` (inalteradas) | `/pt-BR/docs`, `/pt-BR/login` |
| URLs en/es | `/en/docs`, `/es/docs` | `/en/docs`, `/es/docs` |
| SEO | **Preserva a equidade das URLs pt-BR já publicadas** (docs indexadas, páginas legais LGPD linkadas em e-mails/rodapé/signup) | Simétrico e mais simples de cachear; mas 307 em toda URL antiga |
| `proxy.ts` | Guard de auth funciona sem alteração para pt-BR; precisa remover prefixo para en/es | Precisa remover prefixo para os 3 |

> Decisão de produto: confirmar se `/en/...` e `/es/...` entram no `sitemap.xml` (hoje estático) e se as páginas legais ganham `hreflang` — ver §7.

### 3.2 API — catálogo JSON + dependência FastAPI (decidido; `gettext` rejeitado)

**Escolha:** catálogo JSON por locale + `app/i18n/` com negociação de `Accept-Language` + `Depends(get_translator)`, e um `ContextVar` para código profundo (services, e-mails).

**Por que não `gettext`** (apesar de ser a sugestão do pedido e stdlib):

| Critério | `gettext` | JSON + `tr()` |
|---|---|---|
| Compilação | `.mo` binário (msgfmt/babel) no build | Nenhuma |
| Extração | `xgettext` não vê f-strings; a maioria dos `detail=` e todo o HTML dos e-mails é f-string → extração manual mesmo assim | Chaves semânticas escritas à mão, testáveis |
| Plurais | Vantagem principal do gettext — **e não há plurais reais** (a API não usa nenhum) | Irrelevante |
| Ferramental de tradutor | Poedit/Weblate (vantagem real) | Precisa de planilha/JSON externo |
| Fallback por chave | Cai para o `msgid` (a string-fonte inteira) | Cai para o valor de `en` por chave, granular |
| Custo | `babel` no `requirements.txt`, passo de compilação no Docker, catálogo binário versionado | `json.load` em runtime, 0 dependências novas |

**Decisão:** JSON. Reavaliar `gettext` **somente se** houver contratação de tradutores externos com fluxo `.po`/Weblate — nesse caso, o catálogo JSON pode ser convertido depois sem tocar no código de chamada.

**Ordem de execução obrigatória (bloqueador):** antes do catálogo, **consolidar o contrato de erro** (§5 fase B0).

### 3.3 CLI — catálogo JSON + módulo `ui.py` novo (decidido)

**Escolha:** `src/criptenv/i18n.py` (resolução + catálogo) + `src/criptenv/ui.py` (**o ponto de estrangulamento que não existe hoje**) + catálogos JSON em `src/criptenv/locales/`.

**Duas armadilhas que definem o design:**

1. **Click congela `help` no import.** `Command.help`/`short_help` são computados na construção da classe e `get_short_help_str()` roda em `format_commands()`. Portanto:
   - ❌ `from gettext import gettext as _` em escopo de módulo — congela o idioma no import e `--lang` não afeta `--help`.
   - ✅ **Subclasse própria de `click.Group`/`click.Command`** que resolve as strings **em tempo de renderização**.
2. **`getpass` não passa pelo Click** (12 sites) → o helper `ui.py` precisa cobrir prompts, não só `echo`.

**`gettext` rejeitado** pelos mesmos motivos da API, mais o problema (1) acima, que é fatal para a UX de `--help`.

---

## 4. Estrutura de pastas recomendada

### 4.1 Frontend (`apps/web`)

```
apps/web/
├── messages/                          # catálogos (fora de src/, padrão next-intl)
│   ├── pt-BR/
│   │   ├── common.json                # nav, shell, footer, erros genéricos, a11y
│   │   ├── auth.json                  # login, signup, 2fa, reset, verify-email
│   │   ├── dashboard.json             # dashboard, projects, secrets, members, audit
│   │   ├── marketing.json             # landing, contribute
│   │   ├── docs.json                  # 40 páginas de docs
│   │   └── legal.json                 # termos-de-uso, politica-de-privacidade
│   ├── en/  └── … (mesma estrutura)
│   └── es/  └── … (mesma estrutura)
│
└── src/
    ├── i18n/
    │   ├── routing.ts                 # defineRouting(locales, defaultLocale, localePrefix)
    │   ├── request.ts                 # getRequestConfig — vinext detecta AQUI
    │   ├── navigation.ts              # createNavigation → Link, useRouter, usePathname
    │   └── messages.ts                # merge dos namespaces + filtro por rota
    │
    ├── proxy.ts                       # ⚠️ ARQUIVO EXISTENTE: middleware next-intl ∘ guard de auth
    │
    ├── components/i18n/
    │   ├── locale-switcher.tsx        # seletor (client)
    │   └── html-lang.tsx              # (se necessário) sync de <html lang>
    │
    └── app/
        ├── global-error.tsx           # permanece na raiz (já tem documento próprio — DEC-055)
        └── [locale]/
            ├── layout.tsx             # ⭐ NOVO layout raiz: <html lang={locale}> + provider
            ├── not-found.tsx          # movido para cá (traduzível)
            ├── (auth)/…
            ├── (dashboard)/…
            ├── (marketing)/…
            └── (docs)/…
```

> **Mudança estrutural importante:** o `src/app/layout.tsx` atual fixa `<html lang="pt-BR">` e metadata pt-BR **em escopo de módulo**, sem acesso a `params`. Ele deve ser substituído por `src/app/[locale]/layout.tsx` como layout raiz (com `<html lang={locale}>`), e o metadata deve virar `generateMetadata({ params })`. O `global-error.tsx` fica na raiz (já renderiza `<html>/<body>` próprios, conforme DEC-055) e deve ficar bilíngue por `Accept-Language` lido no cliente — ou permanecer fixo em pt-BR como fallback de último nível (aceitável).

### 4.2 API (`apps/api`)

```
apps/api/
├── app/
│   ├── i18n/                          # ⭐ NOVO
│   │   ├── __init__.py                # exporta tr, get_translator, get_locale
│   │   ├── locale.py                  # normalização + negociação Accept-Language (q-values)
│   │   ├── translator.py              # Translator: lookup, fallback, interpolação
│   │   ├── dependency.py              # get_locale / get_translator (FastAPI Depends)
│   │   ├── context.py                 # ContextVar request-scoped (para services/jobs)
│   │   └── catalogs/
│   │       ├── en.json                # BASE (fonte da verdade)
│   │       ├── pt-BR.json
│   │       └── es.json
│   │
│   ├── middleware/
│   │   └── locale.py                  # ⭐ NOVO: resolve locale, seta ContextVar + Content-Language
│   │
│   ├── schemas/
│   │   ├── error.py                   # ♻️ passar a SER USADO (hoje é código morto)
│   │   └── errors/                    # ⭐ NOVO: códigos estáveis (str Enum)
│   │       └── codes.py               # PROJECT_NOT_FOUND, INVALID_ID, …
│   │
│   └── services/email_service.py      # ♻️ `<html lang>` dinâmico; corpo via catálogo
│
└── migrations/versions/               # ⭐ migration: users.locale
```

### 4.3 CLI (`apps/cli`)

```
apps/cli/
└── src/criptenv/
    ├── i18n.py                        # ⭐ NOVO: resolve_locale + Translator + tr()
    ├── ui.py                          # ⭐ NOVO: O PONTO DE ESTRANGULAMENTO
    │                                  #    success/error/warn/info/table/prompt/getpass
    ├── click_i18n.py                  # ⭐ NOVO: Group/Command que resolvem help em render-time
    ├── locales/
    │   ├── en.json                    # BASE
    │   ├── pt-BR.json
    │   └── es.json
    └── api/client.py                  # ♻️ header Accept-Language + CriptEnvAPIError.code
```

> Empacotamento: **nenhuma mudança necessária** — validado que hatchling já inclui `src/criptenv/locales/*.json` no wheel (§2.3).

---

## 5. Plano de ação passo a passo

### Fase 0 — Fundação (bloqueia todo o resto)

| # | Passo | Entregável | Verificação |
|---|---|---|---|
| 0.1 | **Congelar o escopo de idiomas.** Confirmar `en` como base da API/CLI e `pt-BR` como base/default do web. | Decisão registrada em `decisions.md` | — |
| 0.2 | **Definir a estratégia de URL do web** (`as-needed` vs `always`) e o destino de docs/legais. | Decisão registrada | — |
| 0.3 | **Congelar as chaves de catálogo** (convenção de nomes + arquivo-base `en.json` da API). | `docs/development/i18n-conventions.md` | — |
| 0.4 | **Pinar locale nos testes** das três suítes (autouse fixture) para que adicionar fallback de env não quebre tudo. | Fixtures em `apps/api/tests/conftest.py`, `apps/cli/tests/conftest.py`, `apps/web/jest.setup.ts` | `make test` verde sem mudança de copy |

### Fase A — Web: infraestrutura

| # | Passo | Entregável |
|---|---|---|
| A.1 | `npm install next-intl@^4`. **Não** adicionar `createNextIntlPlugin` ao `next.config.ts`. | `package.json` |
| A.2 | Criar `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/navigation.ts`, `src/i18n/messages.ts`. | 4 arquivos |
| A.3 | **Compor** o middleware em `src/proxy.ts` (next-intl ∘ guard de auth existente) — §6.1.3. | `src/proxy.ts` |
| A.4 | Mover as rotas para `src/app/[locale]/`; transformar `app/[locale]/layout.tsx` no layout raiz (`<html lang>` + `NextIntlClientProvider` + **`setRequestLocale`**). | árvore `src/app` |
| A.5 | Trocar `next/link` → `Link` de `@/i18n/navigation` nos 31 arquivos; `useRouter`/`usePathname` nos 32. | — |
| A.6 | Criar `LocaleSwitcher` e colocá-lo no `top-nav`/`marketing-header`/docs header. | component |
| A.7 | `generateMetadata` por locale + `alternates.languages` (hreflang) + sitemap dinâmico. | SEO |
| A.8 | Smoke test: `vinext build` + `wrangler dev` servindo `/`, `/en`, `/es`, `/en/docs`. | evidência |

### Fase B — API: contrato antes de catálogo

| # | Passo | Entregável |
|---|---|---|
| **B0** | **🔴 BLOQUEADOR — consolidar o envelope de erro.** Introduzir `app/schemas/errors/codes.py` (str Enum) e migrar os 120 `detail` para `{"code": …, "message": …}`. **Nesta etapa `message` continua em inglês, byte-idêntico**, para não quebrar as 178 asserções. | `codes.py`, refactor dos 22 routers |
| B.1 | Implementar `app/i18n/` (locale, translator, context, dependency) + `middleware/locale.py`. | 6 arquivos + 3 catálogos |
| B.2 | Registrar `LocaleMiddleware` em `main.py` (ordem: **antes** do rate limit) e retornar `Content-Language`. | `main.py` |
| B.3 | Adicionar handler de `RequestValidationError` mapeando `type` do Pydantic → chave de catálogo. | `main.py` |
| B.4 | Migration `users.locale` + expor em `GET/PATCH /api/auth/me`. | migration + schema |
| B.5 | Traduzir o catálogo `pt-BR`/`es` das ~180 strings do envelope JSON. | catálogos |
| B.6 | E-mails: `lang={locale}` dinâmico, corpo/subject via catálogo, `_format_brl` → formatação ciente de locale; resolver locale por `user.locale` (jobs não têm request). | `email_service.py` |
| B.7 | Notificações persistidas: gravar `message_key` + params em `meta` para permitir re-render no locale de leitura. | `alert_delivery_service.py` |

### Fase C — CLI: criar o ponto de estrangulamento

| # | Passo | Entregável |
|---|---|---|
| C.1 | Criar `src/criptenv/i18n.py` (resolução de locale + `Translator` + `tr()`). | módulo |
| C.2 | Criar `src/criptenv/ui.py` (`success/error/warn/info/table/prompt/getpass`) preservando os glifos e `err=True`. | módulo |
| C.3 | Adicionar `--lang` **`is_eager=True`** no `@click.group()` + subclasse de `Group`/`Command` que resolve help em render-time. | `cli.py`, `click_i18n.py` |
| C.4 | Persistir preferência via `queries.set_config(db, "locale", …)` (a tabela `config` do SQLite já existe). | `commands/` |
| C.5 | **Reescrever os ~398 `click.echo`** para `ui.*` — refactor mecânico, arquivo a arquivo, com teste verde entre cada um. | 20 arquivos |
| C.6 | **Refatorar os ~200 fragmentos de f-string** em templates parametrizados de unidade única (ordem de palavras difere em es). | 20 arquivos |
| C.7 | Migrar as 9 tabelas: derivar larguras do cabeçalho traduzido. | 9 renderers |
| C.8 | `CriptEnvAPIError` ganha `.code`; comandos preferem `code` e só caem no `message` do servidor como último recurso. | `api/client.py` |
| C.9 | Adicionar `Accept-Language` em `CriptEnvClient.headers`. | 1 linha |
| C.10 | Extrair ~520 unidades para `locales/en.json` + traduzir pt-BR/es. | catálogos |

### Fase D — Fechamento

| # | Passo |
|---|---|
| D.1 | `make check` completo (web-check-vinext + web-build + api-test + cli-test). |
| D.2 | Smoke test do Worker em produção (`wrangler dev`): tamanho do bundle < limites do Workers. |
| D.3 | Atualizar `docs/development/CHANGELOG.md`, `docs/tasks/current-task.md`, `docs/project/decisions.md`. |
| D.4 | Auditar strings sensíveis: mensagens anti-enumeração (`auth.py:27` "If an account exists…") exigem cuidado tradutório. |

---

## 6. Exemplos de implementação

### 6.1 Frontend

#### 6.1.1 `src/i18n/routing.ts`

```ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["pt-BR", "en", "es"],
  defaultLocale: "pt-BR",
  // pt-BR fica sem prefixo (preserva URLs publicadas); en/es ganham prefixo.
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
```

#### 6.1.2 `src/i18n/request.ts` — ponto de detecção do vinext

```ts
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { loadMessages } from "./messages";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return { locale, messages: await loadMessages(locale) };
});
```

`src/i18n/messages.ts` — merge de namespaces (evita um JSON de 3.000 chaves):

```ts
import { routing, type Locale } from "./routing";

const NAMESPACES = ["common", "auth", "dashboard", "marketing", "docs", "legal"] as const;

export async function loadMessages(locale: Locale) {
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => [
      ns,
      (await import(`../../messages/${locale}/${ns}.json`)).default,
    ] as const),
  );
  return Object.fromEntries(entries);
}
```

#### 6.1.3 `src/proxy.ts` — compor com o guard de auth existente

O `proxy.ts` de hoje faz checagem por caminho exato (`/dashboard`, `/projects`). Com prefixo de locale, é preciso **remover o prefixo antes de decidir**:

```ts
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const handleI18n = createMiddleware(routing);

const PROTECTED = ["/dashboard", "/projects"];
const PUBLIC = ["/", "/login", "/signup", "/forgot-password"];

/** Remove o prefixo de locale para que o guard continue raciocinando em pt-BR. */
function stripLocale(pathname: string): string {
  const seg = pathname.split("/")[1];
  if (seg && routing.locales.includes(seg as never)) {
    return pathname.slice(seg.length + 1) || "/";
  }
  return pathname;
}

export function proxy(request: NextRequest) {
  // 1) next-intl decide locale (cookie NEXT_LOCALE → Accept-Language → default)
  //    e resolve/redireciona. Ele também injeta o header de locale.
  const response = handleI18n(request);

  // Redirecionamento/rewrite do next-intl tem prioridade sobre o guard.
  if (response.headers.get("location")) return response;

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next") || pathname.match(/\.\w+$/)) return response;

  const bare = stripLocale(pathname);
  if (PUBLIC.some((p) => bare === p)) return response;

  if (PROTECTED.some((p) => bare === p || bare.startsWith(`${p}/`))) {
    const token = request.cookies.get("session_token")?.value;
    if (!token) {
      const login = new URL("/login", request.url);
      login.searchParams.set("redirect", pathname);
      return NextResponse.redirect(login);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
```

#### 6.1.4 `src/app/[locale]/layout.tsx` — layout raiz novo

```tsx
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { loadMessages } from "@/i18n/messages";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // ⚠️ OBRIGATÓRIO. Sem esta linha, todo Server Component cai no defaultLocale
  // (comprovado empiricamente — ver §8.2).
  setRequestLocale(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-(--background) text-(--text-primary) antialiased">
        {/* bootstrap de tema existente, preservado */}
        <NextIntlClientProvider messages={await loadMessages(locale)}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

#### 6.1.5 Uso — Server Component, Client Component e o "hook"

Não é preciso escrever hook próprio: `next-intl` já fornece `useTranslations` (client) e `getTranslations` (server).

```tsx
// ── Server Component (ex.: marketing) ────────────────────────────────
import { getTranslations } from "next-intl/server";

export default async function PricingSection() {
  const t = await getTranslations("marketing.pricing");
  return <h2>{t("title")}</h2>;
}

// ── Client Component (ex.: dialog) ──────────────────────────────────
"use client";
import { useTranslations } from "next-intl";

export function DeleteSecretDialog({ name }: { name: string }) {
  const t = useTranslations("dashboard.secrets");
  return <p>{t("deleteConfirm", { name })}</p>; // interpolação
}
```

Catálogo correspondente (`messages/pt-BR/dashboard.json`):

```json
{
  "secrets": {
    "deleteConfirm": "Excluir o secret '{name}'? Esta ação não pode ser desfeita.",
    "count": "{count, plural, =0 {Nenhum secret} one {# secret} other {# secrets}}"
  }
}
```

> **Formatação de número/data/moeda:** usar `useFormatter()` / `getFormatter()` do `next-intl` em vez de `toLocaleDateString` ad-hoc, para que o locale venha do provider.
>
> **Atenção de bundle (Workers):** `NextIntlClientProvider` serializa as mensagens passadas para o cliente. Passar o catálogo inteiro (3 locales × ~3.000 chaves) infla o bundle. Por rota, passar **apenas os namespaces usados por client components** (`messages.ts` exporta também um `pick(locale, [...])`). Server Components leem o catálogo no servidor e não precisam ser serializados.

#### 6.1.6 Zod — converter schemas de módulo em factory

Hoje `src/lib/validators/schemas.ts` tem mensagens pt-BR em escopo de módulo (`z.string().min(1, "Senha obrigatória")`). Isso **não pode** ser traduzido por requisição. Solução: chaves semânticas + resolução no consumo, ou factory.

```ts
// Opção A (recomendada): o schema emite uma CHAVE estável; a UI traduz.
export const signupSchema = z
  .object({
    password: z.string().min(1, "auth.errors.passwordRequired"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "auth.errors.passwordMismatch" });

// Na UI: t(`errors.${issue.message}`) — o valor do schema vira chave de catálogo.
```

> Avaliar o impacto nos testes existentes que comparam mensagens literais antes de escolher entre a Opção A (chave) e uma factory `createSchemas(t)`.

### 6.2 API Python

#### 6.2.1 `app/i18n/locale.py` — negociação de `Accept-Language`

```python
"""Negociação de locale para a API CriptEnv."""
from __future__ import annotations

import re
from typing import Iterable

SUPPORTED: tuple[str, ...] = ("pt-BR", "en", "es")
DEFAULT_LOCALE = "en"          # a API tem base inglesa
_ALIASES = {"pt": "pt-BR", "pt-br": "pt-BR", "en-us": "en", "en-gb": "en", "es-es": "es", "es-419": "es"}


def normalize_locale(raw: str | None) -> str | None:
    """'pt_BR.UTF-8' → 'pt-BR'; None se não suportado."""
    if not raw:
        return None
    tag = raw.split(".")[0].split("@")[0].strip().replace("_", "-")
    return _ALIASES.get(tag.lower(), tag if tag in SUPPORTED else None)


def negotiate(header: str | None, available: Iterable[str] = SUPPORTED) -> str:
    """Escolhe o melhor locale de um header Accept-Language, respeitando q-values."""
    if not header:
        return DEFAULT_LOCALE

    parsed: list[tuple[float, int, str]] = []
    for order, part in enumerate(header.split(",")):
        piece = part.strip()
        if not piece:
            continue
        tag, _, *params = piece.split(";")
        q = 1.0
        for p in params:
            m = re.match(r"\s*q\s*=\s*([0-9.]+)", p)
            if m:
                try:
                    q = float(m.group(1))
                except ValueError:
                    q = 0.0
        parsed.append((q, order, tag.strip()))

    # maior q primeiro; empate → ordem de aparição no header (desempate estável)
    for _q, _order, tag in sorted(parsed, key=lambda x: (-x[0], x[1])):
        if _q <= 0:
            continue
        hit = normalize_locale(tag)
        if hit and hit in available:
            return hit
    return DEFAULT_LOCALE
```

#### 6.2.2 `app/i18n/translator.py` — catálogo com fallback por chave

```python
"""Tradutor com fallback por chave e interpolação nomeada."""
from __future__ import annotations

import json
from functools import lru_cache
from importlib import resources
from typing import Any

from app.i18n.locale import DEFAULT_LOCALE, SUPPORTED


@lru_cache(maxsize=None)
def _load(locale: str) -> dict[str, Any]:
    with resources.files("app.i18n.catalogs").joinpath(f"{locale}.json").open(
        encoding="utf-8"
    ) as fh:
        return json.load(fh)


@lru_cache(maxsize=None)
def _load_base() -> dict[str, Any]:
    return _load(DEFAULT_LOCALE)


def _lookup(catalog: dict[str, Any], key: str) -> str | None:
    node: Any = catalog
    for part in key.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node if isinstance(node, str) else None


class Translator:
    """Resolve chaves semânticas no locale pedido, com fallback para a base."""

    def __init__(self, locale: str) -> None:
        self.locale = locale if locale in SUPPORTED else DEFAULT_LOCALE
        self._cat = _load(self.locale)

    def __call__(self, key: str, **params: object) -> str:
        raw = _lookup(self._cat, key)
        if raw is None:                      # fallback POR CHAVE, não pelo catálogo
            raw = _lookup(_load_base(), key)
        if raw is None:
            return key                       # nunca quebra: devolve a chave
        if not params:
            return raw
        try:
            return raw.format(**params)
        except (KeyError, IndexError):
            return raw                        # template malformado não derruba a resposta
```

#### 6.2.3 `app/i18n/context.py` + `dependency.py` — acesso em código profundo e via DI

```python
# context.py
from contextvars import ContextVar
from app.i18n.locale import DEFAULT_LOCALE

_locale_var: ContextVar[str] = ContextVar("criptenv_locale", default=DEFAULT_LOCALE)


def set_current_locale(locale: str) -> None:
    _locale_var.set(locale)


def get_current_locale() -> str:
    return _locale_var.get()


# dependency.py
from fastapi import Query, Request
from app.i18n.context import get_current_locale
from app.i18n.locale import negotiate
from app.i18n.translator import Translator


def get_locale(request: Request, lang: str | None = Query(None)) -> str:
    """Precedência: ?lang= → Accept-Language → default."""
    return negotiate(lang or request.headers.get("accept-language"))


def get_translator(locale: str = Depends(get_locale)) -> Translator:
    return Translator(locale)
```

#### 6.2.4 `app/middleware/locale.py` — locale por requisição + `Content-Language`

```python
"""Resolve o locale da requisição e o expõe a todo o request scope."""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.i18n.context import set_current_locale
from app.i18n.locale import negotiate


class LocaleMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        locale = negotiate(
            request.query_params.get("lang")
            or request.headers.get("accept-language")
        )
        set_current_locale(locale)          # ContextVar: visível em services/jobs in-request
        request.state.locale = locale

        response = await call_next(request)
        response.headers["Content-Language"] = locale
        return response
```

Registro em `main.py` (**antes** do rate limit, para que a resposta de 429 já saia localizada):

```python
app.add_middleware(APIVersionMiddleware)
app.add_middleware(LocaleMiddleware)          # ⭐
app.add_middleware(RateLimitMiddleware, config=…)
```

Uso em router (padrão B0 — código estável + mensagem localizada):

```python
from app.i18n.translator import Translator
from app.i18n.dependency import get_translator
from app.schemas.errors.codes import ErrorCode


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    tr: Translator = Depends(get_translator),
):
    if not is_uuid(project_id):
        raise HTTPException(
            status_code=404,
            detail={
                "code": ErrorCode.PROJECT_NOT_FOUND.value,   # contrato estável (NÃO traduz)
                "message": tr("errors.project_not_found"),   # apresentação (traduz)
            },
        )
```

Código profundo (services/e-mails) usa `tr()` do contexto, sem propagar parâmetro:

```python
from app.i18n import tr   # lê o ContextVar

message = tr("notifications.secret_expiring", key=secret_key)
```

#### 6.2.5 Handler de validação Pydantic (hoje ausente)

```python
from fastapi.exceptions import RequestValidationError
from app.i18n.translator import Translator
from app.i18n.locale import negotiate

_VALIDATION_KEYS = {
    "missing": "validation.required",
    "string_too_short": "validation.too_short",
    "string_too_long": "validation.too_long",
    "value_error.email": "validation.invalid_email",
    "value_error": "validation.invalid_value",
}


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    tr = Translator(negotiate(request.headers.get("accept-language")))
    return JSONResponse(
        status_code=422,
        content={
            "detail": [
                {
                    "loc": err["loc"],
                    "type": err["type"],
                    "msg": tr(_VALIDATION_KEYS.get(err["type"], "validation.invalid_value")),
                }
                for err in exc.errors()
            ]
        },
    )
```

### 6.3 CLI Python

#### 6.3.1 `src/criptenv/i18n.py` — resolução de locale + tradutor

```python
"""i18n da CLI: resolução de locale e catálogo JSON."""
from __future__ import annotations

import json
import os
from importlib import resources
from typing import Any

SUPPORTED = ("en", "pt-BR", "es")
DEFAULT_LOCALE = "en"
_ALIASES = {"pt": "pt-BR", "pt-br": "pt-BR", "en-us": "en", "es-es": "es", "es-419": "es"}

_current: str = DEFAULT_LOCALE


def normalize(raw: str | None) -> str | None:
    """'pt_BR.UTF-8' → 'pt-BR'."""
    if not raw:
        return None
    tag = raw.split(":")[0].split(".")[0].split("@")[0].strip().replace("_", "-")
    return _ALIASES.get(tag.lower(), tag if tag in SUPPORTED else None)


def resolve_locale(cli_flag: str | None, saved: str | None = None) -> str:
    """--lang → CRIPTENV_LANG → config salva → LANGUAGE/LC_*/LANG → default.

    Um LANG inválido NUNCA derruba a CLI: cai em DEFAULT_LOCALE em silêncio.
    """
    for candidate in (
        cli_flag,
        os.getenv("CRIPTENV_LANG"),
        saved,
        # LANGUAGE é uma LISTA de preferências separada por ':', por convenção POSIX
        *(os.getenv("LANGUAGE", "").split(":") or []),
        os.getenv("LC_ALL"),
        os.getenv("LC_MESSAGES"),
        os.getenv("LANG"),
    ):
        hit = normalize(candidate)
        if hit:
            return hit
    return DEFAULT_LOCALE


def _lookup(catalog: dict[str, Any], key: str) -> str | None:
    node: Any = catalog
    for part in key.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node if isinstance(node, str) else None


class Translator:
    def __init__(self, locale: str) -> None:
        self.locale = locale
        with resources.files("criptenv.locales").joinpath(f"{locale}.json").open(
            encoding="utf-8"
        ) as fh:
            self._cat = json.load(fh)
        with resources.files("criptenv.locales").joinpath(f"{DEFAULT_LOCALE}.json").open(
            encoding="utf-8"
        ) as fh:
            self._base = json.load(fh)

    def __call__(self, key: str, **params: object) -> str:
        raw = _lookup(self._cat, key) or _lookup(self._base, key)
        if raw is None:
            return key
        try:
            return raw.format(**params) if params else raw
        except (KeyError, IndexError):
            return raw


def set_locale(locale: str) -> None:
    global _current, _translator
    _current = locale
    _translator = Translator(locale)


_translator = Translator(DEFAULT_LOCALE)


def tr(key: str, **params: object) -> str:
    """Atalho usado em todo o código: tr('secrets.deleted', key=name)."""
    return _translator(key, **params)
```

#### 6.3.2 `src/criptenv/ui.py` — o ponto de estrangulamento (não existe hoje)

Cobre `echo`, prompts **e** `getpass` (que não passa pelo Click):

```python
"""Saída da CLI. TODA mensagem de usuário passa por aqui — único ponto de i18n."""
from __future__ import annotations

import getpass
import shutil

import click

from criptenv.i18n import tr


def _emit(key: str, symbol: str, color: str | None, err: bool, **params: object) -> None:
    text = tr(key, **params)
    click.echo(click.style(f"{symbol} {text}", fg=color) if color else f"{symbol} {text}", err=err)


def success(key: str, **params: object) -> None:      # ✓ — preserva o glifo atual (54 usos)
    _emit(key, "✓", "green", False, **params)


def error(key: str, **params: object) -> None:        # ✗ — sempre stderr
    _emit(key, "✗", "red", True, **params)


def warn(key: str, **params: object) -> None:         # ⚠
    _emit(key, "⚠", "yellow", False, **params)


def info(key: str, **params: object) -> None:         # ℹ
    _emit(key, "ℹ", None, False, **params)


def plain(key: str, err: bool = False, **params: object) -> None:
    click.echo(tr(key, **params), err=err)


def table(headers: list[str], rows: list[list[str]]) -> None:
    """Tabela com larguras derivadas do CABEÇALHO TRADUZIDO (corrige os 9 renderers)."""
    cols = [tr(h) for h in headers]
    widths = [
        max(len(cols[i]), *(len(r[i]) for r in rows)) if rows else len(cols[i])
        for i in range(len(cols))
    ]
    total = sum(widths) + 2 * (len(cols) - 1)
    click.echo("  ".join(c.ljust(w) for c, w in zip(cols, widths)))
    click.echo("─" * total)
    for row in rows:
        click.echo("  ".join(str(c).ljust(w) for c, w in zip(row, widths)))


def confirm(key: str, **params: object) -> bool:
    return click.confirm(tr(key, **params))


def prompt(key: str, hide_input: bool = False, **params: object) -> str:
    return click.prompt(tr(key, **params), hide_input=hide_input)


def secret_prompt(key: str, **params: object) -> str:
    """getpass NÃO passa pelo Click — precisa deste wrapper (12 sites)."""
    return getpass.getpass(tr(key, **params))
```

Migração de um call site real (`commands/secrets.py:57`):

```python
# ANTES
click.echo(f"✓ Set {key_id}" + (f" (v{version})" if version > 1 else ""))
# DEPOIS — fragmento vira template único (ordem de palavras difere em es)
ui.success("secrets.set", key=key_id, version=version)
```
```json
// locales/pt-BR.json
{ "secrets": { "set": "Definido {key} (v{version})" } }
```
```json
// locales/es.json
{ "secrets": { "set": "{key} definido (v{version})" } }
```

#### 6.3.3 `--lang` global + help resolvido em render-time

`--lang` precisa de `is_eager=True` para valer também em `--help`. Como o Click **cacheia `help` na declaração**, o help é resolvido numa subclasse:

```python
# src/criptenv/click_i18n.py
import click
from criptenv.i18n import tr


class I18nCommand(click.Command):
    def get_short_help_str(self, limit: int = 45) -> str:
        # Re-resolve a CHAVE da docstring a cada render (não congela no import).
        if self.help and self.help.startswith("i18n:"):
            return tr(self.help[5:])[:limit]
        return super().get_short_help_str(limit)


class I18nGroup(click.Group):
    def get_command(self, ctx, cmd_name):
        cmd = super().get_command(ctx, cmd_name)
        if cmd is not None and not isinstance(cmd, I18nCommand):
            cmd.__class__ = I18nCommand
        return cmd


@click.group(cls=I18nGroup)
@click.option(
    "--lang",
    "lang",
    is_eager=True,
    default=None,
    help="Output language: pt-BR, en, es",
)
@click.version_option(version=__version__, prog_name="criptenv")
@click.pass_context
def main(ctx: click.Context, lang: str | None) -> None:
    """i18n:cli.description"""
    set_locale(resolve_locale(lang))
```

Precedência final: **`--lang` → `CRIPTENV_LANG` → config salva (`queries.get_config(db, "locale")`) → `LANGUAGE` → `LC_ALL` → `LC_MESSAGES` → `LANG` → `en`**, espelhando `resolve_project_id()`.

> Click também fornece os próprios textos (`Usage:`, `Options:`, `Commands:`, `Error:`). Localizá-los exigiria a integração `gettext` do próprio Click (`locale/` + `LANG`), com custo desproporcional para ~10 strings. **Recomendação: aceitar o enquadramento do Click em inglês e traduzir apenas as strings autorais.**

---

## 7. Riscos e decisões abertas

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| R1 | **Traduzir `detail` quebra o contrato observável da API** para CLI, GitHub Action e frontend | 🔴 Alta | Fase B0: introduzir códigos estáveis **antes** de traduzir; `code` é contrato, `message` é apresentação |
| R2 | **102 strings `detail` sem código algum** — não há chave para pendurar tradução | 🔴 Alta | Idem R1; é o bloqueador real |
| R3 | **Logo com 3.000+ strings** vs. limites de bundle do Cloudflare Workers | 🟠 Média | Namespaces + `pick()` por rota; medir bundle na fase D.2 |
| R4 | **Mover 60 páginas para `[locale]`** é refactor grande e arriscado de uma vez | 🟠 Média | Fase A entrega rotas vazias/infra primeiro; migrar route group por route group, com `make web-build` entre cada |
| R5 | **~178 asserções de teste da API** acopladas a mensagem | 🟠 Média | Fase 0.4 (pinar locale) + manter `message` byte-idêntico durante B0 |
| R6 | **~95 asserções de output da CLI**, muitas no pseudo-plural `(s)` | 🟠 Média | Fase 0.4 + migrar asserções para `exit_code`/chaves conforme C.5 |
| R7 | **Texto jurídico (termos/privacidade) em en/es** tem implicação de responsabilidade | 🟠 Média | Fase separada; exige revisão jurídica antes de publicar. Não traduzir mecanicamente |
| R8 | **Conteúdo de docs (40 páginas)** — maior volume, menor retorno | 🟡 Baixa | Deixar para o fim; considerar manter docs apenas em pt-BR/en inicialmente |
| R9 | **Notificações persistidas** congelam o locale na escrita | 🟡 Baixa | Fase B.7 (`message_key` + params em `meta`) |
| R10 | **E-mails de jobs agendados não têm request** | 🟠 Média | Fase B.4 (`users.locale`) é pré-requisito de B.6 |
| R11 | **`next-intl` fora do radar do vinext em upgrade futuro** | 🟡 Baixa | Plano B documentado: context/hook caseiro (§3.1) |
| R12 | **`getpass` (12 sites) não passa pelo Click** | 🟡 Baixa | `ui.secret_prompt()` (§6.3.2) |
| R13 | **Worker de emergência** (`worker/error-page.ts`) tem pt-BR hardcoded | 🟡 Baixa | Escolher 1 de 3 variantes estáticas por `Accept-Language` no `worker/index.ts` |

**Decisões que precisam de resposta humana antes da Fase A:**

1. **Url prefix:** `as-needed` (preserva URLs pt-BR, recomendado) ou `always` (simétrico)?
2. **Escopo do lançamento:** web completo (incl. 40 docs + legais) ou apenas marketing/auth/dashboard no v1?
3. **Páginas legais:** traduzir en/es agora ou manter só pt-BR até revisão jurídica?
4. **Docs:** `docs/` do repositório (Markdown) também serão traduzidos, ou só o site?

---

## 8. Apêndice — PoC validada nesta análise

Um spike completo foi **executado e revertido** nesta branch para eliminar as incertezas técnicas. A árvore está limpa (`git status` vazio); nada foi deixado no repositório.

### 8.1 Configuração testada

| Item | Valor |
|---|---|
| `next-intl` | 4.14.6 (instalado, testado, removido) |
| vinext | 0.0.45 (o do repo) |
| locales | `["pt-BR", "en", "es"]`, default `pt-BR` |
| `localePrefix` | `always` (no teste de redirect) e `[locale]` + `setRequestLocale` |

### 8.2 Resultados

| # | Hipótese | Resultado |
|---|---|---|
| 1 | `vinext build` compila com `next-intl` | ✅ exit 0 — "Build complete"; 2.267 módulos transformados |
| 2 | Segmento `[locale]` + `generateStaticParams` funcionam | ✅ `/en`, `/es`, `/pt-BR` → HTTP 200 |
| 3 | `generateMetadata({params})` traduz por locale | ✅ `/en` → "Hello from the server"; `/es` → "Hola desde el servidor" |
| 4 | **`getTranslations` resolve o locale da URL sem middleware** | ❌ **FALHOU** — todas as rotas caíram no `defaultLocale` (pt-BR) |
| 5 | `setRequestLocale(locale)` no layout corrige | ✅ **Sim** — os 3 locales passaram a renderizar corretamente no servidor **e** no cliente |
| 6 | `NextIntlClientProvider` propaga para client components | ✅ `<p id="spike-client">` correto nos 3 locales |
| 7 | Middleware (`src/proxy.ts`) executa no workerd | ✅ HTTP 307 |
| 8 | Detecção por `Accept-Language` | ✅ `es-ES,es;q=0.9` → `/es`; `en-US,en;q=0.9` → `/en` |
| 9 | Cookie `NEXT_LOCALE` vence o header | ✅ `NEXT_LOCALE=es` + `Accept-Language: en` → `/es` |
| 10 | Fallback de locale não suportado | ✅ `de-DE` → `/pt-BR` |

### 8.3 Achados que mudam o plano

1. **`setRequestLocale` é obrigatório.** Sem ele, Server Components ignoram silenciosamente o segmento de URL e servem o `defaultLocale`. Isso não aparece em nenhum doc do vinext e só foi detectado com request real — **a Fase A.4 depende disto**.
2. **`src/proxy.ts` JÁ EXISTE** com o guard de auth. Ele foi sobrescrito acidentalmente durante o spike e restaurado. O middleware do `next-intl` precisa ser **composto**, não substituído, e o guard precisa operar sobre o pathname **sem prefixo** (§6.1.3).
3. **`src/app/layout.tsx` não pode continuar sendo o layout raiz** como está: ele fixa `<html lang="pt-BR">` sem acesso a `params`. O layout raiz precisa ser `src/app/[locale]/layout.tsx`.
4. **hatchling já empacota os JSONs** — validado com wheel de teste contendo `mypkg/locales/en.json`. Nenhuma mudança em `pyproject.toml` é necessária para a CLI.
5. **`npm` neste ambiente** exige `--cache` fora de `~/.npm` (sandbox) e o `wrangler` exige `WRANGLER_HOME`/`XDG_CONFIG_HOME` graváveis; sem isso `vinext dev` falha com `EROFS`. Registrar para quem for rodar o smoke test.

---

## 8.bis Piloto executado — resultados (branch `feature/i18n-support`)

Decisões confirmadas pelo stakeholder antes da execução: `as-needed`; escopo do web completo; **páginas legais ficam só em pt-BR até revisão jurídica**; `docs/` Markdown do repositório fica para depois (o site de docs entra agora).

### O que foi implementado

| Item | Arquivo |
|---|---|
| Roteamento de locale | `src/i18n/routing.ts` (`as-needed`, default `pt-BR`) |
| Detecção do vinext | `src/i18n/request.ts` |
| Catálogos por namespace | `src/i18n/messages.ts` + `messages/<locale>/{common,auth,marketing}.json` |
| Navegação ciente de locale | `src/i18n/navigation.ts` |
| hreflang/canonical | `src/i18n/alternates.ts` |
| Middleware composto com o guard de auth | `src/proxy.ts` |
| Layout raiz por locale | `src/app/[locale]/layout.tsx` (substitui `src/app/layout.tsx`) |
| Seletor de idioma | `src/components/i18n/locale-switcher.tsx` |
| Piloto traduzido | login + layout de auth + header/footer do marketing + landing page |

Migração mecânica aplicada de uma vez (necessária porque o middleware do next-intl **reescreve** rotas sem prefixo para o default locale, então toda a árvore precisa estar sob `[locale]`):

- `git mv` de `(auth)`, `(dashboard)`, `(docs)`, `(marketing)`, `cli-auth`, `error.tsx`, `not-found.tsx` para `src/app/[locale]/`.
- **41 arquivos** com imports reescritos: `next/link` → `Link` de `@/i18n/navigation`, e `useRouter`/`usePathname` idem. `useParams`/`useSearchParams` **permanecem** em `next/navigation` (não existem no `createNavigation`).
- `src/app/global-error.tsx` **mantém `next/link`** de propósito: renderiza fora do `[locale]`, portanto fora do `NextIntlClientProvider`, e o `Link` do next-intl exige esse contexto.

### Achados novos (não estavam no plano original)

1. **`transpilePackages` é obrigatório para o Jest.** `next-intl` publica ESM não transpilado, e o `next/jest` deriva a allow-list de transformação de `next.config.transpilePackages`. Além disso, `transformIgnorePatterns` **não pode** ser corrigido no `jest.config`: o `next/jest` faz *append* à lista padrão e o Jest junta os padrões com `|`, então o `/node_modules/` default sempre vence. É preciso declarar os 9 pacotes ESM da cadeia (`next-intl`, `use-intl`, `intl-messageformat`, `icu-minify`, `@formatjs/fast-memoize`, `@formatjs/icu-messageformat-parser`, `@formatjs/icu-skeleton-parser`, `@formatjs/intl-localematcher`, `@schummar/icu-type-parser`).
2. **Formato do catálogo no provider:** `loadMessages` produz `{ <namespace>: <conteúdo do arquivo> }`. O helper de teste precisa espelhar isso (`{ auth: …, common: … }`), não achatar com spread — achatar faz todo `t()` devolver a chave crua (`auth.login.title`), silenciosamente.
3. **Redirect de auth perdia o idioma.** `/en/dashboard` redirecionava para `/login` (sem prefixo) → o usuário em inglês caía no login em português. Corrigido com `localePrefixFor()` em `src/proxy.ts`, que só reaplica o prefixo quando o locale não é o default.
4. **Schemas Zod migrados como *factory*, não como chave.** `createLoginSchema(t)` substitui `loginSchema`. Escolhido sobre a "Opção A" (chave semântica) porque mantém o contrato de exibição `errors.x.message` intacto nos outros 5 schemas ainda não migrados — zero risco de vazar chave crua na UI.
5. **Testes acoplados a mensagem:** 5 testes de login + 2 de marketing + o teste de proxy precisaram de ajuste; o helper `src/test/render-with-intl.tsx` fixa pt-BR para que as asserções existentes continuem válidas.
6. **Async Server Components não são renderizáveis por `@testing-library/react`.** Ao usar `await getTranslations(...)`, o componente passa a devolver uma Promise e o `render()` produz um nó vazio (e `getTranslations` exige um contexto de request inexistente no jsdom). Padrão adotado: chamar o componente e renderizar o elemento resolvido (`renderWithIntl(await Componente())`) com `next-intl/server` mockado por um tradutor de catálogo — `src/test/server-intl.ts`.
7. **Redirect de login precisa preservar o locale** (`/en/dashboard` → `/en/login`, não `/login`), senão o visitante em inglês é devolvido ao login em português. Implementado em `localePrefixFor()` no `src/proxy.ts`.
8. **O middleware do next-intl reescreve rotas sem prefixo para o default locale**, então a árvore inteira precisa estar sob `[locale]` — não é possível migrar rota a rota mantendo o restante no caminho antigo.

### Verificação executada

| # | Verificação | Resultado |
|---|---|---|
| 1 | `vinext build` | ✅ exit 0, rotas emitidas como `/:locale/...` |
| 2 | `tsc --noEmit` — erros **em arquivos tocados** | ✅ **0** (os 394 erros restantes são pré-existentes: tipagem do jest-dom, `CalloutProps`/`ResponseBlockProps` nos docs, `variant="outline"`) |
| 3 | Suíte Jest | ✅ **26/26 suítes, 112/112 testes** |
| 4 | `<html lang>` por rota | ✅ `pt-BR` / `en` / `es` corretos |
| 4 | Conteúdo traduzido | ✅ `/login` "Bem-vindo de volta" · `/en/login` "Welcome back" · `/es/login` "Bienvenido de nuevo" |
| 5 | Metadata por locale | ✅ títulos distintos nos 3 idiomas |
| 6 | hreflang + canonical | ✅ `pt-BR` sem prefixo, `en`/`es` com prefixo, `x-default` = pt-BR |
| 7 | `Accept-Language: en` em `/` | ✅ 307 → `/en` |
| 8 | Cookie `NEXT_LOCALE=es` vence o header | ✅ 307 → `/es` |
| 9 | Locale não suportado (`de`) | ✅ 200 no default, sem redirect |
| 10 | `/pt-BR/docs` (prefixo redundante) | ✅ 307 → `/docs` |
| 11 | 404 em `/nonexistent` e `/en/nonexistent` | ✅ 404 |
| 12 | Guard de auth com prefixo | ✅ `/en/dashboard` → `/en/login?redirect=…` |
| 13 | Guard de auth sem prefixo | ✅ `/dashboard` → `/login?redirect=…` |
| 14 | Rotas públicas | ✅ `/`, `/login`, `/docs` → 200 |

### Observação para a Fase D

Todas as rotas saíram como `ƒ Dynamic` no build. Isso continua entregando HTML server-rendered (indexável, que é o que DEC-055 protege), mas significa renderização sob demanda em vez de estática. Antes do deploy, vale medir o impacto no cache do Cloudflare e, se relevante, avaliar `generateStaticParams` por rota para recuperar pré-renderização onde não há dados dinâmicos.

---

## 9. Estimativa de esforço

| Fase | Escopo | Esforço |
|---|---|---|
| Fase 0 | Decisões + pinagem de locale nos testes | 0,5–1 dia |
| Fase A | Infra web + migração de rotas + switcher + SEO | 3–5 dias |
| Fase B0 | Consolidação do contrato de erro (120 sites) | 2–3 dias |
| Fase B1–B4 | Infra i18n da API + migration `users.locale` | 2–3 dias |
| Fase B5–B7 | Catálogos + e-mails + notificações | 3–4 dias |
| Fase C1–C4 | Infra CLI (`i18n.py`, `ui.py`, `--lang`, help) | 2–3 dias |
| Fase C5–C7 | Rewire de 398 echoes + 200 fragmentos + 9 tabelas | 4–6 dias |
| Fase C8–C10 | Contrato de erro na CLI + catálogos | 2–3 dias |
| Tradução | ~3.500 strings web + ~275 API + ~520 CLI (×2 idiomas) | depende de tradutor |
| **Total de engenharia** | | **~19–28 dias** |

> Sem contar o volume de tradução em si, que é paralelizável e não é trabalho de engenharia. Recomenda-se começar pela Fase 0 + A (valor visível: site bilíngue) e tratar API/CLI em seguida, já que ambos estão em inglês e portanto **não bloqueiam** a experiência em pt-BR.
