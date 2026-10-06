# Current Task — i18n (pt-BR · en · es) do Web

**Data:** 2026-09-23
**Branch:** `feature/i18n-support`
**Status:** Dashboard (área autenticada) **concluído e verificado**. Restam: site de docs (40 páginas), schemas Zod restantes, páginas legais e API/CLI.
**Decisão:** DEC-067 · **Plano:** `plans/i18n-en-es-support.md` (§8.bis = relatório do piloto)

> Task anterior ("Project Alerts", 2026-09-19) permanecia com validação de release
> incompleta (migração não aplicada e E2E de alertas bloqueado). Foi substituída como
> task corrente; o histórico e as decisões DEC-057/058 seguem válidos.

## Merge de 2026-10-05 — main (28 commits: auditoria 2026-10, account redesign, React Query)

Conflitos resolvidos no merge:
- **Account redesign** (página decomposta em `_components/`, logout por sessão):
  estrutura da main mantida; a conversão i18n da conta precisa ser **refeita**
  contra o novo formato (follow-up — o catálogo `account.json` de 74+ chaves
  existe e cobre a maior parte da copy).
- **Dialogs em Radix** (confirm-action, permission, create-project, secret-form,
  import/export/expiration modals): estrutura Radix da main + i18n reaplicado.
  Atenção: a main removeu o botão de fechar manual (Radix fecha), então as
  chaves `*.close`/`closeAria` ficaram sem uso em alguns catálogos.
- **Export modal — fix de segurança da main (P0-2)**: sem preview do plaintext
  (materializa só no download). Catálogo `secrets.export` reformatado:
  `count` (plural ICU) + `warning` novos; `description`/`closeButton` removidos.
- **DEC renumerada**: i18n agora é DEC-067 (main assumiu 063-066 na auditoria).
- Deps: next 16.3.8 + undici 7.30.0 (main) + next-intl 4.14.5 (branch) via
  `npm install next-intl@4.14.5 --save-exact --min-release-age=0` (o
  `min-release-age=7` do .npmrc bloqueia pacotes novos; registrar para o
  próximo bump).

**Conta reconvertida (2026-10-05, pós-merge):** página + `_components/` com
i18n reaplicado à estrutura redesignada; catálogo cresceu de 74 para 118 chaves
(session management, security checklist, summary sidebar). Padrão dos dialogs:
estrutura Radix da main + i18n da branch.

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
- **Dashboard convertido** (2026-09-24): um catálogo por área, todos os componentes da área autenticada usando hooks; `createProjectSchema(t)` em factory; `dashboard-nav` emite `labelKey`.
- **`npm run check:i18n`** — auditor de cobertura de chaves (`scripts/audit-i18n-keys.mjs`): 1593 lookups × 3 locales, 0 problemas. Torna lacuna de chave uma falha de build-check, não um console.log silencioso.
- Alias `@messages/*` no Jest para importar catálogos em testes profundos.

## Validação

- `npm run build` — verde, rotas `/:locale/...`.
- `npx tsc --noEmit` — **0 erros** nos arquivos tocados (394 pré-existentes: jest-dom, `CalloutProps`/`ResponseBlockProps`, `variant="outline"`).
- `npx jest` — **26/26 suítes, 112/112 testes**.
- `npm run check:i18n` — exit 0 (1593 lookups; valida cobertura nos 3 locales).
- Smoke em workerd: zero `MISSING_MESSAGE` nas rotas públicas; rotas do dashboard são protegidas pelo proxy e cobertas por teste de componente + auditor.
- 14 verificações de runtime em workerd (`<html lang>`, copy nos 3 idiomas, metadata, hreflang, `Accept-Language`, cookie `NEXT_LOCALE`, fallback de `de`, `/pt-BR/docs` → `/docs`, 404, guard de auth com/sem prefixo).

## Pendente (ordem sugerida)

1. `(docs)` → namespace `docs` (40 páginas, maior volume e menor retorno).
2. Schemas Zod restantes (`signupSchema`, `createSecretSchema`, `contributionSchema`, …) — converter para factory `createXSchema(t)` (login e createProject já migrados).
3. `(marketing)/contribute` e páginas legais — legais bloqueadas por revisão jurídica.
4. Componentes compartilhados (`src/components/shared/*`, `layout/*`) ainda com copy fixa.
5. Páginas legais — **bloqueado por revisão jurídica**.
6. Sitemap dinâmico com os 3 locales (hoje `public/sitemap.xml` estático).
7. `worker/error-page.ts` tem pt-BR hardcoded — considerar variantes por `Accept-Language`.
8. Fase B (API) e Fase C (CLI) conforme DEC-067 — ambas em inglês hoje, não bloqueiam pt-BR.

## Avatar em produção — checklist de diagnóstico

Sintoma observado: upload chega ao R2, mas a UI mostra o nome no lugar da imagem
(era o `alt` do `<img>` falhando — agora cai nas iniciais).

1. **Redeploy do worker web.** O fix de CSP (`img-src`) está no código desde
   `8ed6c11`; se o deploy for anterior, a CSP continua `img-src 'self' data: blob:`
   e bloqueia o avatar.
2. **Conferir a origem que a API devolve.** A URL do avatar é
   `R2_PUBLIC_URL` (API) + `/{arquivo}?v={versão}`. A origem de `R2_PUBLIC_URL`
   tem de estar no `img-src` do worker — via `AVATAR_PUBLIC_ORIGIN` (web) ou um
   dos defaults (`https://avatars.77mdevseven.tech`, `https://*.r2.dev`).
   Se `R2_PUBLIC_URL` apontar para `https://<account_id>.r2.cloudflarestorage.com`
   (endpoint S3, autenticado), a imagem não carrega publicamente: troque pelo
   domínio público do bucket.
3. **Confirmar o header em produção:** `curl -sI https://<dominio-do-app>/login | grep -i content-security-policy`
   → `img-src` precisa listar a origem do R2.
4. **Confirmar que a URL do avatar responde:** abrir o `avatar_url` retornado por
   `GET /api/auth/me` direto no navegador. 403/404 → domínio público não anexado
   ao bucket ou acesso público (r2.dev) desabilitado.
5. **Console do browser** em um upload novo: violação de CSP aparece como
   "Refused to load the image ... violates content security policy: img-src".

## Riscos observados

- Todas as rotas saem como `ƒ Dynamic` no build: segue SSR indexável, mas renderização
  sob demanda. Medir impacto no cache do Cloudflare antes do deploy.
- `NextIntlClientProvider` serializa as mensagens para o cliente; usar
  `loadNamespaceMessages` por rota quando o bundle crescer.
- `(docs)` tem 40 páginas de copy fixa com acoplamento de testes — mover
  rota a rota com `npm run build` entre cada.
- Datas formatadas com `toLocaleDateString("pt-BR")` hardcode em conta, membros,
  settings e secrets: segue renderizando pt-BR nos 3 idiomas. Candidato a
  `useFormatter()` do next-intl (registrado como follow-up, fora do escopo).
- Rótulos de role em `members.roles.*` são a única cópia nova em pt-BR (antes o
  valor de protocolo era renderizado cru).
- **Avatar em produção (2026-09-24):** o `<img>` não tinha fallback de erro, então
  quando a imagem falha o browser renderiza o `alt` (o nome completo) dentro do
  círculo — corrigido com fallback para iniciais em `AvatarUpload` e `TopNav`.
  A causa raiz é ambiental: o `img-src` da CSP do worker precisa conter a origem
  de `R2_PUBLIC_URL` (API). Checklist em docs/tasks/current-task.md, seção Avatar.
- **Worker 404:** qualquer erro do router — incluindo `NEXT_NOT_FOUND` de rotas
  inexistentes — respondia 503 + Retry-After (página de emergência). Agora 404
  brandado; `/sw.js` passou a existir como service worker vazio (sem handler de
  fetch, não intercepta nada), eliminando o erro não tratado nos logs.
