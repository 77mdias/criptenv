"use client"

import { useEffect, useState } from "react"
import { meApi } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"

/** Counts shown next to sidebar items, keyed by href. Shares the cached overview request with the dashboard. */
export function useNavBadges(): Record<string, number> {
  const [badges, setBadges] = useState<Record<string, number>>({})
  // Unknown until the session loads: no badge rather than a false alarm.
  const twoFactorOff = useAuthStore((state) => state.user?.two_factor_enabled === false)

  useEffect(() => {
    let cancelled = false
    meApi
      .overview()
      .then((overview) => {
        if (cancelled) return
        setBadges({
          "/integrations": overview.attention.failing_integrations.length,
          // The high-severity findings of /security that the overview alone can tell.
          "/security": overview.attention.expired.length + (twoFactorOff ? 1 : 0),
        })
      })
      .catch(() => {
        // decorative only: the pages themselves surface load errors
      })
    return () => {
      cancelled = true
    }
  }, [twoFactorOff])

  return badges
}

/** Small red counter for a sidebar item; renders nothing when the count is zero. */
export function NavBadge({ count, label }: { count?: number; label: string }) {
  if (!count) return null
  return (
    <span className="ml-auto rounded-full bg-red-500/15 px-1.5 py-0.5 font-mono text-[10px] leading-none text-red-500">
      {count}
      <span className="sr-only"> {label}</span>
    </span>
  )
}
