# Landing Page Preview Section Redesign

## Changes Made

### File Modified
- `apps/web/src/components/marketing/platform-preview-section.tsx`
- `apps/web/src/app/globals.css` (added `float-badge` keyframe animation)
- Copied new images to `apps/web/public/images/`

### Key Changes
1. **Full viewport height**: Added `min-h-screen` to make the preview section fill the entire viewport
2. **Larger desktop preview**: Changed grid to `[0.85fr_1.15fr]` giving more space to the right column, increased aspect ratio to `16/12`
3. **Mobile device mockup**: Added realistic iPhone status bar with:
   - Time display (9:41)
   - Dynamic Island notch
   - WiFi and battery icons
   - Bottom home indicator bar
4. **Visible DB background**: Increased opacity from 0.18 to 0.45 with reduced blur (1px) so the database table is clearly visible
5. **Removed badge**: Eliminated the "MAIS QUE UM VAULT. SEGURANÇA PONTA A PONTA." pill component
6. **Theme switching**: Images now switch between dark/light variants based on theme
7. **Floating badges**: Added animated floating badges ("Server saw 0 plaintext" and "AES-256-GCM Selado client-side")
8. **Grid pattern**: Added subtle dotted grid pattern at the bottom of the section

### New Images Added to Public
- `capture-desk-dark.png`
- `capture-desk-light.png`  
- `capture-mobile-dark.png`
- `db-mocked-light.png`

### Design Inspiration
Abacatepay-style layout with:
- Bold two-line headline with accent color
- CTA pill button + text link
- Feature pills with icons
- Desktop + mobile composite hero with 3D perspective
- Subtle green glow effects
- Professional spacing and typography