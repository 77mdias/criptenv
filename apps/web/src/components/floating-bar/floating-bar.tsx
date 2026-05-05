"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Home,
  Layers,
  Cpu,
  Shield,
  CreditCard,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { href: "#hero", label: "Home", icon: Home },
  { href: "#features", label: "Features", icon: Layers },
  { href: "#how-it-works", label: "How It Works", icon: Cpu },
  { href: "#security", label: "Security", icon: Shield },
  { href: "#pricing", label: "Pricing", icon: CreditCard },
  { href: "#cta", label: "Get Started", icon: Rocket },
];

function getSectionId(href: string) {
  return href.replace("#", "");
}

export function FloatingBar() {
  const [activeSection, setActiveSection] = useState(
    navItems[0]?.href ?? "#hero",
  );

  const syncActiveSection = useCallback(() => {
    const sections = navItems
      .map((item) => {
        const element = document.getElementById(getSectionId(item.href));
        if (!element) {
          return null;
        }

        return {
          href: item.href,
          top: element.getBoundingClientRect().top,
        };
      })
      .filter(
        (section): section is { href: string; top: number } => section !== null,
      );

    const currentSection = sections.reduce<{
      href: string;
      top: number;
    } | null>((closest, section) => {
      if (section.top <= 180) {
        return section;
      }

      return closest;
    }, sections[0] ?? null);

    if (currentSection) {
      setActiveSection(currentSection.href);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", syncActiveSection, { passive: true });

    const frameId = window.requestAnimationFrame(syncActiveSection);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", syncActiveSection);
    };
  }, [syncActiveSection]);

  const handleClick = (href: string) => {
    const target = document.getElementById(getSectionId(href));

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(href);
    }
  };

  return (
    <aside className="fixed left-6 top-1/2 z-40 hidden -translate-y-1/2 lg:block">
      <nav className="flex flex-col items-center gap-2 rounded-full border border-(--border) bg-(--surface-elevated) p-2 shadow-lg backdrop-blur-sm">
        {navItems.map((item) => {
          const isActive = activeSection === item.href;

          return (
            <button
              key={item.href}
              type="button"
              onClick={() => handleClick(item.href)}
              aria-label={item.label}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "group relative grid h-10 w-10 place-items-center rounded-full transition-colors",
                isActive
                  ? "bg-(--accent) text-(--accent-foreground)"
                  : "text-(--text-muted) hover:bg-(--background-subtle) hover:text-(--text-primary)",
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="pointer-events-none absolute left-12 whitespace-nowrap rounded-md bg-(--text-primary) px-2 py-1 text-xs text-(--background) opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
