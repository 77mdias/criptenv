import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import {
  Terminal,
  Key,
  Users,
  GitBranch,
  Shield,
  RefreshCw,
  FileText,
  Eye,
  ArrowRight,
  BookOpen,
  Lock,
  Zap,
  CheckCircle2,
  Globe,
  MessageCircle,
  ExternalLink,
} from "lucide-react"
import { DocCard, CardGrid, CodeBlock } from "@/components/docs"

// Prose lives in `messages/<locale>/docs.json` under `home`; these
// module-scope literals only carry stable keys, never user-facing copy.
const principleItems = [
  { icon: Lock, key: "zeroKnowledge" },
  { icon: Zap, key: "consistent" },
  { icon: Shield, key: "secureByDefault" },
  { icon: CheckCircle2, key: "openSource" },
] as const

const capabilityItems = [
  { icon: Terminal, key: "cli", href: "/docs/cli" },
  { icon: GitBranch, key: "cloudSync", href: "/docs/cli/commands" },
  { icon: Users, key: "teams", href: "/docs/guides/team-setup" },
  { icon: Zap, key: "cicd", href: "/docs/integrations/github-action" },
  { icon: RefreshCw, key: "cloudIntegrations", href: "/docs/integrations" },
  { icon: RefreshCw, key: "rotation", href: "/docs/api/rotation" },
  { icon: Eye, key: "audit", href: "/docs/api/audit" },
  { icon: FileText, key: "importExport", href: "/docs/cli/commands" },
  { icon: Key, key: "restApi", href: "/docs/api" },
] as const

const firstStepItems = [
  { icon: Terminal, key: "installation", href: "/docs/getting-started/installation" },
  { icon: Zap, key: "quickstart", href: "/docs/getting-started/quickstart" },
  { icon: GitBranch, key: "cicd", href: "/docs/guides/cicd-setup" },
  { icon: Shield, key: "encryption", href: "/docs/security/encryption" },
] as const

const learnMoreItems = [
  { icon: BookOpen, key: "security", href: "/docs/security" },
  { icon: Globe, key: "apiReference", href: "/docs/api" },
  {
    icon: null,
    key: "github",
    href: "https://github.com/77mdias/criptenv",
    external: true,
  },
  {
    icon: MessageCircle,
    key: "community",
    href: "https://github.com/criptenv/criptenv/issues",
    external: true,
  },
  { icon: ExternalLink, key: "llmsTxt", href: "/llms.txt" },
  { icon: ArrowRight, key: "dashboard", href: "/dashboard" },
] as const

export default async function DocsPage() {
  const t = await getTranslations("docs.home")

  return (
    <div>
      {/* Hero — AbacatePay style */}
      <div className="text-center pt-8 pb-12">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)] mb-4">
          {t("hero.title")}
        </h1>
        <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
          {t("hero.subtitle")}
        </p>
      </div>

      {/* O que é o CriptEnv */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">
          {t("whatIs.title")}
        </h2>
        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
          {t.rich("whatIs.paragraph1", {
            strong: (chunks) => (
              <strong className="text-[var(--text-primary)]">{chunks}</strong>
            ),
          })}
        </p>
        <p className="text-[var(--text-secondary)] leading-relaxed mb-6">
          {t.rich("whatIs.paragraph2", {
            strong: (chunks) => (
              <strong className="text-[var(--text-primary)]">{chunks}</strong>
            ),
          })}
        </p>

        <CodeBlock language="bash" title="Exemplo rápido">
{`# Definir um secret
$ criptenv set DATABASE_URL=postgresql://localhost/mydb
$ criptenv set API_KEY=your_api_key_here

# Obter um secret (descriptografado localmente)
$ criptenv get DATABASE_URL

# Listar todos os secrets (valores nunca exibidos)
$ criptenv list`}
        </CodeBlock>
      </section>

      {/* Princípios — AbacatePay card style */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-5">
          {t("principles.title")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {principleItems.map((item) => (
            <PrincipleCard
              key={item.key}
              icon={item.icon}
              title={t(`principles.${item.key}.title`)}
              description={t(`principles.${item.key}.description`)}
            />
          ))}
        </div>
      </section>

      {/* O que você pode fazer */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-5">
          {t("capabilities.title")}
        </h2>
        <CardGrid cols={3}>
          {capabilityItems.map((item) => (
            <DocCard
              key={item.key}
              title={t(`capabilities.items.${item.key}.title`)}
              description={t(`capabilities.items.${item.key}.description`)}
              icon={item.icon}
              href={item.href}
            />
          ))}
        </CardGrid>
      </section>

      {/* Primeiros passos */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-5">
          {t("firstSteps.title")}
        </h2>
        <CardGrid cols={2}>
          {firstStepItems.map((item) => (
            <DocCard
              key={item.key}
              title={t(`firstSteps.items.${item.key}.title`)}
              description={t(`firstSteps.items.${item.key}.description`)}
              icon={item.icon}
              href={item.href}
            />
          ))}
        </CardGrid>
      </section>

      {/* Saiba mais — links externos */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-5">
          {t("learnMore.title")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {learnMoreItems.map((item) => (
            <ExternalCard
              key={item.key}
              icon={item.icon ?? GithubIcon}
              title={t(`learnMore.items.${item.key}.title`)}
              description={t(`learnMore.items.${item.key}.description`)}
              href={item.href}
              external={"external" in item ? item.external : false}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

/* Principle card — AbacatePay style (compact, border, small icon) */
function PrincipleCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-5 bg-[var(--surface-elevated,var(--background-subtle))]">
      <div className="mt-0.5 shrink-0">
        <Icon className="h-5 w-5 text-emerald-500" />
      </div>
      <div>
        <h3 className="font-semibold text-[var(--text-primary)] text-sm mb-1">
          {title}
        </h3>
        <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  )
}

/* External link card */
function ExternalCard({
  icon: Icon,
  title,
  description,
  href,
  external = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  href: string
  external?: boolean
}) {
  const Component = external ? "a" : Link
  return (
    <Component
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group flex items-start gap-3 rounded-xl border border-[var(--border)] p-5 bg-[var(--surface-elevated,var(--background-subtle))] hover:border-[var(--text-muted)] transition-colors"
    >
      <div className="mt-0.5 shrink-0">
        <Icon className="h-5 w-5 text-[var(--text-tertiary)] group-hover:text-emerald-500 transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-[var(--text-primary)] text-sm mb-1 group-hover:text-emerald-500 transition-colors">
          {title}
        </h3>
        <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
          {description}
        </p>
      </div>
      {external && (
        <ExternalLink className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </Component>
  )
}

/* Inline github icon for external card */
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  )
}
