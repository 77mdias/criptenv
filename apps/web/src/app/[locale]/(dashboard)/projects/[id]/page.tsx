"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { ProjectSectionCards } from "@/components/projects/project-navigation";

export default function ProjectOverviewPage() {
  const t = useTranslations("dashboard.projectNav.overviewPage");
  const params = useParams();
  const projectId = String(params.id ?? "");

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
            {t("eyebrow")}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-(--text-primary)">
            {t("title")}
          </h2>
          <p className="mt-2 font-mono text-sm leading-relaxed text-(--text-tertiary)">
            {t("description")}
          </p>
        </div>
      </Card>

      <ProjectSectionCards projectId={projectId} />
    </div>
  );
}
