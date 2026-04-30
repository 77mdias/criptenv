"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, FolderOpen, Key, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { CreateProjectDialog } from "@/components/shared/create-project-dialog"
import { projectsApi } from "@/lib/api"
import { formatRelativeTime } from "@/lib/utils"
import type { Project } from "@/lib/api"

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchProjects = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await projectsApi.list()
      setProjects(data.projects)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar projetos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  const handleCreateSuccess = () => {
    fetchProjects()
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="text-red-600 text-sm font-mono mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
            Gerencie seus projetos e secrets
          </p>
        </div>
        <Button icon={Plus} onClick={() => setDialogOpen(true)}>
          Novo Projeto
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <div className="flex gap-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-3 w-16" />
              </div>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Nenhum projeto ainda"
          description="Crie seu primeiro projeto para começar a gerenciar seus secrets de forma segura."
          action={{
            label: "Criar Primeiro Projeto",
            onClick: () => setDialogOpen(true),
            icon: Plus,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer group">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--background-muted)] group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-foreground)] transition-colors">
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)]">
                      {project.name}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] font-mono">
                      {project.description || "Sem descrição"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-[var(--text-muted)] font-mono">
                  <span className="flex items-center gap-1">
                    <Key className="h-3 w-3" /> Projeto
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] px-2 py-0">
                    {project.name}
                  </Badge>
                  <span className="text-xs text-[var(--text-muted)] font-mono">
                    {project.updated_at ? formatRelativeTime(project.updated_at) : "—"}
                  </span>
                </div>
              </Card>
            </Link>
          ))}

          {/* Create new project card */}
          <Card
            className="border-dashed hover:border-[var(--accent)] transition-colors cursor-pointer flex items-center justify-center min-h-[200px]"
            onClick={() => setDialogOpen(true)}
          >
            <div className="text-center">
              <Plus className="h-8 w-8 mx-auto text-[var(--text-muted)] mb-2" />
              <p className="text-sm text-[var(--text-tertiary)] font-medium">
                Criar novo projeto
              </p>
            </div>
          </Card>
        </div>
      )}

      <CreateProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleCreateSuccess}
      />
    </div>
  )
}
