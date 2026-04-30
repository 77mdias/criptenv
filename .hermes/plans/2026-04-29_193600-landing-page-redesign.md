# Landing Page CriptEnv — Redesign Completo

**Data:** 2026-04-29
**Status:** Planejamento

---

## Goal

Transformar a landing page atual do CriptEnv em uma experiência visual premium, com:
- Navbar lateral (sidebar) com rotas da aplicação
- Uso criativo das imagens disponíveis em `apps/web/assets/images/`
- Cards com efeitos visuais (glassmorphism, backgrounds com imagem)
- Visual dark/misterioso que combine com o tema de secrets/criptografia

---

## Contexto Atual

### Estrutura existente
- **Landing page:** `apps/web/src/app/(marketing)/page.tsx` — layout simples, sem sidebar
- **Marketing layout:** `apps/web/src/app/(marketing)/layout.tsx` — wrapper mínimo
- **Sidebar dashboard:** `apps/web/src/components/layout/sidebar-nav.tsx` — sidebar funcional com collapse, mobile, rotas de projeto
- **Design system:** Dark mode com accent `#ff4500` (laranja-avermelhado), tipografia Geist/Inter, variáveis CSS customizadas

### Imagens disponíveis (8 assets)
| Arquivo | Conteúdo | Uso ideal |
|---------|----------|-----------|
| `master-keys_1200x1200-removebg-preview.png` | Chaves metálicas em fundo preto, removido BG | Hero: imagem principal, transparente sobre gradiente |
| `master-keys_1200x1200.webp` | Mesmo asset em WebP | Fallback/otimização |
| `9b69b392298ba29491396a327328fd3d.jpg` | Checklist 3D rose-gold | Features: card de "organização" |
| `b624778828659539ac4a10aabe9a2728.jpg` | Chave com chaveiro casa 3D (transparente) | Card de "acesso seguro" |
| `fad0f89c8d6a92fc48b19560eef69626.jpg` | Chave antiga espetada em rocha, fundo preto | Background section dramático |
| `fd38db17c342c7ff35cdef34da35da88.jpg` | Buraco de chave com moldura vintage | Card de "zero-knowledge" / símbolo de segredo |
| `secrets-make-you-sick.jpg` | Pessoa fazendo gesto de "silêncio", B&W | Section de privacidade / CTA |
| `Wer haben vergensen.jpeg` | Máscara teatral branca, fundo preto | Section de identidade / "masks we wear" |

---

## Proposta de Design

### 1. Sidebar Lateral de Marketing

Criar um novo componente `MarketingSidebar` inspirado no `sidebar-nav.tsx` existente, mas adaptado para a landing page:

**Rotas da sidebar:**
```
┌─────────────────────┐
│  [C] CriptEnv        │  ← Logo
├─────────────────────┤
│  ▸ Hero (top)        │  ← Âncora
│  ▸ Features          │  ← #features
│  ▸ How It Works      │  ← #how-it-works (NOVA)
│  ▸ Security          │  ← #security (NOVA)
│  ▸ Pricing           │  ← #pricing
│  ▸ CTA               │  ← #cta
├─────────────────────┤
│  ◈ Theme Switch      │  ← Toggle light/dark
│  ◈ Entrar            │  ← Link /login
│  ◈ Começar →         │  ← CTA /signup
├─────────────────────┤
│  ● Online            │  ← Status (reutiliza do dashboard)
└─────────────────────┘
```

**Comportamento:**
- Desktop: sidebar fixa à esquerda (w-60), colapsável (w-16)
- Mobile: overlay com hamburger no topo
- Scroll spy: destaque automático da seção visível
- Transições suaves no collapse (reutiliza `useUIStore`)
- Estilo: mesma base do sidebar-nav mas com adaptações visuais

**Arquivos a criar/modificar:**
- `apps/web/src/components/layout/marketing-sidebar.tsx` (NOVO)
- `apps/web/src/app/(marketing)/layout.tsx` (MODIFICAR)

---

### 2. Hero Section — Impacto Visual com Imagem

**Layout proposto:**
```
┌──────────┬──────────────────────────────────┐
│          │                                   │
│ Sidebar  │  [Badge: Open Source]             │
│          │                                   │
│          │  Secrets seguros,                 │
│          │  equipe feliz.                    │
│          │                                   │
│          │  [imagem: master-keys]            │
│          │  (com glow/luz ambiente)          │
│          │                                   │
│          │  [Botão: Start Project →]         │
│          │  [Botão: Learn More]              │
│          │                                   │
└──────────┴──────────────────────────────────┘
```

**Detalhes visuais:**
- Imagem `master-keys_1200x1200-removebg-preview.png` (BG removido) flutuando ao lado do texto
- Glow effect: `box-shadow` radial laranja/vermelho atrás das chaves
- Fundo: gradiente sutil escuro com noise texture
- Animação: chaves com leve flutuação (keyframe float)
- Layout: split 50/50 no desktop (sidebar + hero), stack no mobile

---

### 3. Features Section — Cards com Imagem de Fundo

**Layout proposto: 2x2 grid com cards temáticos**

| Card | Imagem | Tema |
|------|--------|------|
| Zero-Knowledge | `fd38db17c342c7ff35cdef34da35da88.jpg` (buraco de chave) | Acesso, segredo |
| CLI-First | Gradiente escuro com ícone Terminal | Velocidade, dev |
| Team Sync | `9b69b392298ba29491396a327328fd3d.jpg` (checklist 3D) | Organização, equipe |
| Audit Completo | `b624778828659539ac4a10aabe9a2728.jpg` (chave+casa) | Rastreabilidade |

**Efeito visual dos cards:**
- Background: imagem com overlay escuro (opacity 0.85)
- Glassmorphism sutil: `backdrop-blur-sm` + `bg-white/5`
- Borda: `border-white/10` com glow no hover
- Texto: branco com hierarquia clara
- Hover: escurece mais o overlay, borda brilha, leve scale

---

### 4. Nova Section: "How It Works" com Imagem Dramática

**Imagem:** `fad0f89c8d6a92fc48b19560eef69626.jpg` (chave na rocha) como background de section inteira

**Layout:**
```
┌──────────────────────────────────────────────┐
│  [BG: chave na rocha, overlay 90% preto]      │
│                                               │
│  Como Funciona                                │
│                                               │
│  1. init    → Crie seu projeto                │
│  2. set     → Adicione secrets                │
│  3. push    → Criptografa & sobe              │
│  4. pull    → Equipe baixa decriptado         │
│                                               │
│  [Terminal mockup com comandos]               │
└──────────────────────────────────────────────┘
```

**Detalhes:**
- Background imagem com heavy overlay (não compete com texto)
- Steps numerados com animação de entrada sequencial
- Terminal mockup: card com `bg-black` e código fonte simulado

---

### 5. Nova Section: "Security" com Imagem Conceitual

**Imagem:** `secrets-make-you-sick.jpg` (gesto silêncio, B&W) como accent visual

**Layout:**
```
┌──────────────────────────────────────────┐
│                                          │
│  [imagem B&W]    Segurança que           │
│                   você pode confiar       │
│                                          │
│                  • AES-GCM 256-bit       │
│                  • Zero-knowledge         │
│                  • Client-side only       │
│                  • Open source            │
│                                          │
└──────────────────────────────────────────┘
```

---

### 6. Pricing Section — Cards com Glassmorphism

Melhorar os cards de pricing existentes:
- Card "Construct" (featured): borda accent com glow, badge "Most Popular" com gradiente
- Background: gradient radial sutil por trás
- Transições: hover com elevação + shadow

---

### 7. CTA Final — Imagem de Impacto

**Imagem:** `Wer haben vergensen.jpeg` (máscara teatral) como background artístico

**Layout:**
```
┌──────────────────────────────────────────┐
│  [BG: máscara, overlay 85% escuro]       │
│                                          │
│  Pronto para SEGURAR seus secrets?       │
│                                          │
│  Open source. Zero-knowledge.            │
│  Gratuito para começar.                  │
│                                          │
│  [Get Started Free →]  [GitHub]          │
└──────────────────────────────────────────┘
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/layout/marketing-sidebar.tsx` | CRIAR | Sidebar lateral para landing page |
| `src/app/(marketing)/layout.tsx` | MODIFICAR | Integrar sidebar + main content area |
| `src/app/(marketing)/page.tsx` | MODIFICAR | Redesign completo com imagens e novas sections |
| `src/app/globals.css` | MODIFICAR | Adicionar animações (float, glow) e utilitários |
| `public/images/` | CRIAR | Copiar/symlink assets para acesso público |

---

## Decisões de Design

### Paleta (mantendo o sistema existente)
- **Dark primary:** `#0a0a0b` (background)
- **Accent:** `#ff4500` (laranja-avermelhado — existente)
- **Cards:** `bg-white/5` com `backdrop-blur`
- **Bordas:** `border-white/10` para efeito glass
- **Glow:** `rgba(255, 69, 0, 0.15)` para acentos

### Tipografia (mantendo Geist)
- Hero: `text-7xl font-light` (light weight para elegância)
- Sections: `text-3xl font-semibold`
- Body: `text-base font-light`
- Mono accents para labels técnicos

### Espaçamento
- Sections: `py-24 px-6`
- Cards: `p-6` com `gap-8`
- Sidebar width: `w-60` (expandido), `w-16` (colapsado)

### Animações
- `float`: flutuação suave das chaves no hero (3s infinite)
- `fade-in-up`: entrada sequencial de elementos no scroll
- `glow-pulse`: pulse sutil no accent
- `@media (prefers-reduced-motion: reduce)`: desabilitar animações

---

## Ordem de Execução

1. **Setup:** Copiar images para `public/images/` (ou configurar next.config para servir de `assets/`)
2. **Sidebar:** Criar `marketing-sidebar.tsx` baseado no `sidebar-nav.tsx`
3. **Layout:** Atualizar `(marketing)/layout.tsx` para incluir sidebar
4. **Hero:** Redesign com imagem das chaves + split layout
5. **Features:** Cards com imagens de fundo + glassmorphism
6. **How It Works:** Nova section com imagem dramática
7. **Security:** Nova section com imagem B&W
8. **Pricing:** Melhorar cards existentes
9. **CTA:** Redesign com imagem da máscara
10. **Polish:** Animações, responsividade, testes visuais

---

## Validação

- [ ] Sidebar: collapse/expand funciona
- [ ] Sidebar: scroll spy destaca seção correta
- [ ] Sidebar: mobile overlay funciona
- [ ] Hero: imagem carrega e tem glow effect
- [ ] Features: cards com imagem de fundo legíveis
- [ ] Responsivo: mobile não quebra
- [ ] Dark/Light: ambos os temas funcionam
- [ ] Performance: imagens otimizadas (WebP onde possível)
- [ ] Acessibilidade: contraste de texto OK, focus states

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Imagens pesadas no hero | Usar WebP + lazy loading + blur placeholder |
| Texto ilegível sobre imagens | Overlay escuro suficiente (0.85+) |
| Sidebar mobile confusa | Reutilizar padrão do dashboard (overlay + hamburger) |
| Glassmorphism em browsers antigos | Fallback para bg sólido |
| Scroll spy performance | Throttle no event listener |

---

## Próximo Passo

Aprovar este plano e executar na ordem definida. Cada etapa pode ser validada independentemente antes de prosseguir.
