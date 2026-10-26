"use client"

import { useState } from "react"
import { Check, Copy, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { Card } from "@/components/ui/card"
import type { OnboardingStep } from "@/lib/dashboard/onboarding"
import { cn } from "@/lib/utils"

// Literal list so scripts/audit-i18n-keys.mjs can resolve `steps.${...}`
export const ONBOARDING_STEP_IDS = ["createProject", "addSecret", "installCli", "inviteTeammate"] as const

const CLI_COMMAND = "pip install criptenv"

interface OnboardingChecklistProps {
  steps: OnboardingStep[]
  /** first project, used for the secrets/members shortcuts */
  projectId: string | null
  onCliDone: () => void
  onDismiss: () => void
}

export function OnboardingChecklist({ steps, projectId, onCliDone, onDismiss }: OnboardingChecklistProps) {
  const t = useTranslations("dashboard.home.onboarding")
  const [copied, setCopied] = useState(false)
  const doneCount = steps.filter((step) => step.done).length

  const hrefs: Record<string, string> = {
    createProject: "/projects",
    addSecret: projectId ? `/projects/${projectId}/secrets` : "/projects",
    inviteTeammate: projectId ? `/projects/${projectId}/members` : "/projects",
  }

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(CLI_COMMAND)
      setCopied(true)
    } catch {
      // clipboard blocked (permissions/insecure context): the command stays visible to copy by hand
    }
    onCliDone()
  }

  return (
    <Card className="relative">
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("dismiss")}
        className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--background-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="pr-10">
        <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
        <p className="mt-1 font-mono text-sm text-[var(--text-tertiary)]">{t("description")}</p>
      </div>

      <div
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--background-muted)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
        aria-label={t("progress", { done: doneCount, total: steps.length })}
      >
        <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <p className="mt-2 font-mono text-xs text-[var(--text-muted)]">
        {t("progress", { done: doneCount, total: steps.length })}
      </p>

      <ol className="mt-4 grid gap-3 md:grid-cols-2">
        {steps.map((step) => (
          <li
            key={step.id}
            className={cn(
              "flex gap-3 rounded-xl border border-[var(--border)] p-3",
              step.done && "opacity-60"
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                step.done
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border-[var(--border)]"
              )}
              aria-hidden
            >
              {step.done && <Check className="h-3 w-3" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", step.done && "line-through")}>
                {t(`steps.${step.id}.title`)}
                <span className="sr-only">{step.done ? ` — ${t("done")}` : ""}</span>
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{t(`steps.${step.id}.description`)}</p>

              {!step.done && step.id === "installCli" && (
                <button
                  type="button"
                  onClick={copyCommand}
                  className="mt-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background-subtle)] px-2.5 py-1.5 font-mono text-xs hover:border-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <span className="truncate">{CLI_COMMAND}</span>
                  {copied ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
                  <span className="sr-only">{copied ? t("copied") : t("copy")}</span>
                </button>
              )}
              {!step.done && step.id !== "installCli" && (
                <Link
                  href={hrefs[step.id]}
                  className="mt-2 inline-block text-xs font-medium text-[var(--accent)] hover:underline"
                >
                  {t(`steps.${step.id}.cta`)} →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}
