"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeftRight, CheckCircle2, Plug, RefreshCw, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { isPlanFull, PlanUsage } from "@/components/shared/plan-usage";
import { integrationsApi, projectsApi } from "@/lib/api";
import { isPlanLimitError } from "@/lib/api/client";
import type { Plan } from "@/lib/api/me";
import type { Integration, IntegrationProvider, Project } from "@/lib/api";

const PROVIDERS = ["vercel", "render", "cloudflare"] as const;
const CONFIG_FIELDS = ["project_id", "team_id", "service_id", "account_id", "script_name"] as const;
type ConfigField = (typeof CONFIG_FIELDS)[number];

// Brand names are not translated.
const PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  vercel: "Vercel",
  render: "Render",
  cloudflare: "Cloudflare Workers",
};

// Provider-side config each integration needs; optional fields may stay empty.
const PROVIDER_FIELDS: Record<IntegrationProvider, { key: ConfigField; optional?: boolean }[]> = {
  vercel: [{ key: "project_id" }, { key: "team_id", optional: true }],
  render: [{ key: "service_id" }],
  cloudflare: [{ key: "account_id" }, { key: "script_name" }],
};

function statusVariant(status: string) {
  if (status === "active") return "success";
  if (status === "error") return "danger";
  return "default";
}

const emptyForm = (provider: IntegrationProvider) => ({
  provider,
  name: `${PROVIDER_LABELS[provider]} Production`,
  apiToken: "",
  fields: {} as Partial<Record<ConfigField, string>>,
});

export default function IntegrationsPage() {
  const t = useTranslations("integrations");
  const locale = useLocale();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => emptyForm("vercel"));
  // The plan of the selected project's owner. null = unknown: no usage shown, nothing disabled; the API still enforces.
  const [plan, setPlan] = useState<Plan | null>(null);
  const [limitHit, setLimitHit] = useState(false);

  // Bumped to load the plan again after a connection is created or removed.
  const [planVersion, setPlanVersion] = useState(0);
  const loadPlan = useCallback(() => setPlanVersion((version) => version + 1), []);

  useEffect(() => {
    if (!selectedProjectId) return;
    let cancelled = false;
    projectsApi
      .plan(selectedProjectId)
      .then((value) => !cancelled && setPlan(value))
      .catch(() => !cancelled && setPlan(null));
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, planVersion]);

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
    loadPlan();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProjectId) return;

    setSaving(true);
    setError(null);
    setLimitHit(false);
    try {
      const config: { api_token: string } & Record<string, string> = {
        api_token: form.apiToken,
      };
      for (const { key } of PROVIDER_FIELDS[form.provider]) {
        const value = form.fields[key]?.trim();
        if (value) config[key] = value;
      }
      await integrationsApi.create(selectedProjectId, {
        provider: form.provider,
        name: form.name,
        config,
      });
      setForm(emptyForm(form.provider));
      await refreshIntegrations();
    } catch (err) {
      if (isPlanLimitError(err)) setLimitHit(true);
      else setError(err instanceof Error ? err.message : t("errors.create"));
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
      setLimitHit(false);
      loadPlan();
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
            onChange={(event) => {
              setSelectedProjectId(event.target.value);
              // The other project has its own owner and plan.
              setPlan(null);
              setLimitHit(false);
            }}
            aria-label={t("selectProject")}
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
                        <Badge variant="outline">
                          {PROVIDER_LABELS[integration.provider as IntegrationProvider] ?? integration.provider}
                        </Badge>
                        <Badge variant={statusVariant(integration.status)}>
                          {integration.status}
                        </Badge>
                      </div>
                      <p className="mt-2 font-mono text-xs text-(--text-muted)">
                        {integration.last_sync_at
                          ? t("lastSync", {
                              date: new Date(
                                integration.last_sync_at,
                              ).toLocaleString(locale),
                            })
                          : t("noSync")}
                      </p>
                      {integration.last_error && (
                        <p className="mt-2 break-words font-mono text-xs text-red-600">
                          {integration.last_error}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Sync needs the unlocked vault, which lives on the secrets page. */}
                      <Button variant="secondary" size="sm" asChild>
                        <Link
                          href={`/projects/${selectedProjectId}/secrets?sync=${integration.id}`}
                          className="gap-1.5"
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
                          {t("actions.sync")}
                        </Link>
                      </Button>
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
                  {t("form.title")}
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
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-(--text-secondary)">
                  {t("form.provider")}
                </span>
                <select
                  value={form.provider}
                  onChange={(event) =>
                    setForm(emptyForm(event.target.value as IntegrationProvider))
                  }
                  className="h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-3 font-mono text-sm text-(--text-primary)"
                >
                  {PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>
                      {PROVIDER_LABELS[provider]}
                    </option>
                  ))}
                </select>
              </label>
              <p className="font-mono text-xs text-(--text-muted)">
                {t(`form.hints.${form.provider}`)}
              </p>
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
                autoComplete="off"
                value={form.apiToken}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    apiToken: event.target.value,
                  }))
                }
                required
              />
              {PROVIDER_FIELDS[form.provider].map(({ key, optional }) => (
                <Input
                  key={`${form.provider}-${key}`}
                  label={t(`form.fields.${key}`)}
                  value={form.fields[key] ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fields: { ...current.fields, [key]: event.target.value },
                    }))
                  }
                  required={!optional}
                />
              ))}
              <PlanUsage plan={plan} limitKey="integrations_per_project" limitHit={limitHit} />
              <Button
                type="submit"
                fullWidth
                loading={saving}
                disabled={!selectedProjectId || isPlanFull(plan, "integrations_per_project")}
              >
                {t("form.submit", { provider: PROVIDER_LABELS[form.provider] })}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
