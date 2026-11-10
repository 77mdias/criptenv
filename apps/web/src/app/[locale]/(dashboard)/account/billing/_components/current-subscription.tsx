"use client"

import { CreditCard } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { PlanUsage } from "@/components/shared/plan-usage"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { BillingState } from "@/lib/api"
import type { Plan } from "@/lib/api/me"

import { SectionHeader } from "../../_components/account-ui"
import { brl, day } from "./format"

// Kept in this file and exported: the i18n auditor resolves t(`planNames.${...}`) and t(`intervals.${...}`)
// only from literal arrays here.
export const BILLING_PLAN_NAMES = ["free", "pro", "max", "unlimited"] as const
export const BILLING_INTERVALS = ["month", "year"] as const

interface CurrentSubscriptionProps {
  plan: Plan
  state: BillingState
  busy: boolean
  onSync: () => void
  onCancel: () => void
}

/** The plan in force, what happens next with it, and an open checkout. */
export function CurrentSubscription({ plan, state, busy, onSync, onCancel }: CurrentSubscriptionProps) {
  const t = useTranslations("billing")
  const locale = useLocale()
  const { subscription, scheduled, pending } = state
  // A cancel acts on the scheduled change when there is one, else on the plan in force.
  const target = scheduled ?? subscription
  const known = BILLING_PLAN_NAMES.find((name) => name === plan.id)
  const planName = known ? t(`planNames.${known}`) : plan.id

  return (
    <Card className="p-6">
      <SectionHeader
        icon={CreditCard}
        title={t("current.title")}
        description={planName}
        action={
          target && !target.cancel_at_period_end ? (
            <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
              {t("cancel.action")}
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-3 text-sm text-(--text-secondary)">
        <PlanUsage plan={plan} limitKey="projects" />

        {!subscription && <p>{t("current.noSubscription")}</p>}

        {subscription?.status === "past_due" && (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-(--text-primary)">
            {t("current.grace", { date: day(subscription.grace_until, locale) })}
          </p>
        )}

        {subscription && subscription.status !== "past_due" && (
          <p>
            {subscription.cancel_at_period_end
              ? t("current.validUntil", { date: day(subscription.current_period_end, locale) })
              : t("current.nextCharge", {
                  date: day(subscription.current_period_end, locale),
                  price: brl(subscription.amount),
                })}
          </p>
        )}

        {scheduled && (
          <p>
            {t("current.scheduled", {
              plan: t(`planNames.${scheduled.plan}`),
              interval: t(`intervals.${scheduled.interval}`),
              date: day(scheduled.current_period_start, locale),
            })}
          </p>
        )}

        {pending && (
          <div className="space-y-2 border-t border-(--border) pt-3">
            <p>
              {t("current.pending", {
                plan: t(`planNames.${pending.plan}`),
                interval: t(`intervals.${pending.interval}`),
              })}
            </p>
            <div className="flex flex-wrap gap-2">
              {pending.init_point && (
                <a href={pending.init_point} className={buttonVariants({ variant: "primary", size: "sm" })}>
                  {t("current.continuePayment")}
                </a>
              )}
              <Button variant="secondary" size="sm" onClick={onSync} disabled={busy}>
                {t("current.alreadyPaid")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
