"use client"

import { useState } from "react"
import { Check, Minus } from "lucide-react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { SecretMatrixResponse } from "@/lib/api/projects"
import { matrixRows } from "@/lib/projects/matrix"
import { cn } from "@/lib/utils"

interface KeyMatrixProps {
  projectId: string
  matrix: SecretMatrixResponse
}

/** Which secret exists in which environment — names and versions only, values never leave the vault. */
export function KeyMatrix({ projectId, matrix }: KeyMatrixProps) {
  const t = useTranslations("dashboard.projectOverview.matrix")
  const [onlyMissing, setOnlyMissing] = useState(false)
  const allRows = matrixRows(matrix, false)
  const rows = onlyMissing ? allRows.filter((row) => row.missingIn > 0) : allRows
  const missingCount = allRows.filter((row) => row.missingIn > 0).length

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>
            {allRows.length === 0
              ? t("emptyDescription")
              : missingCount > 0
                ? t("missingDescription", { count: missingCount })
                : t("completeDescription")}
          </CardDescription>
        </div>
        {missingCount > 0 && (
          <button
            type="button"
            aria-pressed={onlyMissing}
            onClick={() => setOnlyMissing((value) => !value)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
              onlyMissing
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--background-subtle)]"
            )}
          >
            {t("onlyMissing")}
          </button>
        )}
      </CardHeader>

      {allRows.length === 0 ? (
        <Link
          href={`/projects/${projectId}/secrets`}
          className="inline-block text-sm font-medium text-[var(--accent)] hover:underline"
        >
          {t("addFirst")} →
        </Link>
      ) : (
        <div className="-mx-2 overflow-x-auto px-2">
          <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
            <caption className="sr-only">{t("title")}</caption>
            <thead>
              <tr>
                <th scope="col" className="py-2 pr-4 text-left font-mono text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  {t("key")}
                </th>
                {matrix.environments.map((env) => (
                  <th
                    key={env.id}
                    scope="col"
                    className="px-3 py-2 text-center font-mono text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]"
                  >
                    {env.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-[var(--border)]">
                  <th
                    scope="row"
                    className="max-w-[16rem] truncate border-t border-[var(--border)] py-2 pr-4 text-left font-mono text-xs font-normal text-[var(--text-primary)]"
                  >
                    <Link href={`/projects/${projectId}/secrets?key=${encodeURIComponent(row.key)}`} className="hover:underline">
                      {row.key}
                    </Link>
                  </th>
                  {row.cells.map((cell, index) => (
                    <td key={matrix.environments[index].id} className="border-t border-[var(--border)] px-3 py-2 text-center">
                      {cell ? (
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-[var(--text-secondary)]">
                          <Check className="h-3.5 w-3.5 text-green-500" aria-hidden />
                          v{cell.version}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 font-mono text-xs text-amber-500">
                          <Minus className="h-3.5 w-3.5" aria-hidden />
                          {t("missing")}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
