# CriptEnv Web

Web dashboard for the CriptEnv Zero-Knowledge secret management platform. Built with [Vinext](https://github.com/cloudflare/vinext) — a Vite-based Next.js 16 reimplementation — and deployed to Cloudflare Pages + Workers.

## Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Vinext (Next.js 16.2.6) | 0.0.45 |
| Runtime | React | 19.2.5 |
| Styling | Tailwind CSS | v4 |
| Components | Radix UI | 1.0+ |
| Forms | react-hook-form | 7.74+ |
| Validation | Zod | 4.3+ |
| State | Zustand | 5.0+ |
| Server State | @tanstack/react-query | 5.100+ |
| Build | Vite | 8.0+ |
| Animation | GSAP, Framer Motion, Three.js | — |
| Deployment | Cloudflare Pages + Workers | — |

## Getting Started

### Prerequisites

- Node.js 20+
- npm or equivalent

### Installation

```bash
cd apps/web
npm install
```

### Development

```bash
# Start Vinext dev server (recommended)
npm run dev

# Or from project root
make web-dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Scripts

```bash
npm run dev              # Vinext dev server
npm run build            # Production build
npm run start            # Start production server locally
npm run lint             # ESLint
npm run check:vinext     # Vinext compatibility scan
npm run deploy           # Deploy to Cloudflare Workers
npm run deploy:dry-run   # Dry-run deployment
npm run test:unit        # Jest unit tests
npm run test:e2e         # Cypress E2E tests (full stack)
```

## Project Structure

```
src/
├── app/                    # App Router
│   ├── (auth)/            # Auth routes (login, signup, forgot-password)
│   ├── (dashboard)/       # Dashboard routes
│   │   ├── dashboard/     # Home dashboard
│   │   ├── projects/      # Project list & detail
│   │   ├── integrations/  # Cloud integrations
│   │   └── account/       # User account settings
│   └── (marketing)/       # Landing page
├── components/
│   ├── ui/                # Radix UI primitives
│   ├── shared/            # Domain components (secrets-table, audit-timeline)
│   ├── layout/            # Shell, sidebar, nav, footer
│   └── marketing/         # Hero, features, pricing
├── lib/
│   └── api/               # API client modules
├── stores/                # Zustand stores (auth, crypto, ui)
├── hooks/                 # Custom React hooks
└── worker/
    └── index.ts           # Cloudflare Worker entry point
```

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_COOKIE_NAME=criptenv_session
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Cloudflare Deployment

The project uses native Vinext integration with Cloudflare:

- `wrangler.jsonc` defines the worker and assets
- `worker/index.ts` is the Cloudflare Worker entry point
- `vite.config.ts` includes `@cloudflare/vite-plugin` for App Router + Workers

```bash
# Authenticate wrangler first
npx wrangler login

# Deploy
npm run deploy
```

## Testing

```bash
# Unit tests
npm run test:unit

# E2E tests (starts API + Web automatically)
npm run test:e2e

# Or from project root
make web-test
```

**41 Jest tests passing, 4 Cypress E2E tests passing.**

## SSR Constraints (Critical)

This frontend runs on Cloudflare Workers, which prohibits async I/O, timers, and random value generation in the **global scope** during SSR.

**Rules:**
- GSAP, Three.js, and animation libraries must use `next/dynamic` with `ssr: false`
- Browser-only APIs must be inside `useEffect` or `typeof window !== 'undefined'` checks
- Canvas/WebGL components always require `ssr: false`

## License

MIT — see [LICENSE](../../LICENSE) for details.
