"use client"

import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

// Radix refuses "" as an item value; a native select uses it for "none"/"all".
const EMPTY = "__empty__"
const toRadix = (value: string) => value || EMPTY

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

/**
 * Themed stand-in for a native `<select>`, whose option list the browser draws
 * in its own colours. Same contract: string values, "" allowed, and a value
 * missing from the options shows the first one.
 */
export function Select({ id, value, onValueChange, options, disabled, className, ...aria }: SelectProps) {
  const shown = options.some((option) => option.value === value) ? value : (options[0]?.value ?? "")
  return (
    <SelectPrimitive.Root
      value={toRadix(shown)}
      onValueChange={(next) => onValueChange(next === EMPTY ? "" : next)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-left text-base md:text-sm text-[var(--text-primary)] transition-colors",
          "hover:border-[var(--text-muted)] data-[state=open]:border-[var(--text-muted)]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...aria}
      >
        <span className="min-w-0 truncate">
          <SelectPrimitive.Value />
        </span>
        <SelectPrimitive.Icon>
          <ChevronDown aria-hidden className="h-4 w-4 text-[var(--text-muted)]" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        {/* z-[90]: above dialogs (80/81), where most selects live. */}
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-[90] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] shadow-xl shadow-black/20"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={toRadix(option.value)}
                className="relative flex cursor-pointer select-none items-center rounded-md py-2.5 pl-3 pr-9 text-sm text-[var(--text-secondary)] outline-none transition-colors data-[highlighted]:bg-[var(--background-subtle)] data-[highlighted]:text-[var(--text-primary)] data-[state=checked]:text-[var(--text-primary)]"
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-3">
                  <Check aria-hidden className="h-4 w-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
