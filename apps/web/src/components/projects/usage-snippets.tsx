"use client"

import { useTranslations } from "next-intl"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CodeBlock, Tab, Tabs } from "@/components/docs"
import { projectSnippets } from "@/lib/projects/snippets"

export function UsageSnippets({ projectId, environment }: { projectId: string; environment: string }) {
  const t = useTranslations("dashboard.projectOverview.usage")
  const snippets = projectSnippets(projectId, environment)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <Tabs className="my-0">
        <Tab value="cli" label="CLI">
          <CodeBlock language="bash" code={snippets.cli} />
        </Tab>
        <Tab value="github" label="GitHub Actions">
          <CodeBlock language="yaml" code={snippets.githubAction} />
        </Tab>
        <Tab value="gitlab" label="GitLab CI">
          <CodeBlock language="yaml" code={snippets.gitlab} />
        </Tab>
        <Tab value="api" label="API">
          <CodeBlock language="bash" code={snippets.api} />
        </Tab>
      </Tabs>
    </Card>
  )
}
