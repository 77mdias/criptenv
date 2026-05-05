import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { AlertCircle, AlertTriangle, Info, Lightbulb, ShieldAlert } from "lucide-react"

const calloutVariants = cva(
  "relative my-4 rounded-lg border-l-4 p-4 text-sm leading-relaxed",
  {
    variants: {
      variant: {
        info: "border-l-blue-500 bg-blue-500/5 text-[var(--text-primary)]",
        tip: "border-l-emerald-500 bg-emerald-500/5 text-[var(--text-primary)]",
        warning: "border-l-amber-500 bg-amber-500/5 text-[var(--text-primary)]",
        danger: "border-l-red-500 bg-red-500/5 text-[var(--text-primary)]",
        note: "border-l-[var(--text-tertiary)] bg-[var(--background-muted)] text-[var(--text-primary)]",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
)

const icons = {
  info: Info,
  tip: Lightbulb,
  warning: AlertTriangle,
  danger: ShieldAlert,
  note: AlertCircle,
}

const labels = {
  info: "Info",
  tip: "Dica",
  warning: "Atenção",
  danger: "Perigo",
  note: "Nota",
}

interface CalloutProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof calloutVariants> {
  title?: string
}

function Callout({ variant = "info", title, children, className, ...props }: CalloutProps) {
  const Icon = icons[variant || "info"]
  const label = labels[variant || "info"]

  return (
    <div className={cn(calloutVariants({ variant }), className)} {...props}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-0.5 flex-shrink-0 opacity-80" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold mb-1">{title || label}</p>
          <div className="[&>p]:mb-0 [&>p]:leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  )
}

export { Callout }
