"use client"

import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"
import { meApi } from "@/lib/api"

/** Strip across the dashboard while a subscription charge is overdue. Silent when there is nothing to say. */
export function BillingNotice() {
  const t = useTranslations("common.billingNotice")
  const locale = useLocale()
  const [graceUntil, setGraceUntil] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    meApi
      .plan()
      .then((plan) => {
        if (active && plan.can_upgrade && plan.grace_until) setGraceUntil(plan.grace_until)
      })
      .catch(() => {
        // The notice is a convenience: the billing page and the e-mail say the same.
      })
    return () => {
      active = false
    }
  }, [])

  if (!graceUntil) return null
  const date = new Date(graceUntil).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" })
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-red-500/30 bg-red-500/10 px-6 py-2 text-sm text-(--text-primary)"
    >
      <span>{t("text", { date })}</span>
      <Link href="/account/billing" className="font-medium underline">
        {t("action")}
      </Link>
    </div>
  )
}
