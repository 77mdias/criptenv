"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"
import { PLAN_PRICES } from "@/lib/plan-prices"
import { cn } from "@/lib/utils"

// Prose lives in `messages/<locale>/marketing.json` under `landing.plans`;
// these module-scope literals only carry stable keys, never user-facing copy.
const PLANS = ["free", "pro", "max"] as const
const INTERVALS = ["month", "year"] as const
// The rows of the plans table in docs/superpowers/specs/2026-11-09-subscription-plans-design.md.
const ROWS = [
  "security", "projects", "environments", "members", "personalVault", "connections",
  "sync", "redeploy", "ciSync", "audit", "tokens",
] as const

type PlanKey = (typeof PLANS)[number]
type Interval = (typeof INTERVALS)[number]

// Prices are in BRL in every locale.
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })

const HREFS: Record<PlanKey, string> = {
  free: "/signup",
  pro: "/account/billing?plan=pro",
  max: "/account/billing?plan=max",
}

/** Free, Pro and Max on the landing page: prices, what each plan includes and where to start. */
export function PricingSection() {
  const t = useTranslations("marketing.landing.plans")
  const [interval, setCycle] = useState<Interval>("month")

  return (
    <div className="space-y-8">
      <p className="mx-auto max-w-2xl text-center text-(--text-secondary)">{t("description")}</p>

      <div role="radiogroup" aria-label={t("interval.label")} className="flex flex-wrap justify-center gap-2">
        {INTERVALS.map((option) => (
          <label
            key={option}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm",
              option === interval
                ? "border-(--accent) text-(--text-primary)"
                : "border-(--border) text-(--text-secondary)",
            )}
          >
            <input
              type="radio"
              name="pricing-interval"
              checked={option === interval}
              onChange={() => setCycle(option)}
            />
            <span>
              {t(`interval.${option}`)}
              {option === "year" && ` · ${t("interval.yearlyHint")}`}
            </span>
          </label>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <section
            key={plan}
            role="group"
            aria-label={t(`names.${plan}`)}
            className={cn(
              "flex flex-col gap-3 rounded-2xl border bg-(--surface) p-6",
              plan === "pro" ? "border-(--accent)" : "border-(--border)",
            )}
          >
            <h3 className="text-lg font-semibold text-(--text-primary)">{t(`names.${plan}`)}</h3>
            <p className="flex items-baseline gap-2">
              <span className="font-mono text-3xl font-semibold text-(--text-primary)">
                {BRL.format(plan === "free" ? 0 : PLAN_PRICES[plan][interval])}
              </span>
              {plan !== "free" && <span className="text-sm text-(--text-secondary)">{t(`per.${interval}`)}</span>}
            </p>
            <p className="flex-1 text-sm text-(--text-secondary)">{t(`taglines.${plan}`)}</p>
            <Link
              href={HREFS[plan]}
              className={cn(
                "inline-flex h-10 items-center justify-center rounded-full px-6 text-sm font-medium transition-colors",
                plan === "pro"
                  ? "bg-(--accent) text-(--accent-foreground) hover:bg-(--accent-hover)"
                  : "border border-(--border) text-(--text-primary) hover:bg-(--background-subtle)",
              )}
            >
              {t(`cta.${plan}`)}
            </Link>
          </section>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-(--border) bg-(--surface)">
        <table aria-label={t("table.caption")} className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-(--border) text-(--text-primary)">
              <th scope="col" className="p-3 font-medium">{t("table.feature")}</th>
              {PLANS.map((plan) => (
                <th key={plan} scope="col" className="p-3 font-medium">{t(`names.${plan}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row} className="border-b border-(--border) last:border-0">
                <th scope="row" className="p-3 font-normal text-(--text-primary)">{t(`table.rows.${row}.label`)}</th>
                {PLANS.map((plan) => (
                  <td key={plan} className="p-3 text-(--text-secondary)">{t(`table.rows.${row}.${plan}`)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-center text-sm text-(--text-secondary)">
        {t("footnote")}{" "}
        <Link href="/contribute" className="font-medium text-(--text-primary) underline">
          {t("contribute")}
        </Link>
      </p>
    </div>
  )
}
