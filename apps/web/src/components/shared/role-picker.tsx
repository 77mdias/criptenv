"use client"

import { useTranslations } from "next-intl"
import { Shield } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProjectRole } from "@/lib/project-permissions"

// Stable protocol values only — display labels come from the catalogue
// (`members.roles.<key>`), never from module scope. The array doubles as the
// runtime guard for template lookups (see audit-i18n-keys.mjs).
const roleKeys = ["owner", "admin", "developer", "viewer"] as const
type RoleKey = (typeof roleKeys)[number]

interface RolePickerProps {
  value: string
  options: readonly ProjectRole[]
  disabled?: boolean
  onChange: (role: ProjectRole) => void
}

export function RolePicker({ value, options, disabled = false, onChange }: RolePickerProps) {
  const t = useTranslations("members")

  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t("rolePicker.label")}>
      <Shield className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
      <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
        {options.map((role) => {
          const active = role === value
          return (
            <button
              key={role}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              className={cn(
                "h-8 rounded-md px-3 font-mono text-xs font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                active
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "text-[var(--text-tertiary)] hover:bg-[var(--background-subtle)] hover:text-[var(--text-primary)]",
                disabled && "cursor-not-allowed opacity-50 hover:bg-transparent"
              )}
              onClick={() => onChange(role)}
            >
              {roleKeys.includes(role as RoleKey) ? t(`roles.${role}`) : t("roles.viewer")}
            </button>
          )
        })}
      </div>
    </div>
  )
}
