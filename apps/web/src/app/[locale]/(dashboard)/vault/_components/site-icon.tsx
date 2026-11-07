"use client"

import { useState } from "react"
import { KeyRound } from "lucide-react"
import { iconHostname, siteIconSrc } from "@/lib/personal-vault/site-icons"

const KEY_ICON_CLASS = "h-4 w-4 shrink-0 text-(--text-muted)"

/** The login's site icon, or the key icon when off, without a usable URL, or on any load error. */
export function SiteIcon({ url, enabled }: { url?: string; enabled: boolean }) {
  const hostname = enabled ? iconHostname(url) : null
  if (!hostname) return <KeyRound aria-hidden className={KEY_ICON_CLASS} />
  // Keyed by hostname so editing the URL retries after an earlier failure.
  return <SiteIconImage key={hostname} hostname={hostname} />
}

function SiteIconImage({ hostname }: { hostname: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <KeyRound aria-hidden className={KEY_ICON_CLASS} />
  return (
    <img
      src={siteIconSrc(hostname)}
      alt=""
      aria-hidden
      width={16}
      height={16}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="h-4 w-4 shrink-0 rounded-sm"
      onError={() => setFailed(true)}
    />
  )
}
