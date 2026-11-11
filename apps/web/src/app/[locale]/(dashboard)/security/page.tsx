"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { meApi } from "@/lib/api"
import { evaluatePosture, type PostureFinding, type PostureRule, type Severity } from "@/lib/security/posture"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth"

const SEVERITY_TONE: Record<Severity, "danger" | "warning" | "outline"> = {
  high: "danger",
  medium: "warning",
  low: "outline",
}
const MAX_ITEMS = 5
// The rules this page has copy for (spelled out so scripts/audit-i18n-keys.mjs resolves `rules.${...}`).
const RULE_KEYS: readonly PostureRule[] = [
  "twoFactor",
  "expiredSecret",
  "credentialNoExpiry",
  "credentialUnused",
  "notRotated",
  "tooManyManagers",
  "failingIntegration",
]

function ScoreRing({ score }: { score: number }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const color = score >= 80 ? "text-green-600" : score >= 50 ? "text-amber-500" : "text-red-600"
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="10" className="stroke-(--background-muted)" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke="currentColor"
          className={color}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-3xl font-semibold text-(--text-primary)">
        {score}
      </span>
    </div>
  )
}

export default function SecurityPage() {
  const t = useTranslations("dashboard.securityPage")
  const twoFactorEnabled = useAuthStore((state) => state.user?.two_factor_enabled === true)
  const [result, setResult] = useState<{ score: number; findings: PostureFinding[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([meApi.overview(), meApi.credentials()])
      .then(([overview, { credentials }]) => {
        if (!cancelled) setResult(evaluatePosture({ overview, credentials, twoFactorEnabled }))
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t("loadError"))
      })
    return () => {
      cancelled = true
    }
  }, [t, twoFactorEnabled])

  const severityLabels = { high: t("severity.high"), medium: t("severity.medium"), low: t("severity.low") }
  const rule = (finding: PostureFinding) => ({
    title: t(`rules.${finding.rule}.title`, { count: finding.count }),
    body: t(`rules.${finding.rule}.body`),
    action: t(`rules.${finding.rule}.action`),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-(--text-tertiary)">{t("subtitle")}</p>
      </div>

      {error && (
        <Card className="border-red-500/50 p-4">
          <p role="alert" className="font-mono text-sm text-red-600">
            {error}
          </p>
        </Card>
      )}

      {!result && !error ? (
        <Card className="flex items-center gap-6 p-6">
          <Skeleton className="h-32 w-32" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </Card>
      ) : result ? (
        <>
          <Card className="flex flex-col items-center gap-6 p-6 sm:flex-row">
            <ScoreRing score={result.score} />
            <div className="text-center sm:text-left">
              <p className="text-lg font-semibold text-(--text-primary)">{t("score", { score: result.score })}</p>
              <p className="mt-1 text-sm text-(--text-secondary)">
                {result.findings.length === 0 ? t("allGood") : t("summary", { count: result.findings.length })}
              </p>
              <p className="mt-2 text-xs text-(--text-tertiary)">{t("howScored")}</p>
            </div>
          </Card>

          {result.findings.length === 0 ? (
            <Card className="p-0">
              <EmptyState icon={ShieldCheck} title={t("empty.title")} description={t("empty.description")} />
            </Card>
          ) : (
            <ul className="space-y-3">
              {result.findings.filter((finding) => RULE_KEYS.includes(finding.rule)).map((finding) => {
                const copy = rule(finding)
                return (
                  <li key={finding.rule}>
                    <Card className="space-y-3 p-4 md:p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={SEVERITY_TONE[finding.severity]}>{severityLabels[finding.severity]}</Badge>
                        <h2 className="text-sm font-semibold text-(--text-primary)">{copy.title}</h2>
                      </div>
                      <p className="text-sm text-(--text-secondary)">{copy.body}</p>
                      {finding.items && finding.items.length > 0 ? (
                        <ul className="space-y-1">
                          {finding.items.slice(0, MAX_ITEMS).map((item) => (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                className="inline-flex items-center gap-1 font-mono text-xs text-(--accent) hover:underline"
                              >
                                {item.label}
                                <ArrowRight className="h-3 w-3" aria-hidden="true" />
                              </Link>
                            </li>
                          ))}
                          {finding.items.length > MAX_ITEMS && (
                            <li className="font-mono text-xs text-(--text-muted)">
                              {t("andMore", { count: finding.items.length - MAX_ITEMS })}
                            </li>
                          )}
                        </ul>
                      ) : (
                        <Link href={finding.href} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
                          {copy.action}
                        </Link>
                      )}
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      ) : null}
    </div>
  )
}
