import * as React from "react"
import { cn } from "@/lib/utils"

interface StepProps {
  title: string
  children: React.ReactNode
}

function Step({ title, children }: StepProps) {
  return (
    <div className="relative pl-10 pb-8 last:pb-0">
      {/* Vertical line */}
      <div className="absolute left-[15px] top-8 bottom-0 w-px bg-[var(--border)] last:hidden" />

      {/* Step number circle */}
      <div className="absolute left-0 top-0 flex items-center justify-center w-[31px] h-[31px] rounded-full bg-[var(--background-muted)] border border-[var(--border)] text-sm font-bold font-mono text-[var(--text-secondary)]">
        {/* Number injected by parent */}
      </div>

      <div>
        <h4 className="font-semibold text-[var(--text-primary)] mb-2">{title}</h4>
        <div className="text-sm text-[var(--text-secondary)] leading-relaxed [&>p]:mb-2">
          {children}
        </div>
      </div>
    </div>
  )
}

interface StepsProps {
  children: React.ReactNode
  className?: string
}

function Steps({ children, className }: StepsProps) {
  const steps = React.Children.toArray(children)

  return (
    <div className={cn("my-6", className)}>
      {steps.map((step, index) => {
        if (!React.isValidElement(step)) return step
        return (
          <div key={index} className="relative pl-10 pb-8 last:pb-0">
            {/* Vertical line */}
            <div className="absolute left-[15px] top-8 bottom-0 w-px bg-[var(--border)] last:hidden" />

            {/* Step number circle */}
            <div className="absolute left-0 top-0 flex items-center justify-center w-[31px] h-[31px] rounded-full bg-[var(--background-muted)] border border-[var(--border)] text-sm font-bold font-mono text-[var(--text-secondary)]">
              {index + 1}
            </div>

            <div>
              <h4 className="font-semibold text-[var(--text-primary)] mb-2">
                {(step.props as StepProps).title}
              </h4>
              <div className="text-sm text-[var(--text-secondary)] leading-relaxed [&>p]:mb-2">
                {(step.props as StepProps).children}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export { Steps, Step }
