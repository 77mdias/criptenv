"use client"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDiscord, faGithubAlt, faGoogle } from "@fortawesome/free-brands-svg-icons"
import { useTranslations } from "next-intl"
import { Link2, Unlink } from "lucide-react"

import { SectionHeader } from "./account-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { OAuthButton, type OAuthProvider } from "@/components/ui/oauth-button"
import { cn } from "@/lib/utils"

export const PROVIDER_META = {
  github: { label: "GitHub", icon: faGithubAlt, chip: "bg-[#24292e]" },
  google: { label: "Google", icon: faGoogle, chip: "bg-[#4285F4]" },
  discord: { label: "Discord", icon: faDiscord, chip: "bg-[#5865F2]" },
} as const

export type ProviderKey = keyof typeof PROVIDER_META

interface LinkedAccount {
  provider: string
  provider_email: string
}

interface LinkedAccountsCardProps {
  accounts: LinkedAccount[]
  loading: boolean
  unlinkedProviders: string[]
  onUnlink: (provider: string) => void
}

/** Linked OAuth identities plus the buttons to link new providers. */
export function LinkedAccountsCard({
  accounts,
  loading,
  unlinkedProviders,
  onUnlink,
}: LinkedAccountsCardProps) {
  const t = useTranslations("account.oauth")

  return (
    <Card>
      <SectionHeader
        icon={Link2}
        title={t("title")}
        description={t("description")}
      />
      <div className="space-y-2">
        {loading ? (
          <Skeleton className="h-14 w-full rounded-xl" />
        ) : accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-6 text-center">
            <p className="text-sm text-[var(--text-muted)] font-mono">
              {t("empty")}
            </p>
          </div>
        ) : (
          accounts.map((account) => {
            const meta = PROVIDER_META[account.provider as ProviderKey]
            return (
              <div
                key={account.provider}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--background-subtle)]"
              >
                <div className="flex items-center gap-3 w-full sm:w-auto overflow-hidden">
                  <div
                    className={cn(
                      "h-9 w-9 shrink-0 rounded-lg flex items-center justify-center",
                      meta?.chip ?? "bg-[var(--background-muted)] text-[var(--text-primary)]",
                      meta && "text-white",
                    )}
                  >
                    {meta ? (
                      <FontAwesomeIcon icon={meta.icon} className="h-4 w-4" />
                    ) : (
                      <span className="text-xs font-bold uppercase">{account.provider[0]}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {meta?.label ?? account.provider}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] font-mono truncate">
                      {account.provider_email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                  <Badge variant="success">{t("connected")}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-500/10"
                    onClick={() => onUnlink(account.provider)}
                  >
                    <Unlink className="h-4 w-4 mr-1" /> {t("unlink")}
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {unlinkedProviders.length > 0 && (
        <div className="mt-5 pt-5 border-t border-[var(--border-subtle)]">
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-3">
            {t("linkNew")}
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            {unlinkedProviders.map((provider) => (
              <OAuthButton
                key={provider}
                provider={provider as OAuthProvider}
                action="link"
                className="w-full sm:w-auto"
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
