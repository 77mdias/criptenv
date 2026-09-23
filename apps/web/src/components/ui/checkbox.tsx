"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Rich label content rendered next to the checkbox (supports links).
   * Interactive descendants (e.g. anchors) do not toggle the input per spec.
   */
  children: React.ReactNode
  error?: string
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, id, error, children, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id || generatedId
    return (
      <div className="space-y-1.5">
        <div className="flex items-start gap-2.5">
          <input
            type="checkbox"
            id={inputId}
            ref={ref}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-[var(--accent)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error && "outline outline-1 outline-red-500",
              className
            )}
            {...props}
          />
          <label
            htmlFor={inputId}
            className="cursor-pointer select-none text-sm leading-5 text-[var(--text-secondary)]"
          >
            {children}
          </label>
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
