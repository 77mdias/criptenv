"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface TOCItem {
  id: string
  title: string
  level: number
}

interface DocTOCProps {
  className?: string
}

function DocTOC({ className }: DocTOCProps) {
  const pathname = usePathname()
  const [activeId, setActiveId] = React.useState<string>("")
  const [headings, setHeadings] = React.useState<TOCItem[]>([])

  React.useEffect(() => {
    // Small delay to ensure DOM is updated after route change
    const timer = setTimeout(() => {
      const elements = document.querySelectorAll(
        ".docs-content h2, .docs-content h3"
      )

      const items: TOCItem[] = Array.from(elements).map((el) => ({
        id: el.id || el.textContent?.toLowerCase().replace(/\s+/g, "-") || "",
        title: el.textContent || "",
        level: parseInt(el.tagName.charAt(1)),
      }))

      // Set IDs on headings that don't have them
      elements.forEach((el) => {
        if (!el.id) {
          el.id = el.textContent?.toLowerCase().replace(/\s+/g, "-") || ""
        }
      })

      setHeadings(items)
      setActiveId("")

      // Intersection Observer for scroll spy
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries.filter((e) => e.isIntersecting)
          if (visible.length > 0) {
            setActiveId(visible[0].target.id)
          }
        },
        {
          rootMargin: "-80px 0px -60% 0px",
          threshold: 0,
        }
      )

      elements.forEach((el) => observer.observe(el))

      return () => observer.disconnect()
    }, 100)

    return () => clearTimeout(timer)
  }, [pathname])

  if (headings.length === 0) return null

  return (
    <aside
      className={cn(
        "w-[220px] flex-shrink-0",
        "hidden xl:block",
        "fixed right-[max(0px,calc(50%-700px))] top-[7rem] h-[calc(100vh-7rem)]",
        "py-6 pl-4 overflow-y-auto",
        className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
        Nesta página
      </p>
      <nav className="space-y-1 border-l border-[var(--border)] pb-16">
        {headings.map((heading) => (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            className={cn(
              "block text-xs leading-relaxed py-1 transition-colors",
              heading.level === 2 ? "pl-3" : "pl-6",
              activeId === heading.id
                ? "text-emerald-500 border-l-2 border-emerald-500 -ml-px font-medium"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            )}
          >
            {heading.title}
          </a>
        ))}
      </nav>
    </aside>
  )
}

export { DocTOC }
