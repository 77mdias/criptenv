"use client"

import { useState, useEffect, useCallback } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Copy, Check, Timer, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ContributionQRPanelProps {
  qrCodeBase64: string
  copyPasteCode: string
  startedAt: number | null
  expiresAt: string
  status: string
  amount: number
  onRetry: () => void
}

function formatFromMs(diff: number): string {
  if (diff <= 0) return "00:00"
  const totalSeconds = Math.ceil(diff / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function getWindowState(startedAt: number | null, expiresAt: string) {
  const expiresAtMs = new Date(expiresAt).getTime()
  const startedAtMs = startedAt ?? Date.now()
  const tickNow = Date.now()
  const totalWindowMs = Math.max(1, expiresAtMs - startedAtMs)
  const msRemaining = Math.max(0, expiresAtMs - tickNow)
  const progressPercent = Math.min(100, Math.max(0, (msRemaining / totalWindowMs) * 100))

  return {
    timeLeft: formatFromMs(msRemaining),
    progressPercent,
  }
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case "PAID":
      return "success"
    case "PENDING":
    case "IN_PROCESS":
      return "warning"
    case "EXPIRED":
    case "CANCELLED":
    case "FAILED":
      return "danger"
    default:
      return "default"
  }
}

function statusLabel(status: string, t: (key: string) => string): string {
  switch (status) {
    case "PENDING":
      return t("status.pending")
    case "IN_PROCESS":
      return t("status.inProcess")
    case "PAID":
      return t("status.paid")
    case "EXPIRED":
      return t("status.expired")
    case "CANCELLED":
      return t("status.cancelled")
    case "FAILED":
      return t("status.failed")
    case "REFUNDED":
      return t("status.refunded")
    default:
      return status
  }
}

export function ContributionQRPanel({
  qrCodeBase64,
  copyPasteCode,
  startedAt,
  expiresAt,
  status,
  amount,
  onRetry,
}: ContributionQRPanelProps) {
  const t = useTranslations("marketing.contributionQr")
  const locale = useLocale()
  const formattedAmount = new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(amount)
  const [copied, setCopied] = useState(false)
  const [windowState, setWindowState] = useState(() =>
    getWindowState(startedAt, expiresAt)
  )

  useEffect(() => {
    const updateWindowState = () => {
      setWindowState(getWindowState(startedAt, expiresAt))
    }

    updateWindowState()
    const interval = setInterval(updateWindowState, 1000)
    return () => clearInterval(interval)
  }, [expiresAt, startedAt])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(copyPasteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback ignored
    }
  }, [copyPasteCode])

  const isExpired = status === "EXPIRED" || windowState.timeLeft === "00:00"
  const isPaid = status === "PAID"
  const isTerminal = ["PAID", "EXPIRED", "CANCELLED", "FAILED", "REFUNDED"].includes(status)

  if (isPaid) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-50 dark:bg-green-500/10">
          <Check className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-[var(--text-primary)]">
            {t("paidTitle")}
          </h3>
          <p className="mt-2 text-sm text-[var(--text-tertiary)]">
            {t.rich("paidThanks", {
              amount: formattedAmount,
              strong: (chunks) => <strong className="text-[var(--text-secondary)]">{chunks}</strong>,
            })}
            <br />
            {t("paidSupport")}
          </p>
        </div>
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("another")}
        </Button>
      </div>
    )
  }

  if (isExpired || status === "CANCELLED" || status === "FAILED") {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
          <Timer className="h-10 w-10 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-[var(--text-primary)]">
            {isExpired ? t("expiredTitle") : t("failedTitle")}
          </h3>
          <p className="mt-2 text-sm text-[var(--text-tertiary)]">
            {isExpired ? t("expiredMessage") : t("failedMessage")}
          </p>
        </div>
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("retry")}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Status */}
      <div className="flex items-center justify-between gap-3">
        {isTerminal ? (
          <Badge variant={statusBadgeVariant(status)}>{statusLabel(status, t)}</Badge>
        ) : (
          <span className="flex items-center gap-1.5 font-mono text-xs text-[var(--text-muted)]">
            <Timer className="h-3.5 w-3.5" />
            {t("expiresIn", { time: windowState.timeLeft })}
          </span>
        )}
      </div>

      {!isTerminal && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background-subtle)] p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              {t("window")}
            </span>
            <span className="font-mono text-xs text-[var(--text-muted)]">
              {windowState.timeLeft}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--background-muted)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-1000 ease-linear"
              style={{ width: `${windowState.progressPercent}%` }}
              role="progressbar"
              aria-label={t("timeRemaining")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(windowState.progressPercent)}
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
            {t("windowHint")}
          </p>
        </div>
      )}

      {/* QR Code */}
      <div className="mx-auto w-fit">
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${qrCodeBase64}`}
            alt={t("qrAlt")}
            width={200}
            height={200}
            className="block"
          />
        </div>
      </div>

      {/* Copy-paste code */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-[var(--text-muted)]">
          {t("orCopy")}
        </span>
        <div className="relative">
          <div
            className={cn(
              "break-all rounded-lg border border-[var(--border)] bg-black/[0.03] p-3 pr-12 font-mono text-xs text-[var(--text-secondary)] dark:bg-white/[0.04]"
            )}
          >
            {copyPasteCode}
          </div>
          <button
            onClick={handleCopy}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--background-muted)] hover:text-[var(--text-primary)]"
            aria-label={copied ? t("copied") : t("copy")}
            title={copied ? t("copied") : t("copy")}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--background-subtle)] p-3">
        <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">
          {t("instructions")}
        </p>
      </div>
    </div>
  )
}
