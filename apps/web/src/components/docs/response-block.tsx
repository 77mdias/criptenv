import * as React from "react"
import { cn } from "@/lib/utils"

interface ResponseBlockProps {
  status: number
  statusText?: string
  children: React.ReactNode
  className?: string
}

function ResponseBlock({ status, statusText, children, className }: ResponseBlockProps) {
  const isSuccess = status >= 200 && status < 300
  const isError = status >= 400

  return (
    <div className={cn("my-4 rounded-lg border border-[var(--border)] overflow-hidden", className)}>
      <div className={cn(
        "flex items-center gap-2 px-4 py-2 border-b border-[var(--border)]",
        isSuccess && "bg-emerald-500/10",
        isError && "bg-red-500/10",
        !isSuccess && !isError && "bg-[var(--background-muted)]"
      )}>
        <span className={cn(
          "text-sm font-bold font-mono",
          isSuccess && "text-emerald-500",
          isError && "text-red-500",
          !isSuccess && !isError && "text-[var(--text-secondary)]"
        )}>
          {status}
        </span>
        {statusText && (
          <span className="text-sm text-[var(--text-tertiary)]">{statusText}</span>
        )}
      </div>
      <div className="p-4 bg-[var(--background-subtle)]">
        {children}
      </div>
    </div>
  )
}

export { ResponseBlock }
