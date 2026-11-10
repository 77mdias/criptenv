"use client"

import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"
import type { Plan } from "@/lib/api/me"

/**
 * The way to the plans, next to a limit or a locked feature. Renders nothing unless billing is on and
 * the plan is the viewer's own to change: a member of someone else's project cannot lift the owner's limit.
 */
export function UpgradeLink({ plan }: { plan: Plan | null | undefined }) {
  const t = useTranslations("common.planLimits")
  if (!plan?.can_upgrade) return null
  return (
    <Link href="/account/billing" className="text-sm font-medium text-(--accent) hover:underline">
      {t("seePlans")}
    </Link>
  )
}
