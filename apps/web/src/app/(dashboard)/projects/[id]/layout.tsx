"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AlertCircle, ArrowLeft, FolderOpen } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ProjectTabs } from "@/components/projects/project-navigation"
import { peekCached, projectsApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { Project } from "@/lib/api"

function ProjectLayoutSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Skeleton className="h-9 w-32" />
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-full max-w-xl" />
            </div>
          </div>
        </Card>
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
      <Card className="p-6">
        <Skeleton className="h-32 w-full" />
      </Card>
    </div>
  )
}

function ProjectLayoutError({ message }: { message: string }) {
  return (
    <div className="space-y-6">
      <Link href="/projects" className={cn(buttonVariants({ variant: "secondary" }), "w-fit")}>
        <ArrowLeft className="h-4 w-4" />
        Voltar para projetos
      </Link>
      <Card className="border-red-500/40 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              Projeto indisponível
            </h1>
            <p className="mt-2 font-mono text-sm leading-relaxed text-red-600">{message}</p>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default function ProjectDetailLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const projectId = String(params.id ?? "")
  const cachedProject = projectId ? peekCached<Project>(`/api/v1/projects/${projectId}`) : null

  const [project, setProject] = useState<Project | null>(cachedProject)
  const [loading, setLoading] = useState(!cachedProject)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId || cachedProject) {
      return
    }

    let cancelled = false

    projectsApi
      .get(projectId)
      .then((data) => {
        if (cancelled) return
        setProject(data)
      })
      .catch((err) => {
        if (cancelled) return
        setProject(null)
        setError(err instanceof Error ? err.message : "Erro ao carregar projeto")
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [cachedProject, projectId])

  if (loading) {
    return <ProjectLayoutSkeleton />
  }

  if (error || !project) {
    return <ProjectLayoutError message={error ?? "Projeto não encontrado."} />
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Link href="/projects" className={cn(buttonVariants({ variant: "secondary" }), "w-fit")}>
          <ArrowLeft className="h-4 w-4" />
          Projetos
        </Link>

        <Card className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--background-muted)] text-[var(--text-primary)]">
                <FolderOpen className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Projeto
                </p>
                <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                  {project.name}
                </h1>
                <p className="mt-2 max-w-2xl font-mono text-sm leading-relaxed text-[var(--text-tertiary)]">
                  {project.description || "Sem descrição cadastrada para este projeto."}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <ProjectTabs projectId={projectId} />
      </div>

      {children}
    </div>
  )
}
