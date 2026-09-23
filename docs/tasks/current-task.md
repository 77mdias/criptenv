# Current Task — i18n (pt-BR · en · es) do Web

**Data:** 2026-09-23
**Branch:** `feature/i18n-support`
**Status:** Infraestrutura + piloto (login, auth, marketing) **concluídos e verificados**. Dashboard, docs e páginas legais pendentes.
**Decisão:** DEC-061 · **Plano:** `plans/i18n-en-es-support.md` (§8.bis = relatório do piloto)

> Task anterior ("Project Alerts", 2026-09-19) permanecia com validação de release
> incompleta (migração não aplicada e E2E de alertas bloqueado). Foi substituída como
> task corrente; o histórico e as decisões DEC-057/058 seguem válidos.

## Contexto

Adicionar suporte a Inglês e Espanhol. A auditoria mostrou que a premissa
"o projeto está em pt-BR" vale **apenas para `apps/web`**: API e CLI estão em inglês
(6 literais pt-BR na API; 0 na CLI). Por isso a ordem é: web primeiro (única superfície
de fato em português), API e CLI depois.

Decisões do stakeholder: `as-needed` · web completo · páginas legais **só pt-BR até
revisão jurídica** · `docs/` Markdown do repositório depois.

## Entregue

- `next-intl` 4.x no vinext; módulos `src/i18n/{routing,request,messages,navigation,alternates}.ts`.
- Toda a árvore de rotas sob `src/app/[locale]/`; layout raiz com `<html lang={locale}>` + `setRequestLocale`.
- `src/proxy.ts`: middleware do next-intl composto com o guard de auth, com prefixo de locale preservado no redirect de login.
- Catálogos `messages/<locale>/{common,auth,marketing}.json` (133 chaves em `marketing`, paridade verificada nos 3 idiomas).
- Traduzido: layout de auth, login, header/footer do marketing, landing page (página + 4 seções).
- `LocaleSwitcher` no header de marketing; canonical + hreflang (`x-default` = pt-BR).
- Helpers de teste (`render-with-intl`, `server-intl`) e mock de `next-intl/middleware`.

## Validação

- `npm run build` — verde, rotas `/:locale/...`.
- `npx tsc --noEmit` — **0 erros** nos arquivos tocados (394 pré-existentes: jest-dom, `CalloutProps`/`ResponseBlockProps`, `variant="outline"`).
- `npx jest` — **26/26 suítes, 112/112 testes**.
- 14 verificações de runtime em workerd (`<html lang>`, copy nos 3 idiomas, metadata, hreflang, `Accept-Language`, cookie `NEXT_LOCALE`, fallback de `de`, `/pt-BR/docs` → `/docs`, 404, guard de auth com/sem prefixo).

## Pendente (ordem sugerida)

1. `(dashboard)` → namespace `dashboard` (maior superfície logada).
2. `(docs)` → namespace `docs` (40 páginas, maior volume e menor retorno).
3. Schemas Zod restantes (`signupSchema`, `createProjectSchema`, …) — converter para factory `createXSchema(t)`.
4. Componentes compartilhados (`src/components/shared/*`, `layout/*`) ainda com copy fixa.
5. Páginas legais — **bloqueado por revisão jurídica**.
6. Sitemap dinâmico com os 3 locales (hoje `public/sitemap.xml` estático).
7. `worker/error-page.ts` tem pt-BR hardcoded — considerar variantes por `Accept-Language`.
8. Fase B (API) e Fase C (CLI) conforme DEC-061 — ambas em inglês hoje, não bloqueiam pt-BR.

## Riscos observados

- Todas as rotas saem como `ƒ Dynamic` no build: segue SSR indexável, mas renderização
  sob demanda. Medir impacto no cache do Cloudflare antes do deploy.
- `NextIntlClientProvider` serializa as mensagens para o cliente; usar
  `loadNamespaceMessages` por rota quando o bundle crescer.
- `(docs)` tem 40 páginas de copy fixa com acoplamento de testes — mover
  rota a rota com `npm run build` entre cada.
