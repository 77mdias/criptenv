"use client"

import { useLocale, useTranslations } from "next-intl"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ActivityDay } from "@/lib/api"

const HEIGHT = 120
const BAR_GAP = 2

/** Stacked bars per day: secret changes (accent) over other activity (muted). Plain SVG, no chart lib. */
export function ActivityChart({ days }: { days: ActivityDay[] }) {
  const t = useTranslations("dashboard.home.chart")
  const locale = useLocale()
  const dayLabel = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", timeZone: "UTC" })
  const label = (date: string) => dayLabel.format(new Date(`${date}T00:00:00Z`))

  const max = Math.max(1, ...days.map((d) => d.changes + d.other))
  const total = days.reduce((sum, d) => sum + d.changes + d.other, 0)
  const width = 100 / Math.max(days.length, 1)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description", { count: total, days: days.length })}</CardDescription>
      </CardHeader>

      <svg
        viewBox={`0 0 100 ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-32 w-full"
        role="img"
        aria-label={t("description", { count: total, days: days.length })}
      >
        {days.map((day, index) => {
          const changesHeight = (day.changes / max) * HEIGHT
          const otherHeight = (day.other / max) * HEIGHT
          const x = index * width + BAR_GAP / 4
          const barWidth = Math.max(width - BAR_GAP / 2, 0.5)
          return (
            <g key={day.date}>
              <title>{t("tooltip", { date: label(day.date), changes: day.changes, other: day.other })}</title>
              {/* full-height hit area so the tooltip works on empty days too */}
              <rect x={x} y={0} width={barWidth} height={HEIGHT} fill="transparent" />
              <rect x={x} y={HEIGHT - otherHeight} width={barWidth} height={otherHeight} className="fill-[var(--text-muted)] opacity-40" />
              <rect
                x={x}
                y={HEIGHT - otherHeight - changesHeight}
                width={barWidth}
                height={changesHeight}
                className="fill-[var(--accent)]"
              />
            </g>
          )
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-mono text-[11px] text-[var(--text-muted)]">
        <span>{days[0] ? label(days[0].date) : ""}</span>
        <span className="order-last flex w-full items-center gap-3 sm:order-none sm:w-auto">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-[var(--accent)]" aria-hidden />
            {t("changes")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-[var(--text-muted)] opacity-40" aria-hidden />
            {t("other")}
          </span>
        </span>
        <span>{days.length ? label(days[days.length - 1].date) : ""}</span>
      </div>

      <table className="sr-only">
        <caption>{t("title")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("date")}</th>
            <th scope="col">{t("changes")}</th>
            <th scope="col">{t("other")}</th>
          </tr>
        </thead>
        <tbody>
          {days.filter((d) => d.changes + d.other > 0).map((day) => (
            <tr key={day.date}>
              <td>{label(day.date)}</td>
              <td>{day.changes}</td>
              <td>{day.other}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
