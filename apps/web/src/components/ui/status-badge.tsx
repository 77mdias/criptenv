import * as React from "react"
import { cn } from "@/lib/utils"

type Status = "online" | "pending" | "offline" | "stale" | "synced"

interface StatusBadgeProps {
  status: Status
  label: string
  className?: string
  animate?: boolean
}

const statusStyles: Record<Status, { bg: string; text: string; border: string; dot: string }> = {
  online: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", dot: "bg-green-500" },
  pending: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  offline: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" },
  stale: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", dot: "bg-yellow-500" },
  synced: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100", dot: "bg-blue-500" },
}

function StatusBadge({ status, label, className, animate = true }: StatusBadgeProps) {
  const style = statusStyles[status]
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono",
        style.bg,
        style.text,
        style.border,
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        {animate && status === "online" && (
          <span
            className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              style.dot
            )}
          />
        )}
        <span className={cn("relative inline-flex rounded-full h-2 w-2", style.dot)} />
      </span>
      {label}
    </div>
  )
}

export { StatusBadge }
