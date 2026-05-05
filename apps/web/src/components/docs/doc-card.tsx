import * as React from "react"
import { cn } from "@/lib/utils"
import { ArrowRight, type LucideIcon } from "lucide-react"

interface DocCardProps {
  title: string
  description?: string
  icon?: LucideIcon
  href?: string
  className?: string
}

function DocCard({ title, description, icon: Icon, href, className }: DocCardProps) {
  const Component = href ? "a" : "div"

  return (
    <Component
      href={href}
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border border-[var(--border)] p-5",
        "bg-[var(--surface-elevated,var(--background-subtle))]",
        "transition-all duration-200 ease-out",
        "hover:border-[var(--text-muted)] hover:shadow-md hover:-translate-y-0.5",
        href && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between">
        {Icon && (
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-500">
            <Icon className="h-5 w-5" />
          </div>
        )}
        {href && (
          <ArrowRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-transform" />
        )}
      </div>

      <div>
        <h3 className="font-semibold text-[var(--text-primary)] text-sm mb-1 group-hover:text-emerald-500 transition-colors">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </Component>
  )
}

interface CardGridProps {
  cols?: 2 | 3 | 4
  children: React.ReactNode
  className?: string
}

function CardGrid({ cols = 3, children, className }: CardGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4 my-6",
        cols === 2 && "grid-cols-1 sm:grid-cols-2",
        cols === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        cols === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  )
}

export { DocCard, CardGrid }
