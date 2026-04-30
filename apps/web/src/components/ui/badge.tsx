import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium font-mono border transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[var(--background-muted)] text-[var(--text-secondary)] border-[var(--border)]",
        design: "bg-blue-50 text-blue-600 border-blue-100",
        dev: "bg-purple-50 text-purple-600 border-purple-100",
        brand: "bg-emerald-50 text-emerald-600 border-emerald-100",
        success: "bg-green-50 text-green-700 border-green-200",
        warning: "bg-amber-50 text-amber-700 border-amber-200",
        danger: "bg-red-50 text-red-700 border-red-200",
        info: "bg-blue-50 text-blue-700 border-blue-100",
        outline: "bg-transparent text-[var(--text-secondary)] border-[var(--border)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
