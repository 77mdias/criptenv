"use client"

import { useEffect, useRef, useState } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import {
  ArrowRight,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Server,
  ShieldCheck,
  Terminal,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

gsap.registerPlugin(ScrollTrigger, useGSAP)

const secretFragments = [
  { name: ".env.local", value: "local plaintext" },
  { name: "DATABASE_URL", value: "postgres://..." },
  { name: "SUPABASE_KEY", value: "service_role" },
  { name: "STRIPE_SECRET", value: "sk_live_..." },
  { name: "CI_TOKEN", value: "runner token" },
]

const pipelineSteps = [
  { label: "plain env", icon: Terminal },
  { label: "AES-GCM local seal", icon: Fingerprint },
  { label: "encrypted vault", icon: LockKeyhole },
]

const proofPoints = [
  "server sees: ciphertext",
  "plaintext: never",
  "audit hash: chained",
]

const vaultRows = [
  { label: "ciphertext", value: "f8a1...91c4" },
  { label: "iv + auth tag", value: "12b / 128b" },
  { label: "team keyring", value: "wrapped" },
]

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  })

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    query.addEventListener("change", handleChange)
    return () => query.removeEventListener("change", handleChange)
  }, [])

  return prefersReducedMotion
}

function ProblemToVaultSection() {
  const scope = useRef<HTMLElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  useGSAP(
    () => {
      const root = scope.current
      if (!root) return

      const fragments = gsap.utils.toArray<HTMLElement>(
        "[data-vault-motion='fragment']",
      )
      const lineFill = root.querySelector<HTMLElement>(
        "[data-vault-motion='line-fill']",
      )
      const vault = root.querySelector<HTMLElement>(
        "[data-vault-motion='vault']",
      )
      const vaultDoor = root.querySelector<HTMLElement>(
        "[data-vault-motion='vault-door']",
      )
      const proofItems = gsap.utils.toArray<HTMLElement>(
        "[data-vault-motion='proof']",
      )
      const steps = gsap.utils.toArray<HTMLElement>(
        "[data-vault-motion='step']",
      )

      if (reducedMotion) {
        gsap.set([...fragments, ...proofItems, ...steps, vault, lineFill, vaultDoor], {
          clearProps: "all",
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
        })
        return
      }

      // Fragments — slide in from left
      gsap.from(fragments, {
        opacity: 0,
        x: -40,
        y: 24,
        duration: 0.9,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: {
          trigger: root.querySelector("[data-vault-motion='fragment']")?.parentElement,
          start: "top 82%",
          once: true,
        },
      })

      // Pipeline steps — fade up
      gsap.from(steps, {
        opacity: 0,
        y: 28,
        duration: 0.8,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: {
          trigger: root.querySelector("[data-vault-motion='step']")?.parentElement,
          start: "top 80%",
          once: true,
        },
      })

      // Line fill — grow
      if (lineFill) {
        gsap.fromTo(
          lineFill,
          { scaleX: 0, transformOrigin: "left center" },
          {
            scaleX: 1,
            duration: 1.0,
            ease: "power2.inOut",
            scrollTrigger: {
              trigger: lineFill.parentElement,
              start: "top 78%",
              once: true,
            },
          },
        )
      }

      // Vault card — slide in from right
      if (vault) {
        gsap.from(vault, {
          opacity: 0,
          x: 50,
          scale: 0.94,
          duration: 1.0,
          ease: "power3.out",
          scrollTrigger: {
            trigger: vault,
            start: "top 80%",
            once: true,
          },
        })
      }

      // Vault door — pop in with elastic feel
      if (vaultDoor) {
        gsap.from(vaultDoor, {
          opacity: 0,
          scale: 0.85,
          duration: 0.7,
          ease: "back.out(1.6)",
          scrollTrigger: {
            trigger: vaultDoor,
            start: "top 76%",
            once: true,
          },
        })
      }

      // Proof items — subtle fade up
      gsap.from(proofItems, {
        opacity: 0,
        y: 20,
        duration: 0.8,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: {
          trigger: root.querySelector("[data-vault-motion='proof']")?.parentElement,
          start: "top 84%",
          once: true,
        },
      })
    },
    { scope, dependencies: [reducedMotion], revertOnUpdate: true },
  )

  return (
    <section
      id="problem-to-vault"
      ref={scope}
      className="relative overflow-hidden bg-[var(--background-subtle)] px-6 py-20 sm:px-8 sm:py-24 lg:flex lg:min-h-screen lg:items-center lg:py-0"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_42%,rgba(156,255,74,0.10),transparent_32%),radial-gradient(circle_at_58%_70%,rgba(125,211,252,0.08),transparent_30%)] dark:bg-[radial-gradient(circle_at_78%_42%,rgba(156,255,74,0.10),transparent_32%),radial-gradient(circle_at_58%_70%,rgba(125,211,252,0.06),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/12" />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[0.88fr_1.12fr]">
        <div className="max-w-2xl">
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
            Problem to Vault
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-5xl md:leading-[1.04]">
            Do <span className="font-mono text-[0.82em]">.env</span> solto ao{" "}
            <span className="text-[var(--accent)]">vault selado</span>
          </h2>
          <p className="mt-6 max-w-xl leading-relaxed text-[var(--text-tertiary)]">
            O CriptEnv pega variáveis espalhadas, aplica criptografia local
            autenticada e sincroniza somente blobs opacos. O vault vira a fonte
            auditável; plaintext nunca cruza a rede.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {proofPoints.map((point) => (
              <div
                key={point}
                data-vault-motion="proof"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-2 font-mono text-[11px] text-[var(--text-secondary)] backdrop-blur-sm"
              >
                {point}
              </div>
            ))}
          </div>
        </div>

        <div className="relative min-h-[560px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/64 p-4 shadow-2xl shadow-black/5 backdrop-blur-md dark:shadow-black/30 sm:p-6 lg:min-h-[620px]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,transparent,rgba(255,255,255,0.05)_44%,transparent_68%)]" />

          <div className="relative grid h-full min-h-[520px] gap-5 lg:grid-cols-[0.88fr_0.34fr_1fr] lg:items-center">
            <div className="relative z-10 space-y-3">
              {secretFragments.map((secret, index) => (
                <div
                  key={secret.name}
                  data-vault-motion="fragment"
                  className="group rounded-xl border border-[var(--border)] bg-[var(--background)]/90 p-3 shadow-sm transition-colors hover:border-[var(--accent)]/30"
                  style={{ marginLeft: `${index % 2 === 0 ? 0 : 20}px` }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-[var(--text-primary)]">
                      {secret.name}
                    </span>
                    <span className="h-2 w-2 rounded-full bg-amber-300/80" />
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-[var(--text-muted)]">
                    {secret.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="relative z-10 flex min-h-28 items-center justify-center lg:min-h-[420px]">
              <div className="absolute left-4 right-4 top-1/2 h-px bg-[var(--border)] lg:left-1/2 lg:right-auto lg:top-8 lg:h-[calc(100%-4rem)] lg:w-px">
                <div
                  data-vault-motion="line-fill"
                  className="h-px w-full origin-left bg-gradient-to-r from-lime-300 via-sky-300 to-[var(--accent)] lg:h-full lg:w-px lg:origin-top lg:bg-gradient-to-b"
                />
              </div>

              <div className="relative grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-5">
                {pipelineSteps.map((step) => (
                  <div
                    key={step.label}
                    data-vault-motion="step"
                    className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)]/92 px-2 py-3 text-center shadow-sm"
                  >
                    <step.icon className="h-4 w-4 text-[var(--accent)] dark:text-lime-200" />
                    <span className="font-mono text-[10px] uppercase leading-tight tracking-[0.12em] text-[var(--text-secondary)]">
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div
              data-vault-motion="vault"
              className="relative z-10 overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-black/5 dark:border-white/10 dark:bg-[#050505] dark:shadow-black/40"
            >
              {/* Subtle accent glow — visible in both themes */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(156,255,74,0.10),transparent_40%)] dark:bg-[radial-gradient(circle_at_50%_18%,rgba(156,255,74,0.18),transparent_38%)]" />

              <div className="relative z-10 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-[var(--accent)] dark:text-lime-200" />
                  <span className="font-mono text-xs text-[var(--text-secondary)] dark:text-white/70">
                    vault.local
                  </span>
                </div>
                <Badge className="border-[var(--accent)]/30 bg-[var(--accent)] text-[var(--accent-foreground)] dark:border-lime-200/30 dark:bg-lime-200 dark:text-black">
                  sealed
                </Badge>
              </div>

              <div className="relative mx-auto mb-6 flex aspect-square max-w-[230px] items-center justify-center">
                {/* Decorative rings — subtle in light, visible in dark */}
                <div className="absolute inset-6 rounded-full border border-[var(--border)] bg-[var(--background-subtle)]/50 dark:border-white/12 dark:bg-white/[0.03]" />
                <div className="absolute inset-10 rounded-full border border-[var(--accent)]/15 dark:border-lime-200/20" />
                <div
                  data-vault-motion="vault-door"
                  className="relative flex h-36 w-36 items-center justify-center rounded-[32px] border border-[var(--accent)]/20 bg-[var(--background)] shadow-[0_0_32px_rgba(156,255,74,0.10)] dark:border-lime-200/22 dark:bg-black dark:shadow-[0_0_42px_rgba(156,255,74,0.16)]"
                >
                  <div className="absolute inset-4 rounded-[24px] border border-[var(--border)] dark:border-white/10" />
                  <ShieldCheck className="h-12 w-12 text-[var(--accent)] dark:text-lime-200" />
                </div>
              </div>

              <div className="relative z-10 space-y-2">
                {vaultRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--background-subtle)]/70 px-3 py-2 font-mono text-[11px] dark:border-white/8 dark:bg-white/[0.045]"
                  >
                    <span className="text-[var(--text-muted)] dark:text-white/60">{row.label}</span>
                    <span className="text-[var(--text-secondary)] dark:text-white/85">{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="relative z-10 mt-5 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--background-subtle)]/60 px-3 py-2 font-mono text-[11px] text-[var(--text-secondary)] dark:border-sky-200/12 dark:bg-sky-200/[0.06] dark:text-sky-100/78">
                <div className="flex items-center gap-2">
                  <Server className="h-3.5 w-3.5" />
                  <span>cloud sync</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--accent)] dark:text-lime-100">
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span>ciphertext only</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export { ProblemToVaultSection }
