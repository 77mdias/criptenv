"use client"

import { Clock, AlertTriangle, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface ExpirationBadgeProps {
  daysUntilExpiration?: number | null
  isExpired?: boolean
  expiresAt?: string
  className?: string
}

/**
 * ExpirationBadge — M3.5.7 Secret Alerts
 * 
 * Displays a colored badge indicating secret expiration status.
 * 
 * GRASP Patterns:
 * - Pure Fabrication: Standalone UI component
 * - Information Expert: Knows how to display expiration state
 * 
 * Variants:
 * - Green (>30 days): Safe, no action needed
 * - Yellow (7-30 days): Warning, plan for rotation
 * - Red (<7 days): Critical, immediate action needed
 * - Black (expired): Past expiration date
 */
export function ExpirationBadge({
  daysUntilExpiration,
  isExpired,
  expiresAt,
  className = "",
}: ExpirationBadgeProps) {
  // No expiration data
  if (daysUntilExpiration == null && !isExpired) {
    return null
  }

  // Already expired
  if (isExpired || (daysUntilExpiration != null && daysUntilExpiration < 0)) {
    return (
      <Badge
        variant="destructive"
        className={`gap-1 text-[10px] ${className}`}
        title={expiresAt ? `Expired: ${expiresAt}` : "Expired"}
      >
        <XCircle className="h-3 w-3" aria-hidden="true" />
        Expirado
      </Badge>
    )
  }

  // Critical: < 7 days
  if (daysUntilExpiration <= 7) {
    return (
      <Badge
        className={`gap-1 bg-amber-500 text-white text-[10px] ${className}`}
        title={expiresAt ? `Expires: ${expiresAt}` : `Expires in ${daysUntilExpiration} days`}
      >
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        {daysUntilExpiration} dias
      </Badge>
    )
  }

  // Warning: 7-30 days
  if (daysUntilExpiration <= 30) {
    return (
      <Badge
        className={`gap-1 bg-yellow-400 text-yellow-900 text-[10px] ${className}`}
        title={expiresAt ? `Expires: ${expiresAt}` : `Expires in ${daysUntilExpiration} days`}
      >
        <Clock className="h-3 w-3" aria-hidden="true" />
        {daysUntilExpiration} dias
      </Badge>
    )
  }

  // Safe: > 30 days
  return (
    <Badge
      variant="outline"
      className={`gap-1 text-[10px] text-green-600 border-green-200 ${className}`}
      title={expiresAt ? `Expires: ${expiresAt}` : `${daysUntilExpiration} days remaining`}
    >
      <Clock className="h-3 w-3" aria-hidden="true" />
      {daysUntilExpiration} dias
    </Badge>
  )
}
