import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const endpointBadgeVariants = cva(
  "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono uppercase tracking-wide",
  {
    variants: {
      method: {
        GET: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/20",
        POST: "bg-blue-500/15 text-blue-500 border border-blue-500/20",
        PUT: "bg-amber-500/15 text-amber-500 border border-amber-500/20",
        PATCH: "bg-amber-500/15 text-amber-500 border border-amber-500/20",
        DELETE: "bg-red-500/15 text-red-500 border border-red-500/20",
        CLI: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/20",
      },
    },
  }
)

interface EndpointBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof endpointBadgeVariants> {}

function EndpointBadge({ method, className, children, ...props }: EndpointBadgeProps) {
  return (
    <span className={cn(endpointBadgeVariants({ method }), className)} {...props}>
      {children || method}
    </span>
  )
}

export { EndpointBadge }
