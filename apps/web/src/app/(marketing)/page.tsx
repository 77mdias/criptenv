"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CircleDot,
  Code2,
  GitBranch,
  Lock,
  Shield,
  Terminal,
  Users,
} from "lucide-react";
import { Footer } from "@/components/layout/footer";
import { PricingTrustSection } from "@/components/marketing/pricing-trust-section";
const ProblemToVaultSection = dynamic(
  () =>
    import("@/components/marketing/problem-to-vault-section").then(
      (mod) => mod.ProblemToVaultSection,
    ),
  { ssr: false },
);

const SecurityScrollytelling = dynamic(
  () =>
    import("@/components/marketing/security-scrollytelling").then(
      (mod) => mod.SecurityScrollytelling,
    ),
  { ssr: false },
);
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const HeroScene = dynamic(
  () =>
    import("@/components/marketing/hero-scene").then((mod) => mod.HeroScene),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_center,var(--glow-soft),transparent_62%)]" />
    ),
  },
);

const LandingMotion = dynamic(
  () =>
    import("@/components/marketing/landing-motion").then(
      (mod) => mod.LandingMotion,
    ),
  { ssr: false },
);

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
];

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
];

const marketingSectionClass =
  "scroll-mt-14 px-6 py-20 sm:px-8 sm:py-24 lg:flex lg:min-h-screen lg:items-center lg:py-0";

function TerminalPanel() {
  return (
    <div className="relative z-10 overflow-hidden rounded-xl border border-black/10 bg-white/76 shadow-2xl shadow-black/10 backdrop-blur-md dark:border-white/10 dark:bg-black/45 dark:shadow-black/20">
      <div className="flex h-10 items-center justify-between border-b border-black/8 px-4 dark:border-white/10">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-(--text-muted)">
          encrypted session
        </span>
      </div>
      <div className="space-y-3 p-5 font-mono text-xs text-(--text-secondary) sm:p-6 break-all">
        <p>
          <span className="text-green-400">$</span> criptenv init
        </p>
        <p>
          <span className="text-green-400">$</span> criptenv set DATABASE_URL
          postgres://...
        </p>
        <p className="text-(--text-muted)">encrypting with AES-GCM-256...</p>
        <div className="grid gap-2 rounded-lg border border-black/8 bg-black/2.5 p-3 dark:border-white/10 dark:bg-white/3">
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
        <p className="text-(--text-primary)">
          sync complete. server saw 0 secrets.
        </p>
      </div>
    </div>
  );
}

function SectionHeading({
  label,
  title,
  align = "left",
}: {
  label: string;
  title: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div
      className={
        align === "center"
          ? "mx-auto mb-16 max-w-2xl text-center"
          : "mb-16 max-w-2xl"
      }
    >
      <span className="font-mono text-xs font-bold uppercase tracking-widest text-(--text-muted)">
        {label}
      </span>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-(--text-primary) md:text-4xl">
        {title}
      </h2>
    </div>
  );
}

export default function LandingPage() {
  return (
    <LandingMotion>
      <section
        id="hero"
        className="relative flex min-h-screen scroll-mt-14 items-center overflow-hidden bg-(--background)"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_42%,var(--glow-soft),transparent_34%),linear-gradient(to_bottom,transparent_72%,var(--background))]" />

        <div className="relative mx-auto w-full max-w-7xl px-6 py-24 sm:px-8 lg:py-0">
          <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
            <div className="relative z-10">
              <div data-motion="hero">
                <Badge
                  variant="outline"
                  className="rounded-md border-(--border) bg-(--surface)/70"
                >
                  <CircleDot className="h-3 w-3 text-green-400" />
                  Open Source
                </Badge>
              </div>
              <h1
                data-motion="hero"
                className="mt-8 max-w-3xl text-5xl font-light leading-[0.95] tracking-tight text-(--text-primary) sm:text-6xl lg:text-7xl"
              >
                Secrets <span className="font-semibold">seguros,</span>
                <br />
                <span className="font-semibold text-(--accent)">
                  equipe feliz.
                </span>
              </h1>
              <p
                data-motion="hero"
                className="mt-8 max-w-md text-base font-light leading-relaxed text-(--text-tertiary)"
              >
                Gestão de secrets com criptografia Zero-Knowledge. Seus .env
                criptografados antes mesmo de sair do seu computador.
              </p>
              <div
                data-motion="hero"
                className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4"
              >
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="w-full bg-(--accent) text-xs font-bold uppercase tracking-wider text-(--accent-foreground) hover:bg-(--accent-hover) sm:w-auto"
                  >
                    Start Project
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="#features">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="w-full border-(--border) text-(--text-primary) hover:bg-(--background-subtle) sm:w-auto"
                  >
                    Learn More
                  </Button>
                </Link>
              </div>
            </div>

            <div
              data-motion="hero"
              className="relative min-h-100 overflow-visible sm:min-h-130 lg:min-h-160"
            >
              <HeroScene />
              <div className="absolute inset-x-0 bottom-4 mx-auto w-full max-w-xl px-2 sm:bottom-10">
                <TerminalPanel />
              </div>
              <div className="absolute left-1/2 top-10 h-56 w-56 -translate-x-1/2 rounded-full border border-(--border) bg-(--surface)/20 blur-3xl" />
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
          <div className="h-12 w-px animate-pulse bg-linear-to-b from-transparent via-(--accent)/50 to-transparent" />
        </div>
      </section>

      <ProblemToVaultSection />

      <section
        id="features"
        className={`${marketingSectionClass} bg-(--background)`}
      >
        <div className="mx-auto w-full max-w-6xl">
          <div data-motion="reveal">
            <SectionHeading label="Features" title="Tudo que você precisa" />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {features.map((feature) => (
              <Card
                data-motion="reveal"
                key={feature.title}
                className="group relative min-h-53.5 overflow-hidden rounded-xl border-(--border) bg-(--surface)/80 p-8 backdrop-blur-sm transition-all duration-300 hover:border-(--accent)/30 hover:shadow-(--glow-soft)"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--accent)/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-(--accent)/20 bg-(--accent)/10">
                  <feature.icon className="h-6 w-6 text-(--accent)" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-(--text-primary)">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-(--text-tertiary)">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className={`relative overflow-hidden ${marketingSectionClass}`}
      >
        <div className="absolute inset-0">
          <Image
            src="/images/fad0f89c8d6a92fc48b19560eef69626.jpg"
            alt=""
            fill
            className="object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-(--background)/92" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl">
          <div data-motion="reveal">
            <SectionHeading
              align="center"
              label="How It Works"
              title={
                <>
                  4 comandos.{" "}
                  <span className="text-(--accent)">Zero stress.</span>
                </>
              }
            />
          </div>

          <div className="relative grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="absolute left-0 right-0 top-1/2 hidden h-px bg-(--border) lg:block">
              <div data-motion="line" className="h-px bg-(--accent)/70" />
            </div>
            {steps.map((step) => (
              <Card
                data-motion="reveal"
                key={step.num}
                className="group relative flex min-h-57.5 flex-col rounded-xl border-(--border) bg-(--surface)/85 p-6 backdrop-blur-md transition-all duration-300 hover:border-(--accent)/30"
              >
                <span className="absolute right-4 top-4 font-mono text-5xl font-bold text-(--accent)/10">
                  {step.num}
                </span>
                <div
                  className="mb-5 flex min-h-12 items-center rounded-lg border border-(--border) bg-black/45 px-3 py-2 pr-10 font-mono text-xs text-green-400"
                  title={`$ ${step.cmd}`}
                >
                  <span className="block truncate">$ {step.cmd}</span>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-(--text-primary)">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-(--text-tertiary)">
                  {step.desc}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <SecurityScrollytelling />

      <section
        id="pricing"
        className={`relative overflow-hidden bg-(--background-subtle) ${marketingSectionClass}`}
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-100 w-200 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--accent)/5 blur-[120px]" />

        <div className="relative z-10 mx-auto w-full max-w-6xl">
          <div data-motion="reveal" className="mx-auto mb-10 max-w-2xl text-center">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-(--text-muted)">
              Pricing
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-(--text-primary) md:text-4xl">
              Gratuito para usar, aberto para apoiar
            </h2>
          </div>
          <div data-motion="reveal">
            <PricingTrustSection />
          </div>
        </div>
      </section>

      <section
        id="cta"
        className={`relative overflow-hidden ${marketingSectionClass}`}
      >
        <div className="absolute inset-0">
          <Image
            src="/images/wer-haben-vergessen.jpeg"
            alt=""
            fill
            className="object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-(--background)/90" />
        </div>

        <div
          data-motion="reveal"
          className="relative z-10 mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]"
        >
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-(--text-primary) md:text-4xl">
              Pronto para <span className="text-(--accent)">segurar</span> seus
              secrets?
            </h2>
            <p className="mt-4 font-mono text-(--text-tertiary)">
              Open source. Zero-knowledge. Gratuito para começar.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="w-full bg-(--accent) text-xs font-bold uppercase tracking-wider text-(--accent-foreground) hover:bg-(--accent-hover) sm:w-auto"
                >
                  Get Started Free
                </Button>
              </Link>
              <Link href="https://github.com/criptenv">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full border-(--border) text-(--text-primary) hover:bg-(--background-subtle) sm:w-auto"
                >
                  View on GitHub
                </Button>
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-(--border) bg-black/45 p-5 font-mono text-xs text-(--text-secondary) shadow-2xl shadow-black/20 backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-(--text-primary)">
                <Code2 className="h-4 w-4" />
                terminal
              </div>
              <GitBranch className="h-4 w-4 text-(--text-muted)" />
            </div>
            <p>
              <span className="text-green-400">$</span> criptenv init
            </p>
            <p className="mt-3 text-(--text-primary)">
              vault ready. invite your team when you are.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </LandingMotion>
  );
}
