"use client"

import { useTranslations } from "next-intl"
import { LogOut, Monitor, Smartphone } from "lucide-react"

import { RowIcon, SectionHeader, formatDate, formatRelative } from "./account-ui"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { parseUserAgent } from "@/lib/device-info"
import { cn } from "@/lib/utils"
import type { SessionResponse } from "@/lib/api"

interface SessionsCardProps {
  sessions: SessionResponse[]
  revokingSessionId: string | null
  isRevokingAll: boolean
  onRevoke: (session: SessionResponse) => void
  onRevokeAll: () => void
}

/** Active sessions list with per-session and bulk revoke actions. */
export function SessionsCard({
  sessions,
  revokingSessionId,
  isRevokingAll,
  onRevoke,
  onRevokeAll,
}: SessionsCardProps) {
  const t = useTranslations("account.sessions")
  const otherSessionsCount = sessions.filter((session) => !session.current).length

  return (
    <Card>
      <SectionHeader
        icon={Monitor}
        title={t("title")}
        description={t("deviceCount", { count: sessions.length })}
        action={
          otherSessionsCount > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              loading={isRevokingAll}
              onClick={onRevokeAll}
              className="text-red-600 hover:bg-red-500/10 shrink-0"
            >
              {isRevokingAll ? null : <LogOut className="h-4 w-4" />} {t("revokeOthers")}
            </Button>
          ) : undefined
        }
      />

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-8 text-center">
          <Monitor className="h-8 w-8 text-[var(--text-muted)] mx-auto mb-2" />
          <p className="text-sm text-[var(--text-muted)] font-mono">{t("empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => {
            const device = parseUserAgent(session.user_agent)
            const isCurrent = !!session.current
            const isMobile = /Mobi|Android|iPhone|iPad/i.test(session.user_agent ?? "")
            const isRevoking = revokingSessionId === session.id
            return (
              <div
                key={session.id}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-xl border",
                  isCurrent
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-[var(--border-subtle)] bg-[var(--background-subtle)]",
                )}
              >
                <RowIcon icon={isMobile ? Smartphone : Monitor} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {device.browser}
                    {device.os && (
                      <span className="text-[var(--text-muted)] font-normal"> · {device.os}</span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] font-mono flex items-center gap-2 min-w-0">
                    <span className="truncate">
                      {session.ip_address || t("ipUnknown")}
                      {" · "}
                      {session.last_accessed_at
                        ? t("lastActive", { time: formatRelative(session.last_accessed_at) })
                        : t("createdOn", { date: formatDate(session.created_at) })}
                    </span>
                    {isCurrent && (
                      <span
                        className="inline-flex items-center gap-1.5 text-emerald-500 shrink-0"
                        title={t("currentSessionTitle")}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden />
                        {t("currentSessionBadge")}
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={isRevoking}
                  onClick={() => onRevoke(session)}
                  className={cn(
                    "shrink-0 self-start sm:self-auto",
                    isCurrent
                      ? "text-red-600 hover:bg-red-500/10"
                      : "text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-600",
                  )}
                >
                  {isCurrent ? (
                    <>
                      <LogOut className="h-4 w-4" /> {t("signOut")}
                    </>
                  ) : (
                    t("end")
                  )}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
