"use client"

import type { Environment } from "@/lib/api"
import { cn } from "@/lib/utils"

interface EnvSelectorProps {
  environments: Environment[]
  activeEnvironmentId: string | null
  secretCounts?: Record<string, number>
  onSelect: (environment: Environment) => void
}

export function EnvSelector({
  environments,
  activeEnvironmentId,
  secretCounts = {},
  onSelect,
}: EnvSelectorProps) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)]" role="tablist">
      {environments.map((environment) => {
        const active = environment.id === activeEnvironmentId
        const label = environment.display_name || environment.name

        return (
          <button
            key={environment.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(environment)}
            className={cn(
              "min-h-10 shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-[var(--accent)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            {label}
            <span className="ml-2 font-mono text-xs text-[var(--text-muted)]">
              {secretCounts[environment.id] ?? environment.secrets_count ?? 0}
            </span>
          </button>
        )
      })}
    </div>
  )
}
