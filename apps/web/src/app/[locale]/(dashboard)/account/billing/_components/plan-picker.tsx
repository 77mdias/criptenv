"use client"

import { useLocale, useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { BillingInterval, BillingState, PaidPlan } from "@/lib/api"
import { cn } from "@/lib/utils"

import { brl, day } from "./format"

const PLANS: PaidPlan[] = ["pro", "max"]
const INTERVALS: BillingInterval[] = ["month", "year"]
const RANK: Record<PaidPlan, number> = { pro: 1, max: 2 }

interface PlanPickerProps {
  state: BillingState
  interval: BillingInterval
  selected: PaidPlan | null
  onInterval: (interval: BillingInterval) => void
  onSelect: (plan: PaidPlan) => void
}

/** Pro and Max, monthly or yearly, each saying what choosing it does given the plan in force. */
export function PlanPicker({ state, interval, selected, onInterval, onSelect }: PlanPickerProps) {
  const t = useTranslations("billing")
  const locale = useLocale()
  const live = state.subscription

  function effect(plan: PaidPlan): string {
    if (!live) return t("choose.effect.new")
    if (RANK[plan] > RANK[live.plan]) return t("choose.effect.upgrade")
    return t("choose.effect.later", { date: day(live.current_period_end, locale) })
  }

  return (
    <Card className="p-6">
      <h3 className="mb-4 font-semibold text-(--text-primary)">{t("choose.title")}</h3>

      {state.scheduled ? (
        <p className="text-sm text-(--text-secondary)">{t("choose.scheduledBlocks")}</p>
      ) : (
        <div className="space-y-4">
          <div role="radiogroup" aria-label={t("choose.interval")} className="flex flex-wrap gap-2">
            {INTERVALS.map((option) => (
              <label
                key={option}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                  option === interval
                    ? "border-(--accent) text-(--text-primary)"
                    : "border-(--border) text-(--text-secondary)",
                )}
              >
                <input
                  type="radio"
                  name="billing-interval"
                  checked={option === interval}
                  onChange={() => onInterval(option)}
                />
                <span>
                  {t(`intervals.${option}`)}
                  {option === "year" && ` · ${t("choose.yearlyHint")}`}
                </span>
              </label>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {PLANS.map((plan) => {
              const name = t(`planNames.${plan}`)
              const isCurrent =
                live?.plan === plan && live.interval === interval && !live.cancel_at_period_end
              return (
                <section
                  key={plan}
                  role="group"
                  aria-label={name}
                  className={cn(
                    "space-y-2 rounded-lg border p-4",
                    selected === plan ? "border-(--accent)" : "border-(--border)",
                  )}
                >
                  <h4 className="font-semibold text-(--text-primary)">{name}</h4>
                  <p className="font-mono text-sm text-(--text-primary)">
                    {t(`perInterval.${interval}`, { price: brl(state.prices[plan][interval]) })}
                  </p>
                  {isCurrent ? (
                    <p className="text-sm font-medium text-(--text-secondary)">{t("choose.currentPlan")}</p>
                  ) : (
                    <>
                      <p className="text-sm text-(--text-secondary)">{effect(plan)}</p>
                      <Button
                        variant={selected === plan ? "primary" : "secondary"}
                        size="sm"
                        aria-pressed={selected === plan}
                        onClick={() => onSelect(plan)}
                      >
                        {selected === plan ? t("choose.selected", { plan: name }) : t("choose.select", { plan: name })}
                      </Button>
                    </>
                  )}
                </section>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}
