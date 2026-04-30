"use client"

import Link from "next/link"
import Image from "next/image"
import {
  Shield,
  Terminal,
  Users,
  Lock,
  ArrowRight,
  Check,
  KeyRound,
  Eye,
  Fingerprint,
  Server,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Footer } from "@/components/layout/footer"

/* ─── Data ─────────────────────────────────────────────────── */

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
    desc: "Cada secret é criptografado com sua chave pública antes de sair do seu terminal.",
  },
  {
    num: "03",
    cmd: "criptenv push",
    title: "Envie de forma segura",
    desc: "Dados criptografados sobem para o servidor. O servidor nunca vê o conteúdo.",
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
  { icon: Fingerprint, text: "Client-side only — dados nunca expostos" },
  { icon: Server, text: "100% open source e auditável" },
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

/* ─── Page ─────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <>
      {/* ═══════════ HERO ═══════════ */}
      <section
        id="hero"
        className="relative flex min-h-screen scroll-mt-14 items-center overflow-hidden bg-[var(--background)]"
      >
        {/* Ambient glow */}
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--accent)]/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[var(--background)] to-transparent pointer-events-none z-10" />

        <div className="relative w-full max-w-7xl mx-auto px-6 sm:px-8 py-24 lg:py-0">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* Text */}
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 border border-[var(--accent)]/30 mb-8">
                <div className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-pulse" />
                <span className="text-xs text-[var(--text-secondary)] tracking-widest uppercase font-medium">
                  Open Source
                </span>
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tight leading-[0.95]">
                Secrets{" "}
                <span className="font-semibold">seguros,</span>
                <br />
                <span className="font-semibold text-[var(--accent)]">
                  equipe feliz.
                </span>
              </h1>
              <p className="mt-8 text-[var(--text-tertiary)] text-base max-w-md leading-relaxed font-light">
                Gestão de secrets com criptografia Zero-Knowledge. Seus .env
                criptografados antes mesmo de sair do seu computador.
              </p>
              <div className="mt-10 flex gap-4">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] font-bold tracking-wider uppercase text-xs"
                  >
                    Start Project
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="#features">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--background-subtle)]"
                  >
                    Learn More
                  </Button>
                </Link>
              </div>
            </div>

            {/* Hero Image */}
            <div className="relative flex items-center justify-center">
              <div className="relative w-full max-w-lg aspect-square">
                {/* Glow behind image */}
                <div className="absolute inset-0 bg-[var(--accent)]/15 rounded-full blur-[80px] scale-75" />
                <Image
                  src="/images/master-keys_1200x1200-removebg-preview.png"
                  alt="Chaves de segredo — CriptEnv"
                  fill
                  className="object-contain drop-shadow-2xl animate-float"
                  priority
                />
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <div className="w-px h-12 bg-gradient-to-b from-transparent via-[var(--accent)]/50 to-transparent animate-pulse" />
        </div>
      </section>

      {/* ═══════════ FEATURES ═══════════ */}
      <section id="features" className={`${marketingSectionClass} bg-[var(--background)]`}>
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-16">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono">
              Features
            </span>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[var(--text-primary)] mt-4">
              Tudo que você precisa
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative flex h-full min-h-[214px] flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm transition-all duration-300 hover:border-[var(--accent)]/30 hover:shadow-lg hover:shadow-[var(--accent)]/5"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/10">
                  <feature.icon className="h-6 w-6 text-[var(--accent)]" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-[var(--text-primary)]">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-[var(--text-tertiary)]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section id="how-it-works" className={`relative overflow-hidden ${marketingSectionClass}`}>
        {/* Background image */}
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
          <div className="mb-16 text-center">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono">
              How It Works
            </span>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[var(--text-primary)] mt-4">
              4 comandos. <span className="text-[var(--accent)]">Zero stress.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div
                key={step.num}
                className="group relative flex h-full min-h-[220px] flex-col rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:border-[var(--accent)]/30"
              >
                {/* Step number */}
                <span className="text-5xl font-bold text-[var(--accent)]/10 absolute top-4 right-4 font-mono">
                  {step.num}
                </span>
                {/* Terminal command */}
                <div
                  className="mb-4 flex min-h-12 items-center rounded-lg border border-white/5 bg-black/40 px-3 py-2 pr-14 font-mono text-xs text-green-400"
                  title={`$ ${step.cmd}`}
                >
                  <span className="block truncate">$ {step.cmd}</span>
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">
                  {step.desc}
                </p>
                {/* Connector line (except last) */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-px bg-gradient-to-r from-[var(--accent)]/40 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ SECURITY ═══════════ */}
      <section id="security" className={`${marketingSectionClass} bg-[var(--background)]`}>
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Image */}
            <div className="relative order-2 lg:order-1">
              <div className="relative aspect-[4/5] max-w-md mx-auto overflow-hidden rounded-xl">
                <Image
                  src="/images/secrets-make-you-sick.jpg"
                  alt="Segurança e privacidade"
                  fill
                  className="object-cover grayscale hover:grayscale-0 transition-all duration-700"
                  loading="lazy"
                />
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-transparent to-transparent opacity-60" />
              </div>
            </div>

            {/* Content */}
            <div className="order-1 lg:order-2">
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono">
                Security
              </span>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[var(--text-primary)] mt-4 mb-6">
                Segurança que você pode{" "}
                <span className="text-[var(--accent)]">confiar</span>
              </h2>
              <p className="text-[var(--text-tertiary)] mb-10 leading-relaxed">
                Arquitetura zero-knowledge de verdade. Seus dados são criptografados
                no seu dispositivo e o servidor nunca tem acesso às chaves ou ao
                conteúdo em plain-text.
              </p>

              <div className="space-y-5">
                {securityPoints.map((point) => (
                  <div
                    key={point.text}
                    className="flex items-center gap-4 group"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 group-hover:bg-[var(--accent)]/20 transition-colors">
                      <point.icon className="h-5 w-5 text-[var(--accent)]" />
                    </div>
                    <span className="text-[var(--text-secondary)] text-sm font-medium">
                      {point.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ PRICING ═══════════ */}
      <section id="pricing" className={`relative overflow-hidden bg-[var(--background-subtle)] ${marketingSectionClass}`}>
        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[var(--accent)]/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 mx-auto w-full max-w-6xl">
          <div className="mb-16 text-center">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono">
              Pricing
            </span>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[var(--text-primary)] mt-4">
              Simples e transparente
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`group relative flex h-full min-h-[442px] flex-col rounded-xl border p-6 transition-all duration-300 ${
                  plan.featured
                    ? "border-[var(--accent)]/50 bg-white/5 backdrop-blur-sm shadow-lg shadow-[var(--accent)]/10 hover:shadow-[var(--accent)]/20"
                    : "border-white/10 bg-white/5 backdrop-blur-sm hover:border-white/20 hover:shadow-lg"
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--accent)] text-[var(--accent-foreground)] text-[10px] font-bold tracking-widest uppercase px-3 py-0.5 rounded-full">
                    Most Popular
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    {plan.name}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--text-tertiary)]">
                    {plan.description}
                  </p>
                </div>
                <div className="mb-6 mt-6">
                  <span className="text-4xl font-semibold tracking-tight text-[var(--text-primary)]">
                    {plan.price}
                  </span>
                  {plan.suffix && (
                    <span className="text-sm text-[var(--text-muted)]">
                      {plan.suffix}
                    </span>
                  )}
                </div>
                <ul className="mb-8 space-y-3">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"
                    >
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className="mt-auto block">
                  <Button
                    variant={plan.featured ? "primary" : "secondary"}
                    fullWidth
                    className={
                      plan.featured
                        ? "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] font-bold"
                        : "border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--background-subtle)]"
                    }
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ CTA ═══════════ */}
      <section id="cta" className={`relative overflow-hidden ${marketingSectionClass}`}>
        {/* Background image */}
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

        <div className="relative z-10 mx-auto max-w-2xl text-center">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[var(--text-primary)]">
            Pronto para{" "}
            <span className="text-[var(--accent)]">segurar</span> seus secrets?
          </h2>
          <p className="mt-4 text-[var(--text-tertiary)] font-mono">
            Open source. Zero-knowledge. Gratuito para começar.
          </p>
          <div className="mt-8 flex gap-4 justify-center">
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] font-bold tracking-wider uppercase text-xs"
              >
                Get Started Free
              </Button>
            </Link>
            <Link href="https://github.com/criptenv">
              <Button
                size="lg"
                variant="secondary"
                className="border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--background-subtle)]"
              >
                View on GitHub
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
