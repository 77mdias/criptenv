"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import { Card } from "@/components/ui/card"
import { Link } from "@/i18n/navigation"
import { meApi } from "@/lib/api"

// Kept in this file: the i18n auditor resolves t(`planNames.${...}`) only from a literal array here.
const PLAN_NAMES = ["free", "pro", "max", "unlimited"] as const

/** Sidebar card of the account page: the plan and the way to the subscription. Only while billing is on. */
export function PlanCard() {
  const t = useTranslations("billing")
  const [planId, setPlanId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    meApi
      .plan()
      .then((plan) => {
        if (active && plan.can_upgrade) setPlanId(plan.id)
      })
      .catch(() => {
        // No card is better than a broken one; the account page works without it.
      })
    return () => {
      active = false
    }
  }, [])

  if (!planId) return null
  const known = PLAN_NAMES.find((name) => name === planId)
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-(--text-primary)">{t("card.title")}</h3>
      <p className="font-mono text-sm text-(--text-primary)">{known ? t(`planNames.${known}`) : planId}</p>
      <Link href="/account/billing" className="mt-3 inline-block text-sm font-medium text-(--accent) hover:underline">
        {t("card.manage")}
      </Link>
    </Card>
  )
}
