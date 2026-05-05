import Link from "next/link"
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

export default function DocsPage() {
  return (
    <div>
      {/* Hero — AbacatePay style */}
      <div className="text-center pt-8 pb-12">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)] mb-4">
          Bem-vindo à Documentação do CriptEnv
        </h1>
        <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
          Aqui você encontra tudo o que precisa para gerenciar seus secrets com segurança
          de nível militar — do CLI ao dashboard, da API às integrações CI/CD.
        </p>
      </div>

      {/* O que é o CriptEnv */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">
          O que é o CriptEnv?
        </h2>
        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
          O CriptEnv é uma plataforma open-source de gerenciamento de secrets com
          arquitetura <strong className="text-[var(--text-primary)]">Zero-Knowledge</strong>. Alternativa ao Doppler e Infisical,
          permite que desenvolvedores e times gerenciem variáveis de ambiente, API keys e
          credenciais sensíveis com criptografia de ponta a ponta.
        </p>
        <p className="text-[var(--text-secondary)] leading-relaxed mb-6">
          Todos os secrets são criptografados <strong className="text-[var(--text-primary)]">100% no lado do cliente</strong> com
          AES-256-GCM. O servidor nunca recebe dados em plaintext — mesmo com acesso total
          ao banco de dados, é impossível descriptografar suas credenciais.
        </p>

        <CodeBlock language="bash" title="Exemplo rápido">
{`# Definir um secret
$ criptenv set DATABASE_URL=postgresql://localhost/mydb
$ criptenv set API_KEY=sk-abc123def456

# Obter um secret (descriptografado localmente)
$ criptenv get DATABASE_URL

# Listar todos os secrets (valores nunca exibidos)
$ criptenv list`}
        </CodeBlock>
      </section>

      {/* Princípios — AbacatePay card style */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-5">
          Princípios da API
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PrincipleCard
            icon={Lock}
            title="Zero-Knowledge"
            description="Secrets são criptografados 100% client-side. O servidor armazena apenas ciphertext — nunca vê seus dados reais."
          />
          <PrincipleCard
            icon={Zap}
            title="Consistente"
            description="CLI e API compartilham a mesma semântica. O que você faz no terminal, pode fazer via HTTP e vice-versa."
          />
          <PrincipleCard
            icon={Shield}
            title="Seguro por padrão"
            description="AES-256-GCM com PBKDF2-HKDF. Sem plaintext em logs, sem exposição de tokens, sem comprometimento de dados."
          />
          <PrincipleCard
            icon={CheckCircle2}
            title="Open Source"
            description="Código aberto sob licença MIT. Audite, contribua e execute self-hosted quando precisar."
          />
        </div>
      </section>

      {/* O que você pode fazer */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-5">
          O que você pode fazer
        </h2>
        <CardGrid cols={3}>
          <DocCard
            title="Gerenciar via CLI"
            description="Terminal-first: set, get, list, delete, push, pull — tudo no seu fluxo natural de desenvolvimento."
            icon={Terminal}
            href="/docs/cli"
          />
          <DocCard
            title="Sincronizar com Cloud"
            description="Push e pull de secrets entre vault local e servidor. Versionamento e detecção de conflitos."
            icon={GitBranch}
            href="/docs/cli/commands"
          />
          <DocCard
            title="Gerenciar Times"
            description="Convites, roles (admin, developer, viewer) e permissões granulares por projeto."
            icon={Users}
            href="/docs/guides/team-setup"
          />
          <DocCard
            title="CI/CD Integrado"
            description="Tokens CI para pipelines. GitHub Action oficial. Secrets como variáveis de ambiente."
            icon={Zap}
            href="/docs/integrations/github-action"
          />
          <DocCard
            title="Integrações Cloud"
            description="Push direto para Vercel, Railway e Render. Sincronize secrets com seus providers."
            icon={RefreshCw}
            href="/docs/integrations"
          />
          <DocCard
            title="Rotação de Secrets"
            description="Políticas manual, notify e auto. Alertas de expiração e histórico de rotações."
            icon={RefreshCw}
            href="/docs/api/rotation"
          />
          <DocCard
            title="Auditoria Completa"
            description="Log de todas as operações: quem, quando, o que. Filtrável por ação e recurso."
            icon={Eye}
            href="/docs/api/audit"
          />
          <DocCard
            title="Importar/Exportar"
            description="Importe de arquivos .env existentes. Exporte em .env ou JSON."
            icon={FileText}
            href="/docs/cli/commands"
          />
          <DocCard
            title="API REST"
            description="API versionada com API keys, CI tokens e rate limiting. Documentação OpenAPI completa."
            icon={Key}
            href="/docs/api"
          />
        </CardGrid>
      </section>

      {/* Primeiros passos */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-5">
          Primeiros passos
        </h2>
        <CardGrid cols={2}>
          <DocCard
            title="Instalação do CLI"
            description="Instale via Homebrew, pip, ou script de instalação. Suporte a macOS, Linux e Windows."
            icon={Terminal}
            href="/docs/getting-started/installation"
          />
          <DocCard
            title="Guia Rápido"
            description="Em 5 minutos, crie seu primeiro projeto e gerencie seus primeiros secrets."
            icon={Zap}
            href="/docs/getting-started/quickstart"
          />
          <DocCard
            title="Configurar CI/CD"
            description="Integre com GitHub Actions, GitLab CI ou qualquer pipeline usando tokens CI."
            icon={GitBranch}
            href="/docs/guides/cicd-setup"
          />
          <DocCard
            title="Entender a Criptografia"
            description="Como funciona o protocolo AES-256-GCM com derivação PBKDF2/HKDF."
            icon={Shield}
            href="/docs/security/encryption"
          />
        </CardGrid>
      </section>

      {/* Saiba mais — links externos */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-5">
          Saiba mais sobre o CriptEnv
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ExternalCard
            icon={BookOpen}
            title="Guia de Segurança"
            description="Protocolo de criptografia, zero-knowledge architecture e modelo de ameaças."
            href="/docs/security"
          />
          <ExternalCard
            icon={Globe}
            title="API Reference"
            description="Documentação completa de todos os ~50 endpoints da API REST."
            href="/docs/api"
          />
          <ExternalCard
            icon={GithubIcon}
            title="GitHub (Open Source)"
            description="Código fonte aberto, issues, contribuições. Licença MIT."
            href="https://github.com/criptenv/criptenv"
            external
          />
          <ExternalCard
            icon={MessageCircle}
            title="Suporte & Comunidade"
            description="Entre em contato para dúvidas, reportar bugs ou sugerir funcionalidades."
            href="https://github.com/criptenv/criptenv/issues"
            external
          />
          <ExternalCard
            icon={ExternalLink}
            title="llms.txt"
            description="Índice completo da documentação para descoberta por LLMs e agentes."
            href="/llms.txt"
          />
          <ExternalCard
            icon={ArrowRight}
            title="Dashboard"
            description="Acesse o painel web para gerenciar projetos, secrets e membros do time."
            href="/dashboard"
          />
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
