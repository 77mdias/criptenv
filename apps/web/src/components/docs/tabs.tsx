"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TabProps {
  value: string
  label?: string
  children: React.ReactNode
}

function Tab({ children }: TabProps) {
  return <>{children}</>
}

interface TabsProps {
  items?: string[]
  defaultValue?: string
  children: React.ReactNode
  defaultIndex?: number
  className?: string
}

function Tabs({ items, defaultValue, children, defaultIndex = 0, className }: TabsProps) {
  const tabs = React.Children.toArray(children).filter(
    (child) => React.isValidElement(child) && child.type === Tab
  )

  // Derive labels from items prop or from Tab label props
  const labels = items || tabs.map((tab) => {
    const props = tab.props as TabProps
    return props.label || props.value || ""
  })

  // Determine initial active index
  const initialIndex = defaultValue
    ? labels.indexOf(defaultValue)
    : defaultIndex

  const [activeIndex, setActiveIndex] = React.useState(
    initialIndex >= 0 ? initialIndex : 0
  )

  return (
    <div className={cn("my-4 rounded-lg border border-[var(--border)] overflow-hidden", className)}>
      {/* Tab headers */}
      <div className="flex border-b border-[var(--border)] bg-[var(--background-muted)] overflow-x-auto">
        {labels.map((item, index) => (
          <button
            key={item}
            onClick={() => setActiveIndex(index)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors relative",
              activeIndex === index
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            )}
          >
            {item}
            {activeIndex === index && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4 bg-[var(--background-subtle)]">
        {tabs[activeIndex]}
      </div>
    </div>
  )
}

export { Tabs, Tab }
