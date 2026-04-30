"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Home,
  Layers,
  Cpu,
  Shield,
  CreditCard,
  Rocket,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  icon: LucideIcon
  label: string
  href: string
}

const navItems: NavItem[] = [
  { icon: Home, label: "Home", href: "#hero" },
  { icon: Layers, label: "Features", href: "#features" },
  { icon: Cpu, label: "How It Works", href: "#how-it-works" },
  { icon: Shield, label: "Security", href: "#security" },
  { icon: CreditCard, label: "Pricing", href: "#pricing" },
  { icon: Rocket, label: "Get Started", href: "#cta" },
]

function MarketingSidebar() {
  const [activeSection, setActiveSection] = useState("#hero")

  const handleScroll = useCallback(() => {
    const sections = navItems
      .map((item) => {
        const id = item.href.replace("#", "")
        const el = document.getElementById(id)
        if (!el) return null
        const rect = el.getBoundingClientRect()
        return { href: item.href, top: rect.top }
      })
      .filter(Boolean) as { href: string; top: number }[]

    const current = sections.reduce((closest, section) => {
      if (section.top <= 200) return section
      return closest
    }, sections[0])

    if (current) setActiveSection(current.href)
  }, [])

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true })
    const frameId = window.requestAnimationFrame(handleScroll)
    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener("scroll", handleScroll)
    }
  }, [handleScroll])

  const handleClick = (href: string) => {
    const id = href.replace("#", "")
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col fixed left-5 top-1/2 -translate-y-1/2 z-50",
        "bg-transparent",
        "py-3.5 px-3",
      )}
    >
      <nav className="flex flex-col items-start gap-2.5">
        {navItems.map((item) => {
          const isActive = activeSection === item.href
          return (
            <button
              key={item.href}
              onClick={() => handleClick(item.href)}
              className={cn(
                "group relative flex items-center gap-1 rounded-full px-3 py-2",
                "transition-all duration-200 outline-none",
                // ALL items get the dark pill on the label
                // Active = white icon, Inactive = gray icon
                "bg-[var(--accent)] text-[var(--accent-foreground)]"
              )}
              aria-label={item.label}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors duration-200",
                  isActive
                    ? "text-[var(--accent-foreground)]"
                    : "text-[var(--text-muted)] dark:text-[rgba(232,230,227,0.55)]"
                )}
              />
              <span className="text-sm font-medium whitespace-nowrap dark:text-[var(--text-primary)]">
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

export { MarketingSidebar }
