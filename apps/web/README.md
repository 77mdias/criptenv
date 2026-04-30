# CriptEnv Web

Frontend do CriptEnv rodando em [vinext](https://github.com/cloudflare/vinext), com App Router compatível com Next.js 16 e deploy alvo em Cloudflare Pages + Workers.

## Getting Started

Instale as dependências e suba o servidor de desenvolvimento padrão do `vinext`:

```bash
npm install
npm run dev
```

Abra `http://localhost:3000` no navegador.

Se você precisar comparar com o runtime antigo durante a transição, ainda existe o fallback:

```bash
npm run dev:next
```

## Scripts

```bash
npm run dev           # vinext dev
npm run build         # vinext build
npm run start         # vinext start
npm run lint          # eslint
npm run check:vinext  # compatibility check
npm run deploy        # Cloudflare Workers deploy
```

## Cloudflare

O projeto usa a integração nativa do `vinext` com Cloudflare:

- `wrangler.jsonc` define o worker e os assets
- `worker/index.ts` é o entrypoint do runtime Cloudflare
- `vite.config.ts` inclui `@cloudflare/vite-plugin` para App Router + Workers

Para preparar ou publicar o deploy:

```bash
npm run deploy:dry-run
npm run deploy
```

Antes do primeiro deploy real, autentique o `wrangler` e configure o `account_id` no `wrangler.jsonc` ou via `CLOUDFLARE_ACCOUNT_ID`.
