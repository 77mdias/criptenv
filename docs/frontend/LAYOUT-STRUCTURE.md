# LAYOUT-STRUCTURE.md — CriptEnv

> Grid, layout, and shell structure that must be followed across all screens.
> Ensures consistency with the Roadmap device targets (Mobile/Desktop).

---

## 1. Shell — Estrutura Principal

### 1.1 Dashboard Shell (Autenticado)

```
┌────────────────────────────────────────────────────────────────────┐
│ TopNav (sticky, h-16)                                              │
│ bg-white/90 backdrop-blur-sm border-b border-neutral-200           │
│                                                                    │
│ [Logo]  [Breadcrumb: Projects > my-api > Secrets]  [User Avatar ▼]│
├────────┬───────────────────────────────────────────────────────────┤
│        │                                                           │
│ Side   │  Main Content Area                                        │
│ bar    │  max-w-6xl (1152px) mx-auto                               │
│ w-240  │                                                           │
│        │  ┌─────────────────────────────────────────────────────┐  │
│ (fixed │  │  Page Header                                        │  │
│  left) │  │  [Title] [Subtitle]              [Primary Action]   │  │
│        │  ├─────────────────────────────────────────────────────┤  │
│        │  │                                                     │  │
│        │  │  Page Content                                       │  │
│        │  │                                                     │  │
│        │  │                                                     │  │
│        │  └─────────────────────────────────────────────────────┘  │
│        │                                                           │
├────────┴───────────────────────────────────────────────────────────┤
│ Footer (optional, minimal)                                         │
│ border-t border-neutral-100 py-4 px-6                              │
│ [Status badge]  [Version]  [Help link]                             │
└────────────────────────────────────────────────────────────────────┘
```

### 1.2 Marketing Shell (Não-autenticado)

```
┌────────────────────────────────────────────────────────────────────┐
│ TopNav (fixed, transparent → bg-white on scroll)                   │
│ z-50, px-6 sm:px-12                                                │
│                                                                    │
│ [Logo]  [Nav links: Features, Pricing, Docs]  [Login] [Sign Up]   │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Hero Section (h-screen)                                           │
│  3D Background (Three.js)                                          │
│  [Title] [Subtitle] [CTA buttons]                                  │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Features Section                                                  │
│  py-24 px-6 sm:px-8                                                │
│  max-w-6xl mx-auto                                                 │
│  Grid: 3 columns                                                   │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Pricing Section                                                   │
│  Grid: 3 columns (Protocol, Construct, Enterprise)                 │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  CTA Section                                                       │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ Footer                                                             │
│ border-t border-neutral-200                                        │
│ Grid: 2 columns                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. Grid System

### 2.1 Base Grid (Tailwind)

```
Container: max-w-6xl (1152px) mx-auto px-6 sm:px-8
Gaps: gap-4 (16px), gap-6 (24px), gap-8 (32px), gap-12 (48px)
```

### 2.2 Grid Patterns

#### 12-Column Grid (Project Detail, Profile)

```
grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12

Examples:
- Portrait + Content: col-span-5 + col-span-7
- Sidebar + Main: col-span-3 + col-span-9
- Full width: col-span-12
```

#### 3-Column Grid (Cards, Pricing)

```
grid grid-cols-1 lg:grid-cols-3 gap-8

Used for:
- Service cards
- Pricing cards
- Feature cards
- Project grid (overview)
```

#### 2-Column Grid (Split Layout)

```
grid grid-cols-1 lg:grid-cols-2 gap-12

Used for:
- Project detail (text + image)
- Testimonials
- Settings (form + preview)
- Login/Signup split
```

#### 4-Column Grid (Stats, Filters)

```
grid grid-cols-2 lg:grid-cols-4 gap-4

Used for:
- Dashboard stat cards
- Color swatches
- Filter chips
```

#### Bento Grid (Gallery)

```
grid grid-cols-2 lg:grid-cols-6 gap-4

Item sizes:
- span-4 (large item)
- span-2 (medium item)
- span-3 (half width)
```

---

## 3. Spacing Rules

### 3.1 Section Spacing

```
Section vertical padding:  py-24 (96px) on desktop, py-16 (64px) on mobile
Section horizontal:        px-6 (mobile), sm:px-8 (desktop)
Section gap (between):     space-y-0 (borders handle separation)
```

### 3.2 Content Spacing

```
Page header → Content:     mb-8 (32px)
Card internal padding:     p-6 (24px), p-8 (32px) for large cards
Card gap in grid:          gap-6 (24px), gap-8 (32px)
Form field gap:            space-y-4 (16px) or space-y-6 (24px)
Inline element gap:        gap-2 (8px), gap-3 (12px), gap-4 (16px)
```

### 3.3 Component Spacing

```
Button → Button:           gap-4 (16px)
Icon → Text:               gap-2 (8px)
Badge → Badge:             gap-2 (8px)
Avatar stack overlap:      -space-x-2 (overlapping avatars)
Table row height:          py-4 (16px) per row
Modal padding:             p-6 (24px), sm:p-8 (32px)
Modal max-width:           max-w-lg (512px), max-w-xl (576px) for forms
```

---

## 4. Breakpoints

```
Mobile:    default (< 640px)
Tablet:    sm: (≥ 640px)
Desktop:   md: (≥ 768px)
Large:     lg: (≥ 1024px)
XL:        xl: (≥ 1280px)
```

### Responsive Behavior Rules

| Component | Mobile (<640px) | Tablet (640-1023px) | Desktop (≥1024px) |
|-----------|-----------------|--------------------|--------------------|
| **Sidebar** | Hidden, Sheet drawer | Hidden, Sheet drawer | Fixed 240px |
| **TopNav** | Hamburger + Logo + Avatar | Logo + Nav + Avatar | Full nav + breadcrumbs |
| **Grid (3-col)** | 1 column | 2 columns | 3 columns |
| **Grid (2-col)** | 1 column | 1 column | 2 columns |
| **Stats cards** | 2 columns | 2 columns | 4 columns |
| **Table** | Card view (stacked) | Scrollable table | Full table |
| **Modal** | Full-screen sheet | Centered modal | Centered modal |
| **Section padding** | py-16 px-6 | py-24 px-8 | py-24 px-8 |
| **Typography H1** | text-5xl | text-7xl | text-8xl |
| **Typography H2** | text-3xl | text-4xl | text-4xl |

---

## 5. Sidebar Dimensions

```
Width (expanded):    240px (w-60)
Width (collapsed):   64px (w-16)
Height:              100vh (fixed)
Background:          bg-white
Border:              border-r border-neutral-200
Shadow:              none (flat against content)
Z-index:             z-30

Item height:         h-10 (40px)
Item padding:        px-3 (12px)
Item gap:            gap-1 (4px) between items
Icon size:           w-4 h-4 (16px)
Label font:          text-sm font-medium
Section gap:         py-2 (8px) between groups
Bottom section:      mt-auto (pushed to bottom)
```

---

## 6. TopNav Dimensions

```
Height:              h-16 (64px)
Background:          bg-white/90 backdrop-blur-sm
Border:              border-b border-neutral-200
Padding:             px-6
Z-index:             z-50 (above sidebar)
Position:            sticky top-0

Logo area:           w-240 (aligned with sidebar)
Breadcrumb area:     flex-1
Actions area:        flex items-center gap-4
```

---

## 7. Content Area

```
Max width:           max-w-6xl (1152px)
Margin:              mx-auto
Padding:             py-8 px-0 (sidebar handles horizontal)

Page header:
  - Title:           text-3xl font-semibold tracking-tight
  - Subtitle:        text-lg text-neutral-500 font-mono
  - Action button:   positioned right, aligned with title

Content below header:
  - Cards:           gap-6 or gap-8
  - Tables:          full-width within container
  - Forms:           max-w-2xl (672px) centered or left-aligned
```

---

## 8. Landing Page Sections

### Section Order (Priority)

```
1. Hero (h-screen, dark bg with 3D)
   - Badge: "Design System v1.0"
   - Title: "Building Digital Systems"
   - Subtitle: product description
   - CTA: "Start Project" + "Learn More"

2. Features (py-24, alternating bg)
   - Grid 3-col
   - Each: icon + title + description

3. How It Works (py-24)
   - Steps: 1 → 2 → 3
   - Each step: number + title + description

4. Pricing (py-24)
   - Grid 3-col
   - Protocol ($15k) | Construct ($35k) | Enterprise (Custom)
   - Featured card with "Most Popular" badge

5. Testimonials (py-24, bg-neutral-50)
   - Grid 2-col
   - Quote + avatar + name + role

6. CTA (py-24)
   - "Ready to secure your secrets?"
   - Primary button: "Get Started"
   - Secondary: "View on GitHub"

7. Footer
   - 2-col: Brand + Nav links
   - Status badge
```

---

## 9. Scrollbar Styles

```css
/* Webkit */
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: #f5f5f5; }
::-webkit-scrollbar-thumb { background: #d4d4d4; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #a3a3a3; }

/* Firefox */
* { scrollbar-width: thin; scrollbar-color: #d4d4d4 transparent; }

/* Dark theme override */
.dark ::-webkit-scrollbar-track { background: transparent; }
.dark ::-webkit-scrollbar-thumb { background: rgba(255,69,0,0.3); }
```

---

## 10. Selection Styles

```css
::selection {
  background: rgba(255,69,0,0.3);
  color: #e8e6e3;
}

/* Light theme */
::selection {
  background: #E5E5E5;
  color: #171717;
}
```

---

## 11. Focus Styles

```css
/* Ring pattern for all interactive elements */
focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2

/* Dark theme */
dark:focus-visible:ring-neutral-100

/* Button specific */
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
```

---

## 12. Animation Timing

| Interaction | Duration | Easing | Property |
|------------|----------|--------|----------|
| Button hover | 150ms | ease | background-color, color |
| Card hover | 300ms | ease | box-shadow, transform |
| Card lift | 500ms | ease | transform (translateY) |
| Image grayscale | 700ms | ease | filter |
| Nav hover | 150ms | ease | color |
| Modal enter | 200ms | ease-out | opacity, transform |
| Modal exit | 150ms | ease-in | opacity, transform |
| Toast enter | 300ms | ease-out | transform (slide-in) |
| Toast exit | 200ms | ease-in | opacity |
| Sidebar collapse | 200ms | ease | width |
| Tooltip | 150ms | ease-out | opacity |

---

## 13. Selection & Focus Patterns

### Keyboard Navigation

- Tab order follows visual layout (left-to-right, top-to-bottom)
- Sidebar items: sequential tab order
- Skip-to-content link for screen readers
- Escape closes modals, dropdowns, sheets

### Focus Trap

- Modals: focus trapped within modal
- Sheets: focus trapped within sheet
- Dropdowns: arrow keys navigate items

### ARIA Patterns

- Sidebar: `role="navigation"`, `aria-label="Main navigation"`
- Tables: `role="table"` with proper `th`, `scope`
- Modals: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Status badges: `role="status"`, `aria-live="polite"`
- Toasts: `role="alert"`, `aria-live="assertive"`
