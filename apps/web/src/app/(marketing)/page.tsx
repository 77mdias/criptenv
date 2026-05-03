"use client"

import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import {
  ArrowRight,
  CircleDot,
  Code2,
  Eye,
  Fingerprint,
  GitBranch,
  KeyRound,
  Lock,
  Server,
  Shield,
  Terminal,
  Users,
  Zap,
} from "lucide-react"
import { Footer } from "@/components/layout/footer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

const HeroScene = dynamic(
  () => import("@/components/marketing/hero-scene").then((mod) => mod.HeroScene),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 rounded-[var(--radius-xl)] bg-[radial-gradient(circle_at_center,var(--glow-soft),transparent_62%)]" />
    ),
  },
)

const LandingMotion = dynamic(
  () => import("@/components/marketing/landing-motion").then((mod) => mod.LandingMotion),
  { ssr: false },
)

const PricingCardCarousel = dynamic(
  () => import("@/components/marketing/pricing-card-carousel").then((mod) => mod.PricingCardCarousel),
  { ssr: false },
)

const features = [
  {
    icon: Lock,
    title: "Zero-Knowledge",
    description:
      "Criptografia AES-GCM 256-bit client-side. O servidor NUNCA vê seus secrets em plain-text.",
  },
  {
    icon: Terminal,
    title: "CLI-First",
    description:
      "Fluxo natural no terminal. init, set, push, pull — tudo em menos de 500ms.",
  },
  {
    icon: Users,
    title: "Team Sync",
    description:
      "Compartilhe secrets com sua equipe de forma segura. Sync em tempo real via Supabase.",
  },
  {
    icon: Shield,
    title: "Audit Completo",
    description:
      "Trilha de auditoria de todas as operações. Quem acessou, quando, de onde.",
  },
]

const steps = [
  {
    num: "01",
    cmd: "criptenv init",
    title: "Crie seu projeto",
    desc: "Inicialize um vault criptografado para seu projeto em segundos.",
  },
  {
    num: "02",
    cmd: "criptenv set DB_URL postgres://...",
    title: "Adicione secrets",
    desc: "Cada secret é criptografado com sua chave pública antes de sair do terminal.",
  },
  {
    num: "03",
    cmd: "criptenv push",
    title: "Envie de forma segura",
    desc: "Dados criptografados sobem para o servidor. O conteúdo permanece invisível.",
  },
  {
    num: "04",
    cmd: "criptenv pull",
    title: "Equipe decripta local",
    desc: "Cada membro decripta com sua própria chave. Zero-knowledge garantido.",
  },
]

const securityPoints = [
  { icon: KeyRound, text: "AES-GCM 256-bit encryption" },
  { icon: Eye, text: "Zero-knowledge architecture" },
  { icon: Fingerprint, text: "Client-side only: dados nunca expostos" },
  { icon: Server, text: "100% open source e auditável" },
]

const scatteredSecrets = [
  ".env.local",
  "DATABASE_URL",
  "SUPABASE_KEY",
  "STRIPE_SECRET",
  "CI_TOKEN",
]

const plans = [
  {
    name: "Protocol",
    description: "Para MVPs & Startups",
    price: "Free",
    features: [
      "Unlimited secrets",
      "3 environments",
      "5 team members",
      "30-day audit log",
    ],
    cta: "Get Started",
    featured: false,
  },
  {
    name: "Construct",
    description: "Para equipes em crescimento",
    price: "$9",
    suffix: "/seat/mo",
    features: [
      "Everything in Protocol",
      "Unlimited environments",
      "Unlimited members",
      "1-year audit log",
      "Priority support",
    ],
    cta: "Start Free Trial",
    featured: true,
  },
  {
    name: "Enterprise",
    description: "Para grandes organizações",
    price: "Custom",
    features: [
      "Everything in Construct",
      "SSO/SAML",
      "SCIM provisioning",
      "SIEM export",
      "Self-hosted option",
      "Dedicated support",
    ],
    cta: "Contact Sales",
    featured: false,
  },
]

const marketingSectionClass =
  "scroll-mt-14 px-6 py-20 sm:px-8 sm:py-24 lg:flex lg:min-h-screen lg:items-center lg:py-0"

function TerminalPanel() {
  return (
    <div className="relative z-10 overflow-hidden rounded-xl border border-black/10 bg-white/76 shadow-2xl shadow-black/10 backdrop-blur-md dark:border-white/10 dark:bg-black/45 dark:shadow-black/20">
      <div className="flex h-10 items-center justify-between border-b border-black/8 px-4 dark:border-white/10">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
          encrypted session
        </span>
      </div>
      <div className="space-y-3 p-5 font-mono text-xs text-[var(--text-secondary)] sm:p-6">
        <p>
          <span className="text-green-400">$</span> criptenv init
        </p>
        <p>
          <span className="text-green-400">$</span> criptenv set DATABASE_URL
          postgres://...
        </p>
        <p className="text-[var(--text-muted)]">encrypting with AES-GCM-256...</p>
        <div className="grid gap-2 rounded-lg border border-black/8 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.03]">
          {["vault.local", "team.public-key", "audit.chain"].map((item) => (
            <div key={item} className="flex items-center justify-between gap-4">
              <span>{item}</span>
              <span className="text-green-400">sealed</span>
            </div>
          ))}
        </div>
        <p>
          <span className="text-green-400">$</span> criptenv push
        </p>
        <p className="text-[var(--text-primary)]">sync complete. server saw 0 secrets.</p>
      </div>
    </div>
  )
}

function SectionHeading({
  label,
  title,
  align = "left",
}: {
  label: string
  title: ReactNode
  align?: "left" | "center"
}) {
  return (
    <div className={align === "center" ? "mx-auto mb-16 max-w-2xl text-center" : "mb-16 max-w-2xl"}>
      <span className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
        {label}
      </span>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">
        {title}
      </h2>
    </div>
  )
}

export default function LandingPage() {
  return (
    <LandingMotion>
      <section
        id="hero"
        className="relative flex min-h-screen scroll-mt-14 items-center overflow-hidden bg-[var(--background)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_42%,var(--glow-soft),transparent_34%),linear-gradient(to_bottom,transparent_72%,var(--background))]" />

        <div className="relative mx-auto w-full max-w-7xl px-6 py-24 sm:px-8 lg:py-0">
          <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
            <div className="relative z-10">
              <div data-motion="hero">
                <Badge variant="outline" className="rounded-md border-[var(--border)] bg-[var(--surface)]/70">
                  <CircleDot className="h-3 w-3 text-green-400" />
                  Open Source
                </Badge>
              </div>
              <h1
                data-motion="hero"
                className="mt-8 max-w-3xl text-5xl font-light leading-[0.95] tracking-tight text-[var(--text-primary)] sm:text-6xl lg:text-7xl"
              >
                Secrets{" "}
                <span className="font-semibold">seguros,</span>
                <br />
                <span className="font-semibold text-[var(--accent)]">
                  equipe feliz.
                </span>
              </h1>
              <p
                data-motion="hero"
                className="mt-8 max-w-md text-base font-light leading-relaxed text-[var(--text-tertiary)]"
              >
                Gestão de secrets com criptografia Zero-Knowledge. Seus .env
                criptografados antes mesmo de sair do seu computador.
              </p>
              <div data-motion="hero" className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="w-full bg-[var(--accent)] text-xs font-bold uppercase tracking-wider text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] sm:w-auto"
                  >
                    Start Project
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="#features">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="w-full border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--background-subtle)] sm:w-auto"
                  >
                    Learn More
                  </Button>
                </Link>
              </div>
            </div>

            <div data-motion="hero" className="relative min-h-[400px] overflow-visible sm:min-h-[520px] lg:min-h-[640px]">
              <HeroScene />
              <div className="absolute inset-x-0 bottom-4 mx-auto w-full max-w-xl px-2 sm:bottom-10">
                <TerminalPanel />
              </div>
              <div className="absolute left-1/2 top-10 h-56 w-56 -translate-x-1/2 rounded-full border border-[var(--border)] bg-[var(--surface)]/20 blur-3xl" />
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
          <div className="h-12 w-px animate-pulse bg-gradient-to-b from-transparent via-[var(--accent)]/50 to-transparent" />
        </div>
      </section>

      <section className={`relative overflow-hidden bg-[var(--background-subtle)] ${marketingSectionClass}`}>
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
          <div data-motion="reveal">
            <SectionHeading
              label="Problem to Vault"
              title={
                <>
                  Secrets espalhados viram um{" "}
                  <span className="text-[var(--accent)]">vault criptografado</span>
                </>
              }
            />
            <p className="-mt-8 max-w-xl leading-relaxed text-[var(--text-tertiary)]">
              O fluxo transforma variáveis soltas, tokens de CI e credenciais de
              produção em um grafo audível e auditável: criptografa localmente,
              sincroniza seguro, decripta só onde deve.
            </p>
          </div>

          <div data-motion="reveal" className="relative min-h-[430px]">
            <div className="absolute inset-0 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]/60" />
            <div className="absolute left-5 top-6 grid gap-3 sm:left-8">
              {scatteredSecrets.map((secret, index) => (
                <div
                  key={secret}
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs text-[var(--text-secondary)] shadow-sm"
                  style={{ marginLeft: `${index % 2 === 0 ? 0 : 34}px` }}
                >
                  {secret}
                </div>
              ))}
            </div>
            <div className="absolute left-8 right-8 top-1/2 h-px bg-[var(--border)]">
              <div data-motion="line" className="h-px bg-[var(--accent)]/70" />
            </div>
            <div className="absolute bottom-8 right-6 w-[58%] min-w-[220px] rounded-xl border border-[var(--border)] bg-[var(--background)] p-5 shadow-xl sm:right-8">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-[var(--accent)]" />
                  <span className="font-mono text-xs text-[var(--text-muted)]">
                    vault.local
                  </span>
                </div>
                <Badge variant="success">sealed</Badge>
              </div>
              <div className="space-y-2">
                {["ciphertext", "team keyring", "audit hash"].map((item) => (
                  <div
                    key={item}
                    className="flex items-center justify-between rounded-md bg-[var(--background-subtle)] px-3 py-2 font-mono text-xs"
                  >
                    <span className="text-[var(--text-tertiary)]">{item}</span>
                    <span className="text-[var(--text-primary)]">••••••</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className={`${marketingSectionClass} bg-[var(--background)]`}>
        <div className="mx-auto w-full max-w-6xl">
          <div data-motion="reveal">
            <SectionHeading label="Features" title="Tudo que você precisa" />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {features.map((feature) => (
              <Card
                data-motion="reveal"
                key={feature.title}
                className="group relative min-h-[214px] overflow-hidden rounded-xl border-[var(--border)] bg-[var(--surface)]/80 p-8 backdrop-blur-sm transition-all duration-300 hover:border-[var(--accent)]/30 hover:shadow-lg hover:shadow-[var(--glow-soft)]"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/10">
                  <feature.icon className="h-6 w-6 text-[var(--accent)]" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-[var(--text-primary)]">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-[var(--text-tertiary)]">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className={`relative overflow-hidden ${marketingSectionClass}`}>
        <div className="absolute inset-0">
          <Image
            src="/images/fad0f89c8d6a92fc48b19560eef69626.jpg"
            alt=""
            fill
            className="object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-[var(--background)]/92" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl">
          <div data-motion="reveal">
            <SectionHeading
              align="center"
              label="How It Works"
              title={
                <>
                  4 comandos. <span className="text-[var(--accent)]">Zero stress.</span>
                </>
              }
            />
          </div>

          <div className="relative grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="absolute left-0 right-0 top-1/2 hidden h-px bg-[var(--border)] lg:block">
              <div data-motion="line" className="h-px bg-[var(--accent)]/70" />
            </div>
            {steps.map((step) => (
              <Card
                data-motion="reveal"
                key={step.num}
                className="group relative flex min-h-[230px] flex-col rounded-xl border-[var(--border)] bg-[var(--surface)]/85 p-6 backdrop-blur-md transition-all duration-300 hover:border-[var(--accent)]/30"
              >
                <span className="absolute right-4 top-4 font-mono text-5xl font-bold text-[var(--accent)]/10">
                  {step.num}
                </span>
                <div
                  className="mb-5 flex min-h-12 items-center rounded-lg border border-[var(--border)] bg-black/45 px-3 py-2 pr-10 font-mono text-xs text-green-400"
                  title={`$ ${step.cmd}`}
                >
                  <span className="block truncate">$ {step.cmd}</span>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-[var(--text-tertiary)]">
                  {step.desc}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className={`${marketingSectionClass} bg-[var(--background)]`}>
        <div className="mx-auto grid w-full max-w-6xl items-center gap-16 lg:grid-cols-2">
          <div data-motion="reveal" className="relative order-2 lg:order-1">
            <div className="relative mx-auto aspect-[4/5] max-w-md overflow-hidden rounded-xl border border-[var(--border)]">
              <Image
                src="/images/secrets-make-you-sick.jpg"
                alt="Segurança e privacidade"
                fill
                className="object-cover grayscale transition-all duration-700 hover:grayscale-0"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-transparent to-transparent opacity-70" />
              <div className="absolute bottom-5 left-5 right-5 rounded-xl border border-white/10 bg-black/45 p-4 font-mono text-xs text-white/80 backdrop-blur-md">
                <div className="mb-3 flex items-center gap-2 text-green-400">
                  <Zap className="h-4 w-4" />
                  local encryption path
                </div>
                <div className="h-px bg-white/15">
                  <div data-motion="line" className="h-px bg-green-400" />
                </div>
              </div>
            </div>
          </div>

          <div data-motion="reveal" className="order-1 lg:order-2">
            <SectionHeading
              label="Security"
              title={
                <>
                  Segurança que você pode{" "}
                  <span className="text-[var(--accent)]">confiar</span>
                </>
              }
            />
            <p className="-mt-10 mb-10 leading-relaxed text-[var(--text-tertiary)]">
              Arquitetura zero-knowledge de verdade. Seus dados são criptografados
              no seu dispositivo e o servidor nunca tem acesso às chaves ou ao
              conteúdo em plain-text.
            </p>
            <div className="space-y-5">
              {securityPoints.map((point) => (
                <div key={point.text} className="group flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/10 transition-colors group-hover:bg-[var(--accent)]/20">
                    <point.icon className="h-5 w-5 text-[var(--accent)]" />
                  </div>
                  <span className="text-sm font-medium text-[var(--text-secondary)]">
                    {point.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="pricing"
        className={`relative overflow-hidden bg-[var(--background-subtle)] ${marketingSectionClass}`}
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)]/5 blur-[120px]" />

        <div className="relative z-10 mx-auto w-full max-w-6xl">
          <div data-motion="reveal">
            <SectionHeading align="center" label="Pricing" title="Simples e transparente" />
          </div>
          <div data-motion="reveal">
            <PricingCardCarousel cards={plans} autoPlayInterval={4000} />
          </div>
        </div>
      </section>

      <section id="cta" className={`relative overflow-hidden ${marketingSectionClass}`}>
        <div className="absolute inset-0">
          <Image
            src="/images/wer-haben-vergessen.jpeg"
            alt=""
            fill
            className="object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-[var(--background)]/90" />
        </div>

        <div data-motion="reveal" className="relative z-10 mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">
              Pronto para{" "}
              <span className="text-[var(--accent)]">segurar</span> seus secrets?
            </h2>
            <p className="mt-4 font-mono text-[var(--text-tertiary)]">
              Open source. Zero-knowledge. Gratuito para começar.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="w-full bg-[var(--accent)] text-xs font-bold uppercase tracking-wider text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] sm:w-auto"
                >
                  Get Started Free
                </Button>
              </Link>
              <Link href="https://github.com/criptenv">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--background-subtle)] sm:w-auto"
                >
                  View on GitHub
                </Button>
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-black/45 p-5 font-mono text-xs text-[var(--text-secondary)] shadow-2xl shadow-black/20 backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <Code2 className="h-4 w-4" />
                terminal
              </div>
              <GitBranch className="h-4 w-4 text-[var(--text-muted)]" />
            </div>
            <p>
              <span className="text-green-400">$</span> criptenv init
            </p>
            <p className="mt-3 text-[var(--text-primary)]">
              vault ready. invite your team when you are.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </LandingMotion>
  )
}
