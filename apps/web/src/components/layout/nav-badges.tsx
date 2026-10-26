"use client"

import { useEffect, useState } from "react"
import { meApi } from "@/lib/api"

/** Counts shown next to sidebar items, keyed by href. Shares the cached overview request with the dashboard. */
export function useNavBadges(): Record<string, number> {
  const [badges, setBadges] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    meApi
      .overview()
      .then((overview) => {
        if (!cancelled) setBadges({ "/integrations": overview.attention.failing_integrations.length })
      })
      .catch(() => {
        // decorative only: the pages themselves surface load errors
      })
    return () => {
      cancelled = true
    }
  }, [])

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
