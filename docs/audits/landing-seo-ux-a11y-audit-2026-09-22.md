# Auditoria — Landing Page: SEO, UX/UI e Acessibilidade

**Data:** 2026-09-22 · **Escopo:** `/` (rota pública de marketing) · **Método:** dev server local (vinext + FastAPI), análise do HTML servido e dos componentes.

## Contexto

Auditoria externa (screenshot "Audit Categories") apontou: Social **36**, Security **65**, Content **75**, E-E-A-T **64**, Performance **84**. Esta rodada aplicou apenas correções **invisíveis** (sem mudança de design).

## Aplicado nesta rodada (sem alteração visual)

| # | Correção | Arquivo | Categorias impactadas |
|---|----------|---------|----------------------|
| 1 | Open Graph completo (`og:title/description/url/site_name/type/locale/image` + dimensões/alt) | `apps/web/src/app/layout.tsx` | Social, Content |
| 2 | Twitter Card (`summary` + title/description/image) | `apps/web/src/app/layout.tsx` | Social |
| 3 | `metadataBase` + `canonical` + `robots`/`googlebot` (`max-image-preview:large`) | `apps/web/src/app/layout.tsx` | Core SEO |
| 4 | `robots.txt` (bloqueia rotas autenticadas, aponta sitemap) | `apps/web/public/robots.txt` | Core SEO |
| 5 | `sitemap.xml` estático (`/`, `/contribute`, `/docs`) | `apps/web/public/sitemap.xml` | Core SEO |
| 6 | JSON-LD `SoftwareApplication` + `Organization` | `apps/web/src/app/(marketing)/layout.tsx` | Structured Data, E-E-A-T |
| 7 | Drawer mobile: overlay com `aria-hidden`, `role="dialog"`, `aria-modal`, `aria-label`, `hidden` quando fechado (remove foco de links fora da tela) | `apps/web/src/components/layout/marketing-header.tsx` | Acessibilidade |

Verificado no HTML servido: todas as meta tags, canonical, JSON-LD, `/robots.txt` (200) e `/sitemap.xml` (200). ESLint limpo nos arquivos alterados.

## Aplicado na rodada 2 (2026-09-22 — pendências com decisão)

| # | Correção | Arquivo | Pendência resolvida |
|---|----------|---------|---------------------|
| 1 | Imagem OG dedicada 1200×630 (`og-cover.png`, fundo escuro + logo branco + tagline pt-BR) e Twitter Card promovido a `summary_large_image` | `apps/web/public/images/og-cover.png`, `apps/web/src/app/layout.tsx` | P1 Social |
| 2 | Idioma canônico definido como **pt-BR** (decisão do mantenedor): `title`, `meta description`, OG e JSON-LD alinhados ao `lang="pt-BR"` | `apps/web/src/app/layout.tsx`, `apps/web/src/app/(marketing)/layout.tsx` | P1 Content/E-E-A-T |
| 3 | Security headers no Worker: CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri`, `form-action`; `unsafe-inline` em script/style devido aos snippets inline do tema/JSON-LD), HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` — aplicados às respostas do app e do proxy `/api/` | `apps/web/worker/index.ts` | P1 Security 65 |
| 4 | Skip-link "Pular para o conteúdo" + landmark `<main id="conteudo">` | `apps/web/src/app/(marketing)/layout.tsx` | P2 UX |
| 5 | Scroll suave para âncoras com `prefers-reduced-motion: no-preference` (todas as seções âncora já tinham `scroll-mt-14`, conferido: `#hero`, `#features`, `#how-it-works`, `#security`, `#pricing`) | `apps/web/src/app/globals.css` | P2 UX |
| 6 | `color-scheme` garantido: `<meta name="color-scheme" content="light dark">` + `color-scheme: light` em `html` (o `.dark` já fixava `dark`) | `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css` | P2 A11y |
| 7 | Contraste verificado por cálculo WCAG e corrigido para AA (≥4.5:1): claro `--text-tertiary` #737373→#6b6b6b (5.33), `--text-muted` #a3a3a3→#767676 (4.54); escuro `--text-tertiary` α .5→.6 (6.05), `--text-muted` α .3→.52 (4.78). Hierarquia primary>secondary>tertiary>muted preservada nos dois temas | `apps/web/src/app/globals.css` | P2 A11y |

Verificado no HTML servido: title/description/OG em pt-BR, `og:image` 1200×630, `twitter:card summary_large_image`, `color-scheme`, skip-link, `<main id="conteudo">`, canonical e JSON-LD pt-BR. ESLint limpo nos arquivos alterados.

## Aplicado na rodada 3 (2026-09-22 — branch `feature/landing-ssr-animated-sections`)

SSR dos textos das seções animadas (a pendência P1 que ficou para tarefa dedicada):

| # | Correção | Arquivo |
|---|----------|---------|
| 1 | **Descoberta-raiz**: em produção a landing inteira saía como shell vazio (~21 KB, zero conteúdo no HTML) — o vinext não faz SSR do módulo da página quando `page.tsx` é `"use client"`. A página foi convertida em Server Component; `HeroScene` (Three.js) foi para o wrapper client `hero-scene-lazy.tsx` (única forma permitida de `ssr:false`) e `LandingMotion` passou a receber os textos como children de servidor. Resultado: HTML de 21 KB → 215 KB com todo o conteúdo indexável (incluindo `#features`, `#how-it-works`, `#pricing` e `#cta`, que também não eram servidos) | `apps/web/src/app/(marketing)/page.tsx`, `apps/web/src/components/marketing/hero-scene-lazy.tsx` |
| 2 | `ProblemToVaultSection` agora renderiza no servidor: GSAP/ScrollTrigger saíram do escopo de módulo (`gsap.registerPlugin` global) e passaram a ser importados dinamicamente dentro do `useEffect` (a biblioteca nunca é avaliada no SSR/Worker). Hook de `prefers-reduced-motion` reescrito com `useSyncExternalStore` (hidratação sem mismatch) | `apps/web/src/components/marketing/problem-to-vault-section.tsx` |
| 3 | `SecurityScrollytelling` idem (pin/scrub/snap preservados via `ScrollTrigger.create` no effect; `SecurityVaultScene` segue `ssr:false`); `useMediaQuery` com `useSyncExternalStore` | `apps/web/src/components/marketing/security-scrollytelling.tsx` |
| 4 | `PlatformPreviewSection` virou Server Component puro: troca de tema das imagens feita por CSS (`dark:hidden` / `hidden dark:block`) em vez de `useTheme`; sem `dynamic` | `apps/web/src/components/marketing/platform-preview-section.tsx` |
| 5 | Correção de bug introduzido na rodada 2: o `vinext dev`/`vinext start` executam o `worker/index.ts`, e o CSP `upgrade-insecure-requests` quebrava os redirects http do otimizador de imagens em ambiente local (`ERR_SSL_PROTOCOL_ERROR`). Headers de segurança agora só são aplicados quando a requisição é `https:` | `apps/web/worker/index.ts` |
| 6 | Mocks do teste do `ProblemToVaultSection` atualizados (`gsap.context` em vez de `useGSAP`) | `apps/web/src/components/marketing/__tests__/problem-to-vault-section.test.tsx` |

**Verificação:** build de produção OK; curl confirma os textos das 3 seções no HTML servido (`vault selado`, `Você só vê`, `AES-GCM com chave de 256 bits`, `PBKDF2 fortalece a senha`); Playwright comparou screenshots antes/depois em light/dark/mobile — paridade visual e animações preservadas (scrollytelling troca de tópico no scroll; troca de imagem por tema funciona; 0 erros de console/hidratação); 105/105 testes unitários; ESLint limpo.

## Pendente (resolvido — histórico)

**P1 — Social 36 / imagens sociais**
- Criar imagem OG dedicada 1200×630 (a logo 500×500 funciona, mas o card fica pequeno em feed). Exportar de `public/images/og-cover.png` e atualizar `layout.tsx`.
- Security 65: é score da ferramenta sobre headers HTTP — revisar CSP/HSTS no `worker/index.ts` e na borda Cloudflare (não é frontend visível; requer deploy).

**P1 — Content 75 / E-E-A-T 64**
- `<title>` e `meta description` estão em inglês enquanto o conteúdo é pt-BR (`lang="pt-BR"`). Definir idioma canônico do marketing e alinhar title/description/OG — muda o texto do SERP, por isso ficou pendente.
- Página `page.tsx` é inteira `"use client"`: as seções com `ssr:false` (ProblemToVault, Scrollytelling, PlatformPreview) não geram HTML indexável. Avaliar tornar ao menos os textos delas SSR.

**P2 — UX**
- Nav âncora (`#features` etc.) não usa scroll suave/`scroll-margin-top` visível no código — conferir offset do header fixo.
- Falta skip-link "pular para conteúdo" (apareceria só no foco de teclado).

**P2 — Acessibilidade**
- Contraste de `--text-tertiary`/`--text-muted` sobre `--background` precisa verificação com medidor (não avaliável sem render pixel).
- Tema: prefere `prefers-color-scheme` + localStorage; ok. Garantir `color-scheme` meta.

## Como reproduzir

```bash
cd apps/api && .venv/bin/python -m uvicorn main:app --port 8000
cd apps/web && XDG_CONFIG_HOME="$PWD/.wrangler-home" npm run dev
curl -s localhost:3000 | grep -E 'og:|twitter:|canonical'
```

> Nota: o wrangler do vinext grava em `~/.config/.wrangler`; fora do sandbox use `XDG_CONFIG_HOME` apontando para um diretório gravável.
