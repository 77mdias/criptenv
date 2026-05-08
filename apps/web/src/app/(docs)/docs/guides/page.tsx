import { Breadcrumb, DocCard, CardGrid } from "@/components/docs"
import { BookOpen, Users, GitBranch, RefreshCw, FileText } from "lucide-react"

export default function GuidesPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: "Guias" }]} />

      <h1>Guias</h1>
      <p className="text-lg text-[var(--text-secondary)] mb-8">
        Guias práticos passo a passo para cenários comuns de uso do CriptEnv.
      </p>

      <CardGrid cols={2}>
        <DocCard
          title="Seu Primeiro Projeto"
          description="Do zero ao primeiro secret gerenciado em 5 minutos. Crie conta, projeto, e gerencie suas variáveis de ambiente."
          icon={BookOpen}
          href="/docs/guides/first-project"
        />
        <DocCard
          title="Configurar Time"
          description="Convide membros, defina roles (admin, developer, viewer) e gerencie permissões por projeto."
          icon={Users}
          href="/docs/guides/team-setup"
        />
        <DocCard
          title="CI/CD com CriptEnv"
          description="Integre com GitHub Actions, GitLab CI, CircleCI e mais. Tokens CI e GitHub Action oficial."
          icon={GitBranch}
          href="/docs/guides/cicd-setup"
        />
        <DocCard
          title="Rotação de Secrets"
          description="Configure políticas de rotação manual, notify ou auto. Automatize com GitHub Actions scheduled workflows."
          icon={RefreshCw}
          href="/docs/guides/secret-rotation"
        />
        <DocCard
          title="Migrando do .env"
          description="Importe seus arquivos .env existentes para o CriptEnv com um único comando."
          icon={FileText}
          href="/docs/guides/migration"
        />
      </CardGrid>
    </div>
  )
}
