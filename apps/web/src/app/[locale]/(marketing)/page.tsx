import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Cloud,
  Code2,
  Database,
  FileDown,
  GitBranch,
  KeyRound,
  Lock,
  Monitor,
  Server,
  Shield,
  Terminal,
  Users,
} from "lucide-react";
import { Footer } from "@/components/layout/footer";
import { PricingTrustSection } from "@/components/marketing/pricing-trust-section";
import { ProblemToVaultSection } from "@/components/marketing/problem-to-vault-section";
import { SecurityScrollytelling } from "@/components/marketing/security-scrollytelling";
import { PlatformPreviewSection } from "@/components/marketing/platform-preview-section";
import { HeroSceneLazy } from "@/components/marketing/hero-scene-lazy";
import { LandingMotionLazy } from "@/components/marketing/landing-motion-lazy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Prose lives in `messages/<locale>/marketing.json` under `landing`; these
// module-scope literals only carry stable keys, never user-facing copy.
const featureItems = [
  { icon: Lock, key: "zeroKnowledge" },
  { icon: Terminal, key: "cli" },
  { icon: Users, key: "teamSync" },
  { icon: Shield, key: "control" },
] as const;

const workflowSteps = [
  {
    num: "01",
    icon: Terminal,
    key: "authenticate",
    cmd: "criptenv login --email you@company.com",
  },
  {
    num: "02",
    icon: KeyRound,
    key: "createVault",
    cmd: "criptenv projects create payments-api",
  },
  {
    num: "03",
    icon: Database,
    key: "writeSecrets",
    cmd: "criptenv set DATABASE_URL=postgres://...",
  },
  {
    num: "04",
    icon: FileDown,
    key: "consume",
    cmd: "criptenv pull -p payments-api -o .env.production",
  },
] as const;

const workflowNodes = [
  { icon: Terminal, key: "cli" },
  { icon: Lock, key: "ciphertext" },
  { icon: Server, key: "api" },
  { icon: Monitor, key: "clients" },
] as const;

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
          <span className="text-green-400">$</span> criptenv login --email
          dev@company.com
        </p>
        <p>
          <span className="text-green-400">$</span> criptenv projects create
          payments-api
        </p>
        <p className="text-(--text-muted)">Vault password: ********</p>
        <div className="grid gap-2 rounded-lg border border-black/8 bg-black/2.5 p-3 dark:border-white/10 dark:bg-white/3">
          {["project.vault", "production.env", "audit.timeline"].map((item) => (
            <div key={item} className="flex items-center justify-between gap-4">
              <span>{item}</span>
              <span className="text-green-400">sealed</span>
            </div>
          ))}
        </div>
        <p>
          <span className="text-green-400">$</span> criptenv set DATABASE_URL
          postgres://...
        </p>
        <p className="text-(--text-primary)">
          remote vault updated. server saw 0 plaintext.
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

export default async function LandingPage() {
  const t = await getTranslations("marketing.landing");

  return (
    <LandingMotionLazy>
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
                  {t("hero.badge")}
                </Badge>
              </div>
              <h1
                data-motion="hero"
                className="mt-8 max-w-3xl text-5xl font-light leading-[0.95] tracking-tight text-(--text-primary) sm:text-6xl lg:text-7xl"
              >
                {t.rich("hero.title", {
                  strong: (chunks) => (
                    <span className="font-semibold">{chunks}</span>
                  ),
                  accent: (chunks) => (
                    <span className="font-semibold text-(--accent)">
                      {chunks}
                    </span>
                  ),
                  br: () => <br />,
                })}
              </h1>
              <p
                data-motion="hero"
                className="mt-8 max-w-md text-base font-light leading-relaxed text-(--text-tertiary)"
              >
                {t("hero.subtitle")}
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
                    {t("hero.primaryCta")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="#features">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="w-full border-(--border) text-(--text-primary) hover:bg-(--background-subtle) sm:w-auto"
                  >
                    {t("hero.secondaryCta")}
                  </Button>
                </Link>
              </div>
            </div>

            <div
              data-motion="hero"
              className="relative min-h-100 overflow-visible sm:min-h-130 lg:min-h-160"
            >
              <HeroSceneLazy />
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
            <SectionHeading
              label={t("features.label")}
              title={t("features.title")}
            />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {featureItems.map((feature) => (
              <Card
                data-motion="reveal"
                key={feature.key}
                className="group relative min-h-53.5 overflow-hidden rounded-xl border-(--border) bg-(--surface)/80 p-8 backdrop-blur-sm transition-all duration-300 hover:border-(--accent)/30 hover:shadow-(--glow-soft)"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--accent)/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-(--accent)/20 bg-(--accent)/10">
                  <feature.icon className="h-6 w-6 text-(--accent)" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-(--text-primary)">
                  {t(`features.items.${feature.key}.title`)}
                </h3>
                <p className="text-sm leading-relaxed text-(--text-tertiary)">
                  {t(`features.items.${feature.key}.description`)}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className={`relative overflow-hidden bg-(--background-subtle) ${marketingSectionClass}`}
      >
        <div className="absolute inset-0">
          <Image
            src="/images/fad0f89c8d6a92fc48b19560eef69626.jpg"
            alt=""
            fill
            className="object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-(--background)/96 dark:bg-(--background)/94" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_26%,var(--glow-soft),transparent_34%),radial-gradient(circle_at_78%_68%,rgba(34,197,94,0.10),transparent_30%)]" />
        </div>

        <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.88fr_1.12fr]">
          <div data-motion="reveal" className="min-w-0">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-(--text-muted)">
              {t("workflow.label")}
            </span>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight text-(--text-primary) md:text-4xl md:leading-[1.08]">
              {t.rich("workflow.title", {
                accent: (chunks) => (
                  <span className="text-(--accent)">{chunks}</span>
                ),
              })}
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-(--text-tertiary)">
              {t("workflow.description")}
            </p>

            <div className="mt-6 overflow-hidden rounded-xl border border-(--border) bg-black/90 shadow-2xl shadow-black/20">
              <div className="flex h-9 items-center justify-between border-b border-white/10 px-4">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                  remote vault session
                </span>
              </div>
              <div className="space-y-2.5 p-4 font-mono text-[11px] leading-relaxed text-white/68 sm:p-5">
                {workflowSteps.map((step) => (
                  <div key={step.num} className="min-w-0">
                    <p className="break-all text-green-300">
                      <span className="text-white/42">$</span> {step.cmd}
                    </p>
                    <p className="mt-1 text-white/42">
                      {step.num === "01" && "session stored locally"}
                      {step.num === "02" && "vault proof created client-side"}
                      {step.num === "03" &&
                        "encrypted blob pushed with expected_version"}
                      {step.num === "04" &&
                        "plaintext materialized only on this device"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {(t.raw("workflow.proofs") as string[]).map((proof) => (
                <div
                  key={proof}
                  className="flex min-h-14 items-start gap-2.5 rounded-lg border border-(--border) bg-(--surface)/80 p-3 text-xs leading-relaxed text-(--text-secondary) backdrop-blur-sm"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  <span>{proof}</span>
                </div>
              ))}
            </div>
          </div>

          <div data-motion="reveal" className="min-w-0">
            <Card className="overflow-hidden rounded-xl border-(--border) bg-(--surface)/88 p-0 shadow-xl shadow-black/5 backdrop-blur-md dark:shadow-black/25">
              <div className="border-b border-(--border) bg-(--background-subtle)/80 p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-widest text-(--text-muted)">
                      {t("workflow.panel.kicker")}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold leading-snug text-(--text-primary)">
                      {t("workflow.panel.title")}
                    </h3>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-(--accent)/20 bg-(--accent)/10">
                    <Cloud className="h-5 w-5 text-(--accent)" />
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <div className="grid gap-3 md:grid-cols-4">
                  {workflowNodes.map((node, index) => (
                    <div key={node.key} className="relative min-w-0">
                      {index < workflowNodes.length - 1 && (
                        <div className="absolute left-[calc(50%+1.75rem)] right-[calc(-50%+1.75rem)] top-7 hidden h-px bg-(--border) md:block">
                          <div
                            data-motion="line"
                            className="h-px bg-(--accent)/70"
                          />
                        </div>
                      )}
                      <div className="relative rounded-lg border border-(--border) bg-(--background)/75 p-3 text-center">
                        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-(--accent)/20 bg-(--accent)/10">
                          <node.icon className="h-5 w-5 text-(--accent)" />
                        </div>
                        <p className="mt-2 text-sm font-semibold text-(--text-primary)">
                          {t(`workflow.nodes.${node.key}.label`)}
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-(--text-muted)">
                          {t(`workflow.nodes.${node.key}.description`)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {workflowSteps.map((step) => (
                    <div
                      key={step.num}
                      className="group grid gap-3 rounded-lg border border-(--border) bg-(--background)/70 p-3 transition-colors duration-300 hover:border-(--accent)/30 sm:grid-cols-[auto_1fr] lg:block"
                    >
                      <div className="flex items-start gap-3 lg:items-center lg:justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--border) bg-(--surface-elevated)">
                          <step.icon className="h-5 w-5 text-(--accent)" />
                        </div>
                        <span className="font-mono text-xs font-bold text-(--text-muted) sm:mt-3 sm:block lg:mt-0">
                          {step.num}
                        </span>
                      </div>
                      <div className="min-w-0 lg:mt-3">
                        <div
                          className="mb-2 rounded-md border border-(--border) bg-black/85 px-3 py-2 font-mono text-[11px] text-green-300"
                          title={`$ ${step.cmd}`}
                        >
                          <span className="block truncate">$ {step.cmd}</span>
                        </div>
                        <h4 className="text-base font-semibold text-(--text-primary)">
                          {t(`workflow.steps.${step.key}.title`)}
                        </h4>
                        <p className="mt-1.5 text-xs leading-relaxed text-(--text-tertiary)">
                          {t(`workflow.steps.${step.key}.description`)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <PlatformPreviewSection />

      <SecurityScrollytelling />

      <section
        id="pricing"
        className={`relative overflow-hidden bg-(--background-subtle) ${marketingSectionClass}`}
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-100 w-200 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--accent)/5 blur-[120px]" />

        <div className="relative z-10 mx-auto w-full max-w-6xl">
          <div
            data-motion="reveal"
            className="mx-auto mb-10 max-w-2xl text-center"
          >
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-(--text-muted)">
              {t("pricing.label")}
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-(--text-primary) md:text-4xl">
              {t("pricing.title")}
            </h2>
          </div>
          <div data-motion="reveal">
            <PricingTrustSection />
          </div>
        </div>
      </section>

      <section
        id="cta"
        className={`relative overflow-hidden bg-(--background) ${marketingSectionClass}`}
      >
        <div className="absolute inset-0">
          <Image
            src="/images/wer-haben-vergessen.jpeg"
            alt=""
            fill
            className="object-cover opacity-45 dark:opacity-28"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-(--background)/86 dark:bg-(--background)/88" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_28%,var(--glow-soft),transparent_34%),radial-gradient(circle_at_82%_62%,rgba(34,197,94,0.10),transparent_28%),linear-gradient(to_bottom,transparent_0%,var(--background)_94%)]" />
        </div>

        <div
          data-motion="reveal"
          className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-8 rounded-xl border border-(--border) bg-(--surface)/86 p-5 shadow-2xl shadow-black/8 backdrop-blur-md dark:shadow-black/30 sm:p-7 lg:grid-cols-[0.9fr_1.1fr] lg:p-8"
        >
          <div className="min-w-0">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-(--text-muted)">
              {t("cta.label")}
            </span>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-tight text-(--text-primary) md:text-4xl md:leading-[1.08]">
              {t("cta.title")}
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-(--text-tertiary)">
              {t("cta.description")}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {(t.raw("cta.proofs") as string[]).map((proof) => (
                <div
                  key={proof}
                  className="flex min-h-12 items-center gap-2.5 rounded-lg border border-green-500/18 bg-green-500/8 px-3 py-2 text-xs font-medium text-(--text-secondary) shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] dark:border-green-400/18 dark:bg-green-400/8 dark:shadow-none"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                  <span>{proof}</span>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="w-full bg-(--accent) text-xs font-bold uppercase tracking-wider text-(--accent-foreground) hover:bg-(--accent-hover) sm:w-auto"
                >
                  {t("cta.primary")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="https://github.com/77mdias/criptenv">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full border-(--border) bg-(--background)/70 text-(--text-primary) hover:bg-(--background-subtle) sm:w-auto"
                >
                  {t("cta.secondary")}
                </Button>
              </Link>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-xl border border-(--border) bg-white/88 shadow-2xl shadow-black/10 backdrop-blur-md dark:border-white/10 dark:bg-black/70 dark:shadow-black/25">
            <div className="flex h-11 items-center justify-between border-b border-(--border) bg-white/55 px-4 dark:border-white/10 dark:bg-white/4">
              <div className="flex items-center gap-2 font-mono text-xs text-(--text-secondary) dark:text-white/78">
                <Code2 className="h-4 w-4 text-green-500 dark:text-green-300" />
                secure launch
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-(--text-muted) dark:text-white/38">
                <GitBranch className="h-4 w-4" />
                remote vault
              </div>
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-[1.1fr_0.9fr] sm:p-5">
              <div className="min-w-0 space-y-3 font-mono text-xs leading-relaxed text-(--text-tertiary) dark:text-white/68">
                <p className="break-all text-green-700 dark:text-green-300">
                  <span className="text-(--text-muted) dark:text-white/42">
                    $
                  </span>{" "}
                  criptenv login --email dev@company.com
                </p>
                <p className="break-all text-green-700 dark:text-green-300">
                  <span className="text-(--text-muted) dark:text-white/42">
                    $
                  </span>{" "}
                  criptenv set API_KEY sk_live_...
                </p>
                <div className="rounded-lg border border-green-500/18 bg-green-500/8 p-3 dark:border-white/10 dark:bg-white/5">
                  <p className="text-(--text-primary) dark:text-white/86">
                    vault sealed
                  </p>
                  <p className="mt-1 text-(--text-muted) dark:text-white/42">
                    encrypted remote vault ready for team access.
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                {[
                  ["server sees", "ciphertext"],
                  ["vault proof", "client-side"],
                  ["team invite", "ready"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 rounded-lg border border-green-500/18 bg-green-500/8 px-3 py-2 font-mono text-[11px] dark:border-green-300/24 dark:bg-green-300/8"
                  >
                    <span className="text-(--text-muted) dark:text-white/42">
                      {label}
                    </span>
                    <span className="text-green-700 dark:text-green-300">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </LandingMotionLazy>
  );
}
