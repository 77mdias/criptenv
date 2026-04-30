# UI-ARCHITECTURE.md — CriptEnv Frontend

> Unique source of truth for the technical stack, design tokens, and global component library.

---

## 1. Stack Tecnológica

| Camada | Tecnologia | Versão | Justificativa |
|--------|-----------|--------|---------------|
| **Framework** | Next.js (App Router) | 14+ | SSR/SSG, API routes, Vinext compatível |
| **Language** | TypeScript | 5.x | Type safety, DX, integração Prisma |
| **Styling** | TailwindCSS | 3.4+ | Utility-first, tokens via config, dark mode nativo |
| **Components** | shadcn/ui + Radix UI | latest | Primitivas acessíveis, copy-paste, customizável |
| **Icons** | Lucide React | latest | Consistente, tree-shakeable, open source |
| **Motion** | Framer Motion | 11+ | Animações declarativas, layout animations |
| **State** | Zustand + React Query (TanStack) | latest | Client state + server cache separation |
| **Forms** | React Hook Form + Zod | latest | Validação schema-first, performance |
| **Auth** | BetterAuth (client SDK) | latest | Email/password + OAuth, session management |
| **Backend** | Supabase (JS client) | latest | Realtime, RLS, storage, auth bridge |
| **Encryption** | Web Crypto API (AES-GCM-256) | native | Zero-knowledge, client-side only |
| **3D/Canvas** | Three.js (hero only) | r160+ | Background animado no landing page |

### Decisões de Arquitetura

- **Monorepo**: `packages/ui` (componentes), `apps/web` (Next.js), `packages/cli` (futuro)
- **Server Components por padrão**: Client Components apenas quando necessário (interatividade, hooks)
- **API Layer**: Server Actions para mutations, Route Handlers para webhooks/external
- **Styling Strategy**: TailwindCSS utility classes + CSS variables para tokens semânticos

---

## 2. Design Tokens

### 2.1 Color Palette

> Fonte primária: `design-system-uxjonny.html` (Light Theme)
> Fonte secundária: `design-system-monolith.html` (Dark Theme — accents e superfícies)

#### Light Theme (Default)

```
--color-background:         #FFFFFF
--color-background-subtle:  #FAFAFA        (neutral-50)
--color-background-muted:   #F5F5F5        (neutral-100)
--color-surface:            #FFFFFF
--color-surface-elevated:   #FFFFFF        (com shadow)
--color-border:             #E5E5E5        (neutral-200)
--color-border-subtle:      #F5F5F5        (neutral-100)

--color-text-primary:       #171717        (neutral-900)
--color-text-secondary:     #525252        (neutral-600)
--color-text-tertiary:      #737373        (neutral-500)
--color-text-muted:         #A3A3A3        (neutral-400)
--color-text-placeholder:   #D4D4D4        (neutral-300)

--color-accent:             #171717        (neutral-900 — botões primary)
--color-accent-hover:       #262626        (neutral-800)
--color-accent-foreground:  #FFFFFF

--color-success:            #15803D        (green-700)
--color-success-bg:         #F0FDF4        (green-50)
--color-success-border:     #BBF7D0        (green-200)

--color-warning:            #D97706        (amber-600)
--color-warning-bg:         #FFFBEB        (amber-50)

--color-danger:             #DC2626        (red-600)
--color-danger-bg:          #FEF2F2        (red-50)

--color-info:               #2563EB        (blue-600)
--color-info-bg:            #EFF6FF        (blue-50)
--color-info-border:        #BFDBFE        (blue-100)
```

#### Semantic Badge Colors

```
--badge-design-bg:          #EFF6FF        (blue-50)
--badge-design-text:        #2563EB        (blue-600)
--badge-design-border:      #BFDBFE        (blue-100)

--badge-dev-bg:             #FAF5FF        (purple-50)
--badge-dev-text:           #9333EA        (purple-600)
--badge-dev-border:         #E9D5FF        (purple-100)

--badge-brand-bg:           #ECFDF5        (emerald-50)
--badge-brand-text:         #059669        (emerald-600)
--badge-brand-border:       #A7F3D0        (emerald-100)
```

#### Dark Theme (Dashboard — quando aplicável)

```
--dark-background:          #0A0A0B
--dark-surface:             rgba(255,255,255,0.03)
--dark-surface-glass:       rgba(255,255,255,0.03) + backdrop-blur(40px)
--dark-surface-elevated:    #0F0F10
--dark-border:              rgba(255,255,255,0.06)
--dark-border-hover:        rgba(255,255,255,0.20)

--dark-text-primary:        #E8E6E3
--dark-text-secondary:      rgba(232,230,227,0.7)
--dark-text-tertiary:       rgba(232,230,227,0.5)
--dark-text-muted:          rgba(232,230,227,0.3)

--dark-accent:              #FF4500
--dark-accent-hover:        #FF6633
```

#### White Opacity Scale (Dark Theme)

```
--white-02:  rgba(255,255,255,0.02)
--white-03:  rgba(255,255,255,0.03)
--white-04:  rgba(255,255,255,0.04)
--white-06:  rgba(255,255,255,0.06)
--white-08:  rgba(255,255,255,0.08)
--white-10:  rgba(255,255,255,0.10)
--white-20:  rgba(255,255,255,0.20)
--white-40:  rgba(255,255,255,0.40)
```

---

### 2.2 Typography

#### Font Families

```css
--font-sans:  'Geist', Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
--font-mono:  'Geist Mono', ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
--font-display: 'Space Grotesk', var(--font-sans);  /* Landing/Marketing only */
```

#### Type Scale — Light Theme (ux.jonny)

| Token | Style | Size | Line-Height | Weight | Usage |
|-------|-------|------|-------------|--------|-------|
| `heading-1` | H1 | 80px (5rem) | 0.85 | 600 (semibold) | Hero titles |
| `heading-2` | H2 | 36px (2.25rem) | 1.1 | 600 | Section titles |
| `heading-3` | H3 | 36px (2.25rem) | 1.2 | 500 (medium) | Subsection titles |
| `heading-3-bold` | H3 Bold | 24px (1.5rem) | 1.3 | 700 (bold) | Card titles |
| `heading-4` | H4 | 20px (1.25rem) | 1.4 | 600 | Card headings |
| `bold-l` | Bold L | 18px (1.125rem) | 1.5 | 500 | Emphasized body |
| `bold-m` | Bold M | 14px (0.875rem) | 1.4 | 600 | Labels, names |
| `bold-s` | Bold S | 12px (0.75rem) | 1.3 | 700 | Uppercase labels, nav |
| `paragraph` | Paragraph | 18px (1.125rem) | 1.6 | 400 (Geist Mono) | Body text |
| `regular-l` | Regular L | 14px (0.875rem) | 1.5 | 400 (Geist Mono) | Secondary body |
| `regular-m` | Regular M | 12px (0.75rem) | 1.3 | 500 (Geist Mono) | Metadata, tags |
| `regular-s` | Regular S | 10px (0.625rem) | 1.4 | 400 (Geist Mono) | Captions, timestamps |

#### Type Scale — Dark Theme (Monolith — Landing/Marketing)

| Token | Style | Size | Line-Height | Weight | Usage |
|-------|-------|------|-------------|--------|-------|
| `display-1` | Display | 72px | 0.95 | 300/600 | Hero |
| `display-2` | Display 2 | 48px | 1.1 | 300/600 | Section hero |
| `section-title` | Section | 20px | 1.4 | 500 | Section label |

---

### 2.3 Spacing Scale

```
--space-1:   4px      (0.25rem)
--space-1.5: 6px      (0.375rem)
--space-2:   8px      (0.5rem)
--space-3:   12px     (0.75rem)
--space-4:   16px     (1rem)
--space-5:   20px     (1.25rem)
--space-6:   24px     (1.5rem)
--space-8:   32px     (2rem)
--space-10:  40px     (2.5rem)
--space-12:  48px     (3rem)
--space-16:  64px     (4rem)
--space-20:  80px     (5rem)
--space-24:  96px     (6rem)
```

### 2.4 Border Radius

```
--radius-sm:    4px     (rounded)
--radius-md:    8px     (rounded-lg)
--radius-lg:    12px    (rounded-xl)
--radius-xl:    16px    (rounded-2xl)
--radius-full:  9999px  (rounded-full — pills, avatars)
```

### 2.5 Shadows

```
--shadow-sm:    0 1px 2px rgba(0,0,0,0.05)
--shadow-md:    0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)
--shadow-lg:    0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)
--shadow-xl:    0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)
--shadow-glow:  0 0 30px rgba(255,69,0,0.1)   (accent glow — dark theme)
```

### 2.6 Z-Index Scale

```
--z-base:       0
--z-dropdown:   10
--z-sticky:     20
--z-fixed:      30
--z-sidebar:    30
--z-overlay:    40
--z-modal:      50
--z-toast:      60
```

---

## 3. Biblioteca de Componentes Globais

### 3.1 Primitivas (Radix UI / shadcn/ui)

| Componente | Radix Primitive | Uso |
|-----------|-----------------|-----|
| AlertDialog | @radix-ui/react-alert-dialog | Confirmações destrutivas (deletar secret) |
| Avatar | @radix-ui/react-avatar | Avatares de equipe |
| Button | custom | Ações primárias, secundárias, ghost |
| Checkbox | @radix-ui/react-checkbox | Seleção múltipla |
| Dialog | @radix-ui/react-dialog | Modais (criar projeto, convidar membro) |
| DropdownMenu | @radix-ui/react-dropdown-menu | Menus de ação, filtros |
| Form | React Hook Form + Zod | Validação de formulários |
| Input | custom | Campos de texto, email, senha |
| Label | @radix-ui/react-label | Labels de formulário |
| Popover | @radix-ui/react-popover | Tooltips ricos, filtros avançados |
| Select | @radix-ui/react-select | Seleção de environment, roles |
| Separator | @radix-ui/react-separator | Divisores |
| Sheet | @radix-ui/react-dialog (side) | Sidebar mobile, painéis laterais |
| Skeleton | custom | Loading states |
| Switch | @radix-ui/react-switch | Toggle settings |
| Table | custom | Secrets browser, audit log |
| Tabs | @radix-ui/react-tabs | Navegação por abas (environments) |
| Toast | @radix-ui/react-toast | Feedback de ações |
| Tooltip | @radix-ui/react-tooltip | Sidebar navigation tooltips |

### 3.2 Componentes Compostos (Custom)

| Componente | Descrição | Referência |
|-----------|-----------|------------|
| `SidebarNav` | Navegação lateral fixa com ícones + tooltips | index.html sidebar rail |
| `TopNav` | Barra superior com breadcrumbs + ações | uxjonny sticky nav |
| `ProjectCard` | Card de projeto com status + avatar stack | uxjonny service card |
| `SecretRow` | Linha de secret com masked value + ações | Discovery table |
| `AuditTimeline` | Timeline vertical de eventos | Discovery audit log |
| `EnvSelector` | Tabs/pills para selecionar environment | Discovery env management |
| `MemberAvatar` | Avatar com badge de role | uxjonny status indicator |
| `EmptyState` | Estado vazio com ilustração + CTA | — |
| `CommandPalette` | Cmd+K search/commands | — |
| `StatusBadge` | Badge com dot animado (ping) | uxjonny green status |
| `HeroSection` | Landing hero com 3D background | monolith/uxjonny hero |
| `PricingCard` | Card de plano com destaque | monolith pricing card |
| `TestimonialCard` | Depoimento com avatar | uxjonny testimonial |

---

## 4. Configuração TailwindCSS

```js
// tailwind.config.ts (resumo)
{
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      colors: {
        // Mapear tokens semânticos aqui
      },
      borderRadius: {
        '2xl': '16px',
      },
      maxWidth: {
        '8xl': '1400px',  // Landing
        '7xl': '1280px',  // Monolith container
        '6xl': '1152px',  // Dashboard container
      },
      animation: {
        'ping': 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
}
```

---

## 5. Estrutura de Diretórios

```
apps/web/
├── app/
│   ├── (auth)/                    # Grupo de rotas auth
│   │   ├── login/
│   │   ├── signup/
│   │   └── forgot-password/
│   ├── (marketing)/               # Landing page (dark theme)
│   │   ├── page.tsx               # Hero + features + pricing
│   │   └── layout.tsx             # Dark background
│   ├── (dashboard)/               # App autenticado (light theme)
│   │   ├── layout.tsx             # Sidebar + TopNav shell
│   │   ├── projects/
│   │   │   ├── page.tsx           # Projects list
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # Project detail
│   │   │       ├── secrets/       # Secrets browser
│   │   │       ├── audit/         # Audit log
│   │   │       ├── members/       # Team settings
│   │   │       └── settings/      # Project settings
│   │   ├── account/               # Account settings
│   │   └── integrations/          # Integrations page
│   ├── api/                       # Route handlers
│   └── layout.tsx                 # Root layout
├── components/
│   ├── ui/                        # shadcn/ui primitives
│   ├── layout/                    # SidebarNav, TopNav, Shell
│   ├── project/                   # ProjectCard, ProjectForm
│   ├── secrets/                   # SecretRow, SecretForm, SecretsTable
│   ├── audit/                     # AuditTimeline, AuditFilter
│   ├── team/                      # MemberAvatar, InviteForm, RoleSelector
│   ├── shared/                    # EmptyState, StatusBadge, CommandPalette
│   └── marketing/                 # HeroSection, PricingCard, TestimonialCard
├── lib/
│   ├── crypto.ts                  # AES-GCM encryption/decryption
│   ├── supabase/                  # Supabase client + types
│   ├── auth.ts                    # BetterAuth helpers
│   ├── utils.ts                   # cn() helper, formatters
│   └── validators/                # Zod schemas
├── hooks/                         # Custom hooks
├── stores/                        # Zustand stores
├── styles/
│   └── globals.css                # CSS variables, base styles
└── public/
    └── assets/                    # Static assets
```

---

## 6. Padrões de Implementação

### 6.1 Tema

- **Light** = default (dashboard, app)
- **Dark** = landing/marketing pages, opção no dashboard
- Implementar via `class="dark"` no `<html>` + `dark:` Tailwind variants

### 6.2 Responsividade

- **Mobile-first**: `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px)
- Sidebar colapsa em `<lg` para Sheet (drawer)
- Grid patterns: 1 col (mobile) → 2/3 cols (desktop)

### 6.3 Acessibilidade

- Todas as primitivas Radix são WAI-ARIA compliant
- Focus ring visível em todos os elementos interativos
- `sr-only` para textos auxiliares
- Contraste mínimo WCAG AA (4.5:1)

### 6.4 Performance

- Server Components como padrão
- `dynamic()` para componentes pesados (Three.js, charts)
- Image optimization via `next/image`
- Font optimization via `next/font`
