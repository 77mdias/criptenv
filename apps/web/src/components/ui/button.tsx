"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        primary: "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] focus-visible:ring-[var(--accent)]",
        secondary: "border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--background-subtle)] focus-visible:ring-[var(--text-primary)]",
        ghost: "text-[var(--text-primary)] hover:bg-[var(--background-subtle)]",
        danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600",
        pill: "bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-full shadow-sm hover:shadow-md hover:bg-[var(--background-subtle)]",
      },
      size: {
        sm: "h-8 px-4 py-2 text-xs",
        md: "h-10 px-6 py-3",
        lg: "h-12 px-8 py-4 rounded-full",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  icon?: React.ElementType
  iconPosition?: "left" | "right"
  fullWidth?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      icon: Icon,
      iconPosition = "left",
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"

    // When asChild is true, we must pass exactly one child to Slot.
    // Radix Slot uses React.Children.only which rejects arrays/fragments.
    if (asChild) {
      return (
        <Slot
          className={cn(
            buttonVariants({ variant, size }),
            fullWidth && "w-full",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      )
    }

    return (
      <button
        className={cn(
          buttonVariants({ variant, size }),
          fullWidth && "w-full",
          className
        )}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          Icon && iconPosition === "left" && <Icon className="h-4 w-4" />
        )}
        {children}
        {!loading && Icon && iconPosition === "right" && <Icon className="h-4 w-4" />}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
