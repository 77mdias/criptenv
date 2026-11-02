"use client"

import { useEffect, useState, Suspense } from "react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { Mail, Check, AlertTriangle, Loader2, ArrowRight, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"

function AcceptInviteForm() {
  const t = useTranslations("auth.acceptInvite")
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteInfo, setInviteInfo] = useState<{ project_id: string; email: string; role: string } | null>(null)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!token) {
        setLoading(false)
        setError(t("errors.invalidLink"))
        return
      }

      async function lookup() {
        try {
          // We use request directly since this endpoint isn't in authApi yet
          const { request } = await import("@/lib/api/client")
          const data = await request("GET", `/api/auth/invites/lookup?token=${encodeURIComponent(token)}`)
          setInviteInfo(data)
        } catch (err) {
          setError(err instanceof Error ? err.message : t("errors.invalidInvite"))
        } finally {
          setLoading(false)
        }
      }

      void lookup()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [token, t])

  const handleAccept = async () => {
    if (!token) return
    try {
      setAccepting(true)
      setError(null)
      const { request } = await import("@/lib/api/client")
      await request("POST", `/api/auth/invites/accept?token=${encodeURIComponent(token)}`)
      setAccepted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.acceptFailed"))
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
        <Loader2 className="h-7 w-7 animate-spin text-[var(--accent)]" />
        <p className="mt-4 text-sm font-mono text-[var(--text-tertiary)]">{t("checking")}</p>
      </div>
    )
  }

  if (accepted) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--success-border)] bg-[var(--success-bg)]">
          <Check className="h-6 w-6 text-[var(--success)]" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{t("acceptedTitle")}</h1>
          <p className="mx-auto max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
            {t("acceptedMessage")}
          </p>
        </div>
        <Button className="w-full" onClick={() => router.push("/projects")} icon={ArrowRight} iconPosition="right">
          {t("viewProjects")}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--background-muted)]">
          <Mail className="h-5 w-5 text-[var(--text-primary)]" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{t("title")}</h1>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            {t("subtitle")}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {inviteInfo && (
        <dl className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background-subtle)]">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-3">
            <dt className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{t("email")}</dt>
            <dd className="min-w-0 truncate text-right text-sm font-medium text-[var(--text-primary)]">{inviteInfo.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{t("role")}</dt>
            <dd className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold capitalize text-[var(--text-primary)]">
              {inviteInfo.role}
            </dd>
          </div>
        </dl>
      )}

      <Button
        className="w-full"
        onClick={handleAccept}
        loading={accepting}
        disabled={!inviteInfo || !!error}
        icon={ShieldCheck}
      >
        {t("accept")}
      </Button>

      <div className="text-center">
        <Link
          href="/login"
          className="text-sm font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
        >
          {t("otherAccount")}
        </Link>
      </div>
    </div>
  )
}

export default function AcceptInvitePage() {
  const t = useTranslations("auth.acceptInvite")
  return (
    <Suspense fallback={
      <div className="flex min-h-[280px] items-center justify-center">
        <p className="text-center text-[var(--text-tertiary)] font-mono">{t("loading")}</p>
      </div>
    }>
      <AcceptInviteForm />
    </Suspense>
  )
}
