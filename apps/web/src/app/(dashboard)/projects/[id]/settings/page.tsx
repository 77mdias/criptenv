"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Settings, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { projectsApi } from "@/lib/api";
import { CITokensPanel } from "@/components/shared/ci-tokens-panel";
import type { Project } from "@/lib/api";

export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchProject() {
      try {
        setLoading(true);
        const data = await projectsApi.get(projectId);
        setProject(data);
        setName(data.name);
        setDescription(data.description || "");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar projeto",
        );
      } finally {
        setLoading(false);
      }
    }
    fetchProject();
  }, [projectId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await projectsApi.update(projectId, {
        name,
        description: description || undefined,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== project?.name) return;
    try {
      setDeleting(true);
      await projectsApi.delete(projectId);
      router.push("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao deletar");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Configurações
          </h1>
          <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
            Configure o projeto
          </p>
        </div>
        <Card className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
          Configure o projeto
        </p>
      </div>

      {/* CI Tokens */}
      <CITokensPanel projectId={projectId} />

      {error && (
        <Card className="p-4 border-red-500/50">
          <p className="text-red-500 text-sm font-mono">{error}</p>
        </Card>
      )}

      {/* General Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="h-5 w-5 text-[var(--text-muted)]" />
          <h2 className="font-semibold text-[var(--text-primary)]">
            Informações do projeto
          </h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
              Nome
            </label>
            <input
              type="text"
              className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
              Descrição
            </label>
            <textarea
              className="flex w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 min-h-[100px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional do projeto"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} loading={saving}>
              Salvar alterações
            </Button>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="p-6 border-red-500/30">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <h2 className="font-semibold text-red-500">Zona de perigo</h2>
        </div>

        <p className="text-sm text-[var(--text-tertiary)] font-mono mb-4">
          Esta ação não pode ser desfeita. Isso excluirá permanentemente o
          projeto e todos os seus dados.
        </p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
              Digite <span className="text-red-500">{project?.name}</span> para
              confirmar
            </label>
            <input
              type="text"
              className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={project?.name}
            />
          </div>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={deleting}
            disabled={deleteConfirm !== project?.name}
            icon={Trash2}
          >
            Deletar projeto
          </Button>
        </div>
      </Card>
    </div>
  );
}
