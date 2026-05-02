# Frontend — CriptEnv

## Overview

Vinext (Next.js 16) + React 19 frontend with TailwindCSS v4 and Radix UI components. Deployed on Cloudflare Pages + Workers.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Framework** | Vinext (Next.js 16 with Vite) |
| **Runtime** | React 19 |
| **Styling** | TailwindCSS v4 |
| **Components** | Radix UI |
| **Forms** | react-hook-form + Zod |
| **State** | Zustand |
| **Server State** | @tanstack/react-query |
| **Deployment** | Cloudflare Pages + Workers |

---

## Project Structure

```
apps/web/src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with theme
│   ├── globals.css         # TailwindCSS + CSS variables
│   ├── (auth)/            # Auth route group
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── forgot-password/page.tsx
│   ├── (dashboard)/      # Dashboard route group
│   │   ├── dashboard/page.tsx
│   │   ├── projects/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       ├── secrets/page.tsx
│   │   │       ├── audit/page.tsx
│   │   │       ├── members/page.tsx
│   │   │       └── settings/page.tsx
│   │   ├── account/page.tsx
│   │   └── integrations/page.tsx
│   └── (marketing)/       # Marketing route group
│       └── page.tsx      # Landing page
├── components/
│   ├── layout/            # Shell, sidebar, nav
│   ├── ui/                # Radix primitives
│   ├── marketing/         # Landing page components
│   └── shared/            # Shared components
├── hooks/                 # Custom React hooks
├── stores/                # Zustand stores
├── types/                 # TypeScript types
└── lib/                   # Utilities
```

---

## Route Groups

Route groups in parentheses `(auth)`, `(dashboard)`, `(marketing)` don't affect URL but organize layouts:

- `(auth)` — Shared layout for login/signup pages
- `(dashboard)` — Layout with sidebar and top nav
- `(marketing)` — Marketing layout with minimal chrome

---

## Components

### Layout Components

**Location:** `apps/web/src/components/layout/`

| Component | Purpose |
|-----------|---------|
| `shell.tsx` | Main dashboard shell with sidebar |
| `sidebar-nav.tsx` | Sidebar navigation |
| `top-nav.tsx` | Top navigation bar |
| `marketing-sidebar.tsx` | Marketing page sidebar |
| `marketing-header.tsx` | Marketing page header |
| `footer.tsx` | Page footer |

### UI Primitives

**Location:** `apps/web/src/components/ui/`

| Component | Based On | Purpose |
|-----------|----------|---------|
| `badge.tsx` | — | Status/category badges |
| `button.tsx` | Radix | Button with variants |
| `card.tsx` | — | Card container |
| `input.tsx` | Radix | Text input |
| `separator.tsx` | Radix | Visual separator |
| `skeleton.tsx` | — | Loading placeholder |
| `status-badge.tsx` | — | Sync status indicator |
| `theme-switch.tsx` | — | Theme toggle |

### Marketing Components

**Location:** `apps/web/src/components/marketing/`

| Component | Purpose |
|-----------|---------|
| `hero.tsx` | Hero section |
| `features.tsx` | Features list |
| `pricing-card-carousel.tsx` | Pricing cards |
| (etc.) | Landing page sections |

---

## State Management

### Zustand Stores

| Store | Location | Purpose | Persisted |
|-------|----------|---------|-----------|
| `useAuthStore` | `stores/auth.ts` | Auth state | ❌ No |
| `useUIStore` | `stores/ui.ts` | UI state (modals, sidebar) | ❌ No |
| `useProjectStore` | `stores/project.ts` | Project selection | ❌ No |
| `useCryptoStore` | `stores/crypto.ts` | Encryption keys (memory only!) | ❌ No (never!) |

### React Query

Server state is managed via React Query:

```typescript
// Example usage
import { useQuery, useMutation } from '@tanstack/react-query'

// Fetch projects
const { data: projects } = useQuery({
  queryKey: ['projects'],
  queryFn: () => api.get('/api/v1/projects')
})

// Create project
const mutation = useMutation({
  mutationFn: (data) => api.post('/api/v1/projects', data),
  onSuccess: () => queryClient.invalidateQueries(['projects'])
})
```

---

## Theme System

**Dark mode default.** CSS variables defined in `globals.css`:

```css
:root {
  --background: #0a0a0a;
  --text-primary: #ffffff;
  --text-secondary: #a1a1aa;
  --accent: #ff4500;  /* Orange accent */
  --accent-hover: #ff5500;
  /* ... more variables */
}
```

Theme is applied via:
1. Inline script in root layout (before paint to prevent flash)
2. `class="dark"` on `<html>` element
3. localStorage key: `criptenv-theme`

```tsx
// layout.tsx
<script dangerouslySetInnerHTML={{
  __html: `
    (function() {
      const theme = localStorage.getItem('criptenv-theme') || 'dark';
      document.documentElement.classList.add(theme);
    })()
  `
}} />
```

---

## Forms

Using `react-hook-form` with `zod` validation:

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

type FormData = z.infer<typeof schema>

function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema)
  })
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
    </form>
  )
}
```

---

## API Integration

Frontend calls backend via `/src/proxy.ts` or direct fetch:

```typescript
// lib/api.ts (example pattern)
export async function getProjects() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects`, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`,
      'Content-Type': 'application/json'
    }
  })
  return response.json()
}
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout with theme initialization |
| `src/app/globals.css` | TailwindCSS + CSS variables |
| `src/stores/auth.ts` | Authentication state |
| `src/hooks/use-auth.ts` | Auth hook |
| `src/hooks/use-theme.ts` | Theme hook |
| `src/types/index.ts` | TypeScript type definitions |

---

## Component Patterns

### Creating New Pages

1. Add page file in appropriate route group
2. Use existing layout (no need to wrap in layout component)
3. Use `PageHeader` pattern for consistent headers

```tsx
// apps/web/src/app/(dashboard)/projects/page.tsx
export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Button>Create Project</Button>
      </div>
      {/* Content */}
    </div>
  )
}
```

### Adding Components

1. Determine component category (ui, layout, shared, marketing)
2. Create file in appropriate directory
3. Use existing primitives when possible

```tsx
// apps/web/src/components/ui/example.tsx
import * as React from "react"

export function Example({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-lg border bg-card", className)} {...props} />
  )
}
```

---

## Deployment

**Cloudflare Pages + Workers** with `wrangler.jsonc` configuration.

Build output goes to `.next/` directory.

```bash
# Build
npm run build

# Deploy (Cloudflare)
npx wrangler pages deploy .next
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-01