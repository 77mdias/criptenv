# Cloudflare Workers SSR Constraints

## Rule
The frontend is deployed on Cloudflare Workers. The Workers runtime prohibits asynchronous I/O, timers (`setTimeout`, `setInterval`), and random value generation (`Math.random`, `crypto.getRandomValues`) in the **global scope** during SSR.

## Error Signature
```
Disallowed operation called within global scope. Asynchronous I/O (ex: fetch() or connect()), setting a timeout, and generating random values are not allowed within global scope.
```

## Causes
- Libraries like **GSAP**, **Three.js**, or any library that calls `setTimeout` at module initialization time
- Canvas/WebGL code running at import time
- Any `fetch()` or network call outside of a request handler

## Prevention Checklist
- [ ] GSAP imports → `next/dynamic` with `ssr: false`
- [ ] ScrollTrigger plugin registration → inside component, not module top-level
- [ ] Three.js scenes → `ssr: false`
- [ ] Canvas manipulation → `ssr: false` or `typeof window !== 'undefined'` guard
- [ ] Any library with side effects on import → verify it doesn't use timers

## Correct Pattern (GSAP)
```tsx
// In page.tsx
import dynamic from "next/dynamic"

const ProblemToVaultSection = dynamic(
  () => import("@/components/marketing/problem-to-vault-section").then((mod) => mod.ProblemToVaultSection),
  { ssr: false }
)
```

## Incorrect Pattern (DO NOT DO)
```tsx
// In page.tsx — this evaluates GSAP at SSR time!
import { ProblemToVaultSection } from "@/components/marketing/problem-to-vault-section"

// In component file — this calls setTimeout at import time!
import gsap from "gsap"
gsap.registerPlugin(ScrollTrigger) // ❌ Triggers setTimeout in global scope
```

## Historical Incident
- **Date**: 2026-05-11
- **Component**: `apps/web/src/app/(marketing)/page.tsx`
- **Issue**: `ProblemToVaultSection` and `SecurityScrollytelling` imported directly, causing GSAP to initialize during SSR in the Worker
- **Fix**: Converted both to `next/dynamic` with `ssr: false`
