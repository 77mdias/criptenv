"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FolderTree, KeyRound, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AttentionCard } from "@/components/dashboard/attention-card";
import { KeyMatrix } from "@/components/projects/key-matrix";
import { UsageSnippets } from "@/components/projects/usage-snippets";
import { auditApi, meApi, projectsApi } from "@/lib/api";
import type { AuditLog, OverviewResponse } from "@/lib/api";
import type { SecretMatrixResponse } from "@/lib/api/projects";
import { useAuditDescriber } from "@/lib/audit/describe";
import { buildAttentionItems } from "@/lib/dashboard/attention";

export default function ProjectOverviewPage() {
  const t = useTranslations("dashboard.projectOverview");
  const describe = useAuditDescriber();
  const params = useParams();
  const projectId = String(params.id ?? "");
  const [matrix, setMatrix] = useState<SecretMatrixResponse | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    Promise.all([
      projectsApi.secretMatrix(projectId),
      meApi.overview(),
      auditApi.getLogs(projectId, { per_page: 5 }),
    ])
      .then(([matrixData, overviewData, logData]) => {
        if (cancelled) return;
        setMatrix(matrixData);
        setOverview(overviewData);
        setLogs(logData.logs);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t("loadError"));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, t]);

  const project = overview?.projects.find((p) => p.id === projectId);
  const attention = useMemo(
    () => (overview ? buildAttentionItems(overview).filter((item) => item.projectId === projectId) : []),
    [overview, projectId]
  );
  const defaultEnvironment =
    matrix?.environments.find((env) => env.is_default)?.name ?? matrix?.environments[0]?.name ?? "production";

  if (error) {
    return <p className="font-mono text-sm text-red-600">{error}</p>;
  }

  if (!matrix || !overview || !logs) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const secretTotal = matrix.keys.reduce(
    (sum, key) => sum + Object.values(key.cells).filter(Boolean).length,
    0
  );
  const stats = [
    { icon: FolderTree, label: t("stats.environments"), value: matrix.environments.length, href: `/projects/${projectId}/secrets` },
    { icon: KeyRound, label: t("stats.secrets"), value: secretTotal, href: `/projects/${projectId}/secrets` },
    { icon: Users, label: t("stats.members"), value: project?.member_count ?? 0, href: `/projects/${projectId}/members` },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
            <Card className="flex items-center gap-3 transition-colors hover:bg-[var(--background-subtle)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--background-muted)]">
                <stat.icon className="h-5 w-5 text-[var(--text-tertiary)]" aria-hidden />
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">{stat.label}</p>
                <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <KeyMatrix projectId={projectId} matrix={matrix} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttentionCard items={attention} />
        <Card className="h-full">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{t("activity.title")}</CardTitle>
              <CardDescription>{t("activity.description")}</CardDescription>
            </div>
            <Link href={`/projects/${projectId}/audit`} className="shrink-0 text-sm font-medium text-[var(--accent)] hover:underline">
              {t("activity.viewAll")}
            </Link>
          </CardHeader>
          {logs.length === 0 ? (
            <p className="font-mono text-sm text-[var(--text-muted)]">{t("activity.empty")}</p>
          ) : (
            <ul className="space-y-3">
              {logs.map((log) => {
                const entry = describe(log);
                return (
                  <li key={log.id} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--background-muted)]">
                      <entry.icon className="h-3.5 w-3.5 text-[var(--text-tertiary)]" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm">{entry.title}</p>
                      <time dateTime={log.created_at} className="font-mono text-xs text-[var(--text-muted)]">
                        {entry.time}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <UsageSnippets projectId={projectId} environment={defaultEnvironment} />
    </div>
  );
}
