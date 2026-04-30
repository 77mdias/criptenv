"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  success?: string
  helperText?: string
  icon?: React.ElementType
  suffix?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, success, helperText, icon: Icon, suffix, id, ...props }, ref) => {
    const inputId = id || React.useId()
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          )}
          <input
            type={type}
            id={inputId}
            className={cn(
              "flex h-10 w-full rounded-lg border bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--background-subtle)]",
              Icon && "pl-10",
              suffix && "pr-10",
              error
                ? "border-red-500 focus:ring-red-500"
                : success
                ? "border-green-500 focus:ring-green-500"
                : "border-[var(--border)]",
              className
            )}
            ref={ref}
            {...props}
          />
          {suffix && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</div>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {success && <p className="text-xs text-green-700">{success}</p>}
        {helperText && !error && !success && (
          <p className="text-xs text-[var(--text-muted)]">{helperText}</p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
