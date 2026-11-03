import { getTranslations } from "next-intl/server"
import { Breadcrumb, DocCard, CardGrid } from "@/components/docs"
import { BookOpen, Users, GitBranch, RefreshCw, FileText } from "lucide-react"

export default async function GuidesPage() {
  const t = await getTranslations("docs.guides.overview")
  return (
    <div>
      <Breadcrumb items={[{ label: t("title") }]} />

      <h1>{t("title")}</h1>
      <p className="text-lg text-[var(--text-secondary)] mb-8">
        {t("description")}
      </p>

      <CardGrid cols={2}>
        <DocCard
          title={t("cards.firstProject.title")}
          description={t("cards.firstProject.description")}
          icon={BookOpen}
          href="/docs/guides/first-project"
        />
        <DocCard
          title={t("cards.teamSetup.title")}
          description={t("cards.teamSetup.description")}
          icon={Users}
          href="/docs/guides/team-setup"
        />
        <DocCard
          title={t("cards.cicd.title")}
          description={t("cards.cicd.description")}
          icon={GitBranch}
          href="/docs/guides/cicd-setup"
        />
        <DocCard
          title={t("cards.secretRotation.title")}
          description={t("cards.secretRotation.description")}
          icon={RefreshCw}
          href="/docs/guides/secret-rotation"
        />
        <DocCard
          title={t("cards.migration.title")}
          description={t("cards.migration.description")}
          icon={FileText}
          href="/docs/guides/migration"
        />
      </CardGrid>
    </div>
  )
}
