"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Plug, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { integrationsApi, projectsApi } from "@/lib/api";
import type { Integration, Project } from "@/lib/api";

function statusVariant(status: string) {
  if (status === "active") return "success";
  if (status === "error") return "danger";
  return "default";
}

export default function IntegrationsPage() {
  const t = useTranslations("integrations");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "Vercel Production",
    apiToken: "",
    vercelProjectId: "",
  });

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  useEffect(() => {
    let cancelled = false;

    projectsApi
      .list()
      .then((data) => {
        if (cancelled) return;
        setProjects(data.projects);
        setSelectedProjectId(
          (current) => current || data.projects[0]?.id || "",
        );
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t("errors.loadProjects"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!selectedProjectId) {
      return;
    }

    integrationsApi
      .list(selectedProjectId)
      .then((data) => {
        if (!cancelled) setIntegrations(data.integrations);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t("errors.loadIntegrations"),
          );
          setIntegrations([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const refreshIntegrations = async () => {
    if (!selectedProjectId) return;
    const data = await integrationsApi.list(selectedProjectId);
    setIntegrations(data.integrations);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProjectId) return;

    setSaving(true);
    setError(null);
    try {
      await integrationsApi.create(selectedProjectId, {
        provider: "vercel",
        name: form.name,
        config: {
          api_token: form.apiToken,
          project_id: form.vercelProjectId,
        },
      });
      setForm((current) => ({ ...current, apiToken: "", vercelProjectId: "" }));
      await refreshIntegrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.create"));
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async (integration: Integration) => {
    if (!selectedProjectId) return;

    setValidatingId(integration.id);
    setError(null);
    try {
      const result = await integrationsApi.validate(
        selectedProjectId,
        integration.id,
      );
      if (!result.valid) {
        setError(result.error || t("errors.validateFailed"));
      }
      await refreshIntegrations();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("errors.validate"),
      );
    } finally {
      setValidatingId(null);
    }
  };

  const handleDelete = async (integration: Integration) => {
    if (!selectedProjectId) return;
    if (!window.confirm(t("removeConfirm", { name: integration.name }))) return;

    setDeletingId(integration.id);
    setError(null);
    try {
      await integrationsApi.delete(selectedProjectId, integration.id);
      setIntegrations((current) =>
        current.filter((item) => item.id !== integration.id),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("errors.remove"),
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 font-mono text-sm text-(--text-tertiary)">
            {selectedProject ? selectedProject.name : t("selectProject")}
          </p>
        </div>
        {projects.length > 0 && (
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            className="h-10 rounded-lg border border-(--border) bg-(--surface) px-3 font-mono text-sm text-(--text-primary)"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <Card className="border-red-500/50 p-4">
          <p className="font-mono text-sm text-red-600">{error}</p>
        </Card>
      )}

      {projects.length === 0 && !loading ? (
        <EmptyState
          icon={Plug}
          title={t("emptyProjects.title")}
          description={t("emptyProjects.description")}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            {loading ? (
              <>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </>
            ) : integrations.length === 0 ? (
              <EmptyState
                icon={Plug}
                title={t("emptyIntegrations.title")}
                description={t("emptyIntegrations.description")}
                className="py-12"
              />
            ) : (
              integrations.map((integration) => (
                <Card key={integration.id} className="p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-mono text-sm font-semibold text-(--text-primary)">
                          {integration.name}
                        </h2>
                        <Badge variant="outline">{integration.provider}</Badge>
                        <Badge variant={statusVariant(integration.status)}>
                          {integration.status}
                        </Badge>
                      </div>
                      <p className="mt-2 font-mono text-xs text-(--text-muted)">
                        {integration.last_sync_at
                          ? t("lastSync", {
                              date: new Date(
                                integration.last_sync_at,
                              ).toLocaleString("pt-BR"),
                            })
                          : t("noSync")}
                      </p>
                      {integration.last_error && (
                        <p className="mt-2 font-mono text-xs text-red-600">
                          {integration.last_error}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={CheckCircle2}
                        loading={validatingId === integration.id}
                        onClick={() => handleValidate(integration)}
                      >
                        {t("actions.validate")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600"
                        loading={deletingId === integration.id}
                        aria-label={t("actions.remove")}
                        onClick={() => handleDelete(integration)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          <Card className="p-4">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-sm font-semibold text-(--text-primary)">
                  Vercel
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t("actions.refresh")}
                  onClick={() => void refreshIntegrations()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                label={t("form.name")}
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
              />
              <Input
                label={t("form.apiToken")}
                type="password"
                value={form.apiToken}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    apiToken: event.target.value,
                  }))
                }
                required
              />
              <Input
                label={t("form.projectId")}
                value={form.vercelProjectId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    vercelProjectId: event.target.value,
                  }))
                }
                required
              />
              <Button
                type="submit"
                fullWidth
                loading={saving}
                disabled={!selectedProjectId}
              >
                {t("form.submit")}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
