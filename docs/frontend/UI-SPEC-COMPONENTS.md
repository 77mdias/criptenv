# UI-SPEC-COMPONENTS.md — CriptEnv

> Technical behavior specification for every component. A developer or AI should be able to implement without consulting original documents.

---

## 1. Button

### Variantes

| Variant | Background | Text | Border | Hover | Disabled |
|---------|-----------|------|--------|-------|----------|
| **Primary** | `neutral-900` | `white` | none | `neutral-800` | `opacity-50 cursor-not-allowed` |
| **Secondary** | transparent | `neutral-900` | `neutral-200` | `bg-neutral-50` | `opacity-50 cursor-not-allowed` |
| **Ghost** | transparent | `neutral-900` | `border-b border-black` | `text-neutral-600 border-neutral-400` | — |
| **Danger** | `red-600` | `white` | none | `red-700` | `opacity-50` |
| **Pill** | `white` | `neutral-900` | `neutral-200` | `bg-neutral-50 shadow-md` | — |

### Sizes

| Size | Padding | Font Size | Border Radius |
|------|---------|-----------|---------------|
| **sm** | `px-4 py-2` | `text-xs` | `rounded-lg` |
| **md** (default) | `px-6 py-3` | `text-sm` | `rounded-lg` |
| **lg** | `px-8 py-4` | `text-sm` | `rounded-full` (pill) |
| **icon** | `w-10 h-10` | — | `rounded-full` |

### States

```
Default  →  Hover (150ms transition-colors)  →  Active (scale-[0.98])  →  Focus (ring-2 ring-offset-2)  →  Disabled (opacity-50, no pointer events)
```

### Loading State

- Adiciona `animate-spin` icon (Lucide `loader-2`) à esquerda do texto
- `aria-busy="true"`, `disabled` attribute
- Texto muda para "Verificando..." ou ação correspondente
- Preserva largura do botão (não colapsa)

### Props

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'pill'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
}
```

---

## 2. Input / TextField

### Variantes

| State | Background | Border | Text | Label |
|-------|-----------|--------|------|-------|
| **Default** | `white` | `neutral-200` | `neutral-900` | `neutral-500 text-xs uppercase tracking-wider font-mono` |
| **Focus** | `white` | `neutral-900` (2px) | `neutral-900` | `neutral-900` |
| **Error** | `white` | `red-500` | `neutral-900` | `red-600` |
| **Disabled** | `neutral-50` | `neutral-200` | `neutral-400` | `neutral-400` |
| **Success** | `white` | `green-500` | `neutral-900` | `green-700` |

### Validação (baseada no Discovery)

| Field | Regra | Mensagem de Erro |
|-------|-------|-----------------|
| **Project Name** | Required, 3-50 chars, alphanumeric + hyphens | "Nome deve ter 3-50 caracteres alfanuméricos" |
| **Secret Key** | Required, uppercase + underscores, 3-64 chars | "Chave deve ser UPPER_CASE, 3-64 caracteres" |
| **Secret Value** | Required, min 1 char, max 10KB | "Valor obrigatório (máx 10KB)" |
| **Email** | Required, valid email format | "Email inválido" |
| **Password** | Required, min 8 chars, 1 uppercase, 1 number, 1 special | "Mínimo 8 caracteres com maiúscula, número e símbolo" |
| **Environment Name** | Required, lowercase + hyphens, 2-20 chars | "Nome deve ser lowercase, 2-20 caracteres" |

### Secret Input (máscara)

- Valor mascarado por padrão: `••••••••••`
- Botão "Reveal" (ícone `eye`/`eye-off`) mostra/esconde valor
- Botão "Copy" (ícone `clipboard`) copia para clipboard
- Clipboard auto-clear em 30 segundos
- Valor NUNCA enviado ao servidor em plain-text

### Props

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  success?: string
  helperText?: string
  icon?: LucideIcon
  suffix?: React.ReactNode
}
```

---

## 3. Select / Dropdown

### Comportamento

- `appearance: none` + custom chevron icon
- Abre para baixo (Popover do Radix)
- Opções com check icon na direita quando selecionada
- Suporte a grouped options (optgroup)
- Search/filter quando > 5 opções

### Environment Selector

- Tabs horizontais: `development | staging | production | custom`
- Tab ativa: `border-b-2 border-neutral-900 font-semibold`
- Contador de secrets por environment ao lado de cada tab

### Role Selector (Team)

| Role | Description | Icon |
|------|-------------|------|
| Owner | Full access, delete project | `shield-check` |
| Admin | Manage members, all secrets | `shield` |
| Developer | Read/write in assigned envs | `code` |
| Viewer | Read-only (masked values) | `eye` |
| CI/CD | Read-only via token | `bot` |

---

## 4. Card

### Service Card (Project Card)

```
┌─────────────────────────────────────────┐
│ [Badge: Environment type]               │
│                                         │
│  Illustration / Icon area               │
│  (h-48, bg-neutral-100, rounded-xl)     │
│                                         │
├─────────────────────────────────────────┤
│ [Badge: tag]                            │
│                                         │
│ Project Name            (text-xl, bold) │
│ Description             (text-sm, muted)│
│                                         │
│ [Avatar stack] [Last modified]          │
│                                         │
│ [Link: "View project →"]                │
└─────────────────────────────────────────┘
```

- **Hover**: `shadow-xl`, illustration `translate-y-2` (lift effect), `duration-500`
- **Border**: `neutral-200` default → `neutral-300` on hover

### Pricing Card (Landing)

- Default: `bg-white border-neutral-200`
- Featured: `bg-neutral-50 border-neutral-900` + "Most Popular" badge (pill, `bg-neutral-900 text-white`)
- CTA button style follows card: Primary for featured, Secondary for default

### Testimonial Card

- `bg-neutral-50 rounded-2xl border-neutral-200`
- Quote icon (`quote` from Lucide, `text-neutral-300 w-8`)
- Avatar circle (`w-10 h-10 rounded-full bg-neutral-200`)
- Name + role below avatar

---

## 5. Secret Row / Table

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ 🔑  DATABASE_URL    ••••••••••••••••    [Copy] [Edit] [Delete]  │
│     development · Updated 5 min ago by @alice                    │
└──────────────────────────────────────────────────────────────────┘
```

### Columns

| Column | Content | Width | Behavior |
|--------|---------|-------|----------|
| Icon | Lock icon, color by status | 40px | — |
| Key | `KEY_NAME` (font-mono, bold) | 25% | Sortable |
| Value | `••••••••` (masked) | 35% | Click "Reveal" to show |
| Environment | Badge (pill) | 10% | Filterable |
| Updated | "5 min ago" (relative) | 10% | Sortable |
| Actions | Copy, Edit, Delete | 10% | Dropdown on mobile |

### States

| State | Visual |
|-------|--------|
| Default | White background |
| Hover | `bg-neutral-50` |
| Selected | `bg-blue-50 border-l-2 border-blue-500` |
| Stale (>90d) | Yellow warning icon + "Stale" badge |
| Locked (prod) | Lock icon + "Requires approval" tooltip |

### Validação na Edição

- Key: READ-ONLY após criação (renomear = delete + create)
- Value: Editável, sempre criptografado antes de enviar
- Environment: Select com opções válidas do projeto

---

## 6. Sidebar Navigation (Shell)

### Estrutura (baseado em index.html + imagem.png)

```
┌──────────────────────────────────────────────────────────────┐
│ [Logo: CriptEnv]              [Breadcrumbs]     [User Menu]  │
├────────┬─────────────────────────────────────────────────────┤
│        │                                                     │
│ [🏠]   │  Content Area                                       │
│ [📁]   │                                                     │
│ [👥]   │                                                     │
│ [📋]   │                                                     │
│ [⚙️]   │                                                     │
│        │                                                     │
│ ────── │                                                     │
│ [?]    │                                                     │
│ [👤]   │                                                     │
│        │                                                     │
├────────┴─────────────────────────────────────────────────────┤
│ [Status: Online · Last synced 5 min ago]                     │
└──────────────────────────────────────────────────────────────┘
```

### Sidebar Items

| Icon | Label | Route | Tooltip (collapsed) |
|------|-------|-------|---------------------|
| `layout-dashboard` | Dashboard | `/dashboard` | "Dashboard" |
| `folder` | Projects | `/projects` | "Projects" |
| `users` | Team | `/projects/[id]/members` | "Team" |
| `scroll-text` | Audit Log | `/projects/[id]/audit` | "Audit Log" |
| `settings` | Settings | `/projects/[id]/settings` | "Settings" |
| — | divider | — | — |
| `circle-help` | Help | external docs | "Help" |
| `user` | Account | `/account` | "Account" |

### Comportamento

- **Desktop (≥lg)**: Sidebar fixa, 240px width, `bg-white border-r border-neutral-200`
- **Collapsed**: 64px width, apenas ícones + tooltips (hover para ver label)
- **Mobile (<lg)**: Sidebar hidden, trigger via hamburger button → Sheet (drawer) slide-in left
- **Active item**: `bg-neutral-100 text-neutral-900 font-semibold` + left border accent
- **Default item**: `text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50`
- **Tooltip**: Appears on hover when collapsed, `bg-neutral-900 text-white text-xs px-2 py-1 rounded`

### Props

```typescript
interface SidebarNavProps {
  items: NavItem[]
  collapsed?: boolean
  onToggle?: () => void
}

interface NavItem {
  icon: LucideIcon
  label: string
  href: string
  active?: boolean
  badge?: number  // notification count
  children?: NavItem[]
}
```

---

## 7. Audit Timeline

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ [Filter: User ▼] [Filter: Action ▼] [Filter: Date ▼]   │
│                                            [Export JSON] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ●  10:30  @alice  updated  STRIPE_KEY                   │
│ │         ─────────────────────────────────             │
│ ●  10:28  @bob    viewed   DATABASE_URL                 │
│ │         ─────────────────────────────────             │
│ ●  09:15  @alice  pushed   (15 secrets)                 │
│ │         ─────────────────────────────────             │
│ ●  09:00  @charlie joined  viewer role                  │
│                                                         │
│ [Load more...]                                          │
└─────────────────────────────────────────────────────────┘
```

### Event Types

| Event | Icon | Color | Description |
|-------|------|-------|-------------|
| `secret.created` | `plus-circle` | green | Secret adicionado |
| `secret.updated` | `pencil` | blue | Secret modificado |
| `secret.deleted` | `trash-2` | red | Secret removido |
| `secret.viewed` | `eye` | neutral | Secret visualizado |
| `secret.exported` | `download` | amber | Export realizado |
| `env.created` | `folder-plus` | green | Environment criado |
| `member.joined` | `user-plus` | green | Membro entrou |
| `member.removed` | `user-minus` | red | Membro removido |
| `vault.pushed` | `upload` | blue | Push de secrets |
| `key.rotated` | `refresh-cw` | purple | Chave rotacionada |

### Filtros

- **User**: Multi-select com avatares
- **Action**: Multi-select com ícones
- **Date Range**: Date picker (from/to)
- **Environment**: Select único

### Paginação

- Infinite scroll ou "Load more" button
- 20 eventos por página
- Retention: Free 30d, Pro 1y, Enterprise unlimited

---

## 8. Invite Modal

### Campos

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Email | email input | ✅ | Valid email, not already member |
| Role | select | ✅ | developer, viewer (admin only: admin) |
| Environments | multi-select | ❌ | Default: all non-production |

### Fluxo

1. User preenche email + seleciona role
2. Click "Send Invitation"
3. Validação client-side (email format)
4. Server Action: create invitation
5. Toast: "Convite enviado para alice@example.com"
6. Member aparece na lista com badge "Pending"
7. Convite expira em 7 dias

---

## 9. Status Badge

### Variantes

| Status | Background | Text | Dot | Animation |
|--------|-----------|------|-----|-----------|
| **Online/Active** | `green-50` | `green-700` | `green-500` | `animate-ping` (dot) |
| **Pending** | `amber-50` | `amber-700` | `amber-500` | none |
| **Offline/Error** | `red-50` | `red-700` | `red-500` | none |
| **Stale** | `yellow-50` | `yellow-700` | `yellow-500` | none |
| **Synced** | `blue-50` | `blue-700` | `blue-500` | none |

### Implementação

```tsx
<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 text-xs font-mono">
  <span className="relative flex h-2 w-2">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
  </span>
  Online
</div>
```

---

## 10. Toast / Notification

### Variantes

| Type | Icon | Background | Border |
|------|------|-----------|--------|
| **Success** | `check-circle` | `green-50` | `green-200` |
| **Error** | `x-circle` | `red-50` | `red-200` |
| **Warning** | `alert-triangle` | `amber-50` | `amber-200` |
| **Info** | `info` | `blue-50` | `blue-200` |

### Comportamento

- Position: bottom-right (desktop), top-center (mobile)
- Auto-dismiss: 5 segundos (success), 8 segundos (error), manual close
- Stack: até 3 toasts visíveis, mais antigos fecham automaticamente
- Animate: slide-in from right, fade-out

---

## 11. Skeleton / Loading

### Pattern

- Rounded rectangles com `bg-neutral-200 animate-pulse`
- Shapes correspondem ao conteúdo real:
  - Text: `h-4 w-3/4 rounded-full`
  - Avatar: `w-10 h-10 rounded-full`
  - Card: `h-48 rounded-xl`
  - Table row: `h-12 w-full rounded`
- Shimmer effect via `animate-pulse` (Tailwind default)

---

## 12. Empty State

### Layout

```
┌─────────────────────────────────────────┐
│                                         │
│         [Illustration/Icon]             │
│         (w-16 h-16, neutral-300)        │
│                                         │
│     "Nenhum secret encontrado"          │
│     (text-lg font-semibold)             │
│                                         │
│     "Adicione seu primeiro secret       │
│      para começar."                     │
│     (text-sm text-neutral-500)          │
│                                         │
│     [Primary Button: "Criar Secret"]    │
│                                         │
└─────────────────────────────────────────┘
```

- Centralizado vertical e horizontalmente
- Ícone/illustração relacionado ao contexto
- CTA primário para ação principal
- Link secundário opcional ("Importar .env")
