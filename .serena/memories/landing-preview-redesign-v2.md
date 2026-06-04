# Landing Page Preview Section - Redesign v2

## Final State

### File Modified
- `apps/web/src/components/marketing/platform-preview-section.tsx`

### Key Design Decisions

1. **Background DB Visibility (Balanced)**
   - Opacidade: 0.15 (textura sutil, não legível)
   - Blur: 2px (desfoca linhas do DB para não competir com texto)
   - Overlay: bg-(--background-subtle)/80 (forte, garante legibilidade do texto)
   - Resultado: DB é percebido como textura de fundo, mas o texto é perfeitamente legível

2. **Desktop Dominates**
   - Grid: `[0.6fr_1.4fr]` - desktop column tem 70% mais espaço que texto
   - Desktop screenshot: 1919×956 (proporção 2:1), renderizado com `w-full` sem crop
   - Desktop é claramente o elemento principal visual

3. **Mobile as Accent**
   - Tamanho: 22-24% da largura (muito menor que desktop)
   - Posição: bottom-left, não cobre o centro do desktop
   - Efeito: perspective 3D sutil (rotateY 5deg)
   - Funciona como elemento secundário de acento, não competindo com o desktop

4. **Theme Switching**
   - Desktop: capture-desk-dark.png / capture-desk-light.png
   - Mobile: capture-mobile-dark.png / criptenv-capturemobile.jpeg
   - Background: db-mocked.png / db-mocked-light.png
   - Tudo alterna automaticamente via hook useTheme

5. **Typography**
   - Título: "Criptografe tudo. / Colabore livre." com "livre" em emerald
   - Subtitle legível com max-w-md e cor text-tertiary
   - CTA: botão verde pill + link text
   - Feature pills: Zero-Knowledge + Velocidade real

6. **Floating Elements**
   - Badge "Server saw 0 plaintext" (top-right, animado)
   - Badge "AES-256-GCM Selado client-side" (bottom-right, animado)
   - Green glow radial no background
   - Grid pattern pontilhado no rodapé da seção