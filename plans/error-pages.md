# Plano — Páginas de Tratamento de Erro (Brandadas)

> Status: **implementado (2026-09-23)** — ver DEC-055 e CHANGELOG "[Unreleased]".
> Contexto: após o incidente do Error 1101 (commit `25fc291` corrigiu a causa,
> mas a página exibida ao usuário foi a padrão feia da Cloudflare), decidiu-se
> criar telas de erro brandadas para todos os níveis de falha.

---

## 1. O problema em três níveis

| Nível | Quando acontece | Quem renderiza | Existe hoje? |
|---|---|---|---|
| **A. Worker crash (ex.: 1101, 1102, limite de CPU)** | Exceção não tratada no `worker/index.ts` ou em qualquer módulo avaliado/executado durante a requisição | **Ninguém** — a Cloudflare substitui a resposta pela página padrão dela | ❌ |
| **B. Erro de render do React/Next (500)** | Exceção dentro de um Server/Client Component durante o SSR | `error.tsx` / `global-error.tsx` do App Router | ❌ |
| **C. Rota inexistente (404)** | URL que não casa com nenhuma rota | `not-found.tsx` do App Router | ❌ |

**Insight-chave (nível A):** a página de crash **não pode ser um componente
React** — se o Worker crashou, o bundle do app é exatamente a coisa que falhou.
A página de emergência precisa ser um **HTML estático inline no próprio
`worker/index.ts`**, sem dependências.

---

## 2. Escopo proposto

### 2.1. Nível A — Fallback de emergência no Worker (prioridade máxima)

**Arquivo:** `apps/web/worker/index.ts` (ou novo `apps/web/worker/error-page.ts`
importado por ele — módulo separado, zero imports de runtime do app).

**Mudança:** envolver as duas chamadas de handler em try/catch:

```ts
import { renderEmergencyPage } from "./error-page";

// dentro de fetch():
try {
  const response = await handler.fetch(request, env, ctx);
  return withSecurityHeaders(response, url);
} catch (err) {
  console.error("[worker] Unhandled error:", err instanceof Error ? err.stack : err);
  return renderEmergencyPage(request); // Response 503, nunca lança
}
```

Também é desejável (P2, inferido) um watchdog simples: se nem o try/catch
segurar (ex.: throw na avaliação de módulo, caso do 1101 original), não há o
que fazer no código — nesse caso a mitigação real é o **runtime** (ver §5).

**Requisitos da página de emergência:**

- [ ] HTML **100% autocontido**: CSS inline em `<style>`, zero requisições
      externas (sem fontes, sem imagens, sem JS — o worker pode estar
      completamente quebrado e a CSP só permite `'self'`).
- [ ] Status HTTP **503** + `Retry-After: 60` (500 herdaria regras de retry
      indevidas; 503 comunica "volte já já").
- [ ] Identidade visual CriptEnv: dark mode via `prefers-color-scheme`
      (dark é o default da app), accent laranja `#ff4500` (variável
      `--accent` do design system), fundo com as variáveis de tema da app
      (`--background`, `--text-primary` — copiar os valores hex de
      `src/app/globals.css`, NÃO referenciar, pois é HTML estático).
- [ ] Copy em pt-BR (idioma da base atual) — sugerido:
  - Título: "Algo deu errado do nosso lado"
  - Subtítulo: "Encontramos uma falha inesperada ao processar sua solicitação.
    Nossa equipe já foi notificada."
  - Mostrar o **Ray ID** da Cloudflare (header `cf-ray` da request, primeira
    parte antes do hyfen) em `<code>` — essencial para suporte/debug, igual à
    página oficial faz.
  - Botão/link "Tentar novamente" (`javascript` NÃO — usar `href="/"`, se a
    home também estiver quebrada o usuário dá F5).
- [ ] Headers: `content-type: text/html; charset=utf-8` e
      `x-emergency-fallback: 1` (marcação própria para detectar em
      monitoramento quantas respostas vieram do fallback).
- [ ] **Não** logar segredos; logar apenas stack e URL do path.

**Teste obrigatório:** simular um crash (ex.: subir localmente uma versão do
worker com `throw new Error("boom")` antes do handler) e verificar que
`GET /` devolve a página bonita com 503, tanto no `wrangler dev` quanto num
deploy de preview.

### 2.2. Nível B — `error.tsx` / `global-error.tsx` do App Router

> Verificar na doc local (`apps/web/node_modules/next/dist/docs/`) a assinatura
> exata desses arquivos nesta versão — o AGENTS.md de `apps/web` alerta que a
> API pode diferir do Next tradicional.

**Arquivos novos:**

- `src/app/error.tsx` — boundary por segmento (client component), recebe
  `{ error, reset }`. Renderizar card brandado com botão "Tentar novamente"
  chamando `reset()`. Logar `error.digest` no `console.error`.
- `src/app/global-error.tsx` — fallback do layout raiz; precisa renderizar
  `<html>` e `<body>` próprios (checar doc da versão).
- Duplicar em `src/app/(dashboard)/error.tsx` se o copy precisar diferir
  (ex.: "Seus secrets estão seguros — cifrados no seu dispositivo" — mensagem
  reconfortante coerente com zero-knowledge).

**Estilo:** reutilizar `src/components/ui/` (Card, Button) e classes Tailwind
existentes — esta tela PODE usar o design system completo, pois o app
respondeu (só um segmento quebrou).

### 2.3. Nível C — `not-found.tsx`

- `src/app/not-found.tsx` — 404 brandado, Server Component, estático.
- Copy sugerida: "404 — Essa página não existe (ou nunca existiu)". Link para
  `/` e para `/login`. Seguir o padrão visual das páginas `(marketing)`.
- Confirmar interação com `wrangler.jsonc` → `assets.not_found_handling:
  "none"` (está correto: "none" delega ao Worker/Next, que então renderiza o
  `not-found.tsx` — não mudar para "404-page" ou "single-page-application").

---

## 3. Checklist de execução (para o agente implementador)

1. [x] Ler `node_modules/next/dist/docs/` (regras de error/not-found da versão).
2. [x] Implementar §2.1 (worker fallback) — **entregável independente**.
3. [x] Implementar §2.2 e §2.3.
4. [x] `npm run build` + `wrangler dev`: validar as 3 telas:
   - crash simulado → fallback do worker (503);
   - lançar erro num componente de teste → `error.tsx`;
   - `GET /rota-que-nao-existe` → 404 brandado.
5. [x] `npx eslint` nos arquivos novos (0 problems); testes CLI 191 + API 574 verdes (web não tem runner).
6. [x] Respeitar regras de SSR do Workers (AGENTS.md §Cloudflare Workers SSR
   Constraints): nenhum `setTimeout`/`Math.random`/`fetch` no escopo de módulo.
7. [x] Atualizar `docs/development/CHANGELOG.md` e, se houver decisão de
   design relevante, `docs/project/decisions.md` (`## DEC-XXX`).
8. [ ] Commit: `feat(web): branded error pages for worker crash, render errors and 404`.

---

## 4. Decisões já tomadas (não re-discutir)

- Dark mode como default na página de emergência, com respeito a
  `prefers-color-scheme` (consistente com a app).
- Accent `#ff4500` — identidade existente.
- Status 503 para o fallback do worker (não 500).
- Ray ID exibido ao usuário (mesmo comportamento da página da Cloudflare, mas
  bonito e com a marca).
- Zero JS na página de emergência.

## 5. Fora do escopo (mas registrado)

- **Mitigação de recorrência do 1101:** o fallback do worker NÃO protege contra
  throw na **avaliação de módulo** (o caso original do GSAP), pois o crash
  acontece antes do handler existir. A prevenção real continua sendo o checklist
  de SSR do AGENTS.md + testar com `wrangler dev` usando o **build de
  produção** antes de cada deploy (não coberto por CI hoje — candidate a um
  workflow de smoke-test no futuro; hoje o repo não tem `.github/workflows`).
- Cloudflare "Custom Error Pages" por zona (requer plano pago e não se aplica a
  Workers) — descartado.
