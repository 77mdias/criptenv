"use client"

import { useParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { ProjectSectionCards } from "@/components/projects/project-navigation"

export default function ProjectOverviewPage() {
  const params = useParams()
  const projectId = String(params.id ?? "")

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Project overview
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            Escolha onde quer trabalhar
          </h2>
          <p className="mt-2 font-mono text-sm leading-relaxed text-[var(--text-tertiary)]">
            As seções do projeto agora vivem aqui no contexto do projeto, mantendo a sidebar
            global limpa para navegação geral da aplicação.
          </p>
        </div>
      </Card>

      <ProjectSectionCards projectId={projectId} />
    </div>
  )
}
