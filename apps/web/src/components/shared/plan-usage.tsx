"use client"

import { useTranslations } from "next-intl"

import type { Plan } from "@/lib/api/me"

import { UpgradeLink } from "./upgrade-link"

// Kept in this file and exported: the i18n auditor resolves `t(`${key}.usage`)` only from a literal array here.
export const PLAN_USAGE_KEYS = [
  "projects",
  "environments_per_project",
  "members_per_project",
  "integrations_per_project",
] as const

export type PlanUsageKey = (typeof PLAN_USAGE_KEYS)[number]

/** False while the plan is unknown or has no limit: nothing is disabled on a guess, the API still enforces. */
export function isPlanFull(plan: Plan | null, limitKey: PlanUsageKey): boolean {
  const max = plan?.limits[limitKey] ?? null
  return max !== null && (plan?.usage[limitKey] ?? 0) >= max
}

interface PlanUsageProps {
  /** null = not loaded or failed to load. */
  plan: Plan | null
  limitKey: PlanUsageKey
  /** The server answered 402: the limit is reached even if `plan` is unknown or stale. */
  limitHit?: boolean
}

/** "2 de 3 projetos", plus a notice once the limit is reached. Renders nothing for an unlimited plan. */
export function PlanUsage({ plan, limitKey, limitHit = false }: PlanUsageProps) {
  const t = useTranslations("common.planLimits")
  const max = plan?.limits[limitKey] ?? null

  if (max === null) {
    return limitHit ? (
      <p role="status" className="text-sm text-(--text-secondary)">
        {t("reachedUnknown")}
      </p>
    ) : null
  }

  const used = plan?.usage[limitKey] ?? 0
  return (
    <div className="space-y-1 text-sm text-(--text-secondary)">
      <p>{t(`${limitKey}.usage`, { used, max })}</p>
      {(limitHit || used >= max) && (
        <>
          <p role="status">{t(`${limitKey}.reached`, { max })}</p>
          <UpgradeLink plan={plan} />
        </>
      )}
    </div>
  )
}
