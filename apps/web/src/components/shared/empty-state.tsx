"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon?: React.ElementType
  title: string
  description?: string
  /** CLI command that does the same thing, shown with a copy button */
  command?: string
  action?: {
    label: string
    onClick: () => void
    icon?: React.ElementType
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
}

function CommandLine({ command }: { command: string }) {
  const t = useTranslations("common.codeBlock")
  const [copied, setCopied] = React.useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(command)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="mb-6 flex max-w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background-subtle)] py-1.5 pl-3 pr-1.5">
      <code className="min-w-0 truncate font-mono text-xs text-[var(--text-secondary)]">{command}</code>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 px-2"
        onClick={copy}
        aria-label={copied ? t("copied") : t("copyCommand")}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
  command,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--background-muted)]">
          <Icon className="h-8 w-8 text-[var(--text-muted)]" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--text-tertiary)] max-w-sm mb-6 font-mono">
          {description}
        </p>
      )}
      {command && <CommandLine command={command} />}
      <div className="flex gap-3">
        {action && (
          <Button onClick={action.onClick} icon={action.icon}>
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button variant="secondary" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  )
}

export { EmptyState }
