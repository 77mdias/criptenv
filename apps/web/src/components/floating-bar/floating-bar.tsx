"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
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
  { href: "/docs", label: "Docs", icon: BookOpen },
];

function getSectionId(href: string) {
  return href.replace("#", "");
}

function isAnchorLink(href: string) {
  return href.startsWith("#");
}

export function FloatingBar() {
  const pathname = usePathname();
  const isDocsPath = pathname.startsWith("/docs");
  const [activeSection, setActiveSection] = useState(
    navItems[0]?.href ?? "#hero",
  );
  const currentActiveItem = isDocsPath ? "/docs" : activeSection;

  const syncActiveSection = useCallback(() => {
    const sections = navItems
      .filter((item) => isAnchorLink(item.href))
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
    if (isDocsPath) {
      return;
    }

    const retryTimers = new Set<ReturnType<typeof window.setTimeout>>();

    const scrollToCurrentHash = (attempt = 0) => {
      const hash = window.location.hash;
      if (!isAnchorLink(hash)) {
        return;
      }

      const target = document.getElementById(getSectionId(hash));
      if (!target) {
        if (attempt < 12) {
          const timerId = window.setTimeout(() => {
            retryTimers.delete(timerId);
            scrollToCurrentHash(attempt + 1);
          }, 50);
          retryTimers.add(timerId);
        }
        return;
      }

      target.scrollIntoView({ behavior: "auto", block: "start" });
      setActiveSection(hash);
    };

    window.addEventListener("scroll", syncActiveSection, { passive: true });
    window.addEventListener("hashchange", scrollToCurrentHash);

    const frameId = window.requestAnimationFrame(() => {
      scrollToCurrentHash();
      syncActiveSection();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", syncActiveSection);
      window.removeEventListener("hashchange", scrollToCurrentHash);
      retryTimers.forEach((timerId) => window.clearTimeout(timerId));
      retryTimers.clear();
    };
  }, [isDocsPath, syncActiveSection]);

  const handleClick = (href: string) => {
    const target = document.getElementById(getSectionId(href));

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(href);
      return;
    }

    window.location.assign(`/${href}`);
  };

  return (
    <aside className="fixed left-6 top-1/2 z-40 hidden -translate-y-1/2 lg:block">
      <nav className="flex flex-col items-center gap-2 rounded-full border border-(--border) bg-(--surface-elevated) p-2 shadow-lg backdrop-blur-sm">
        {navItems.map((item) => {
          const isActive = currentActiveItem === item.href;
          const itemClassName = cn(
            "group relative grid h-10 w-10 place-items-center rounded-full transition-colors",
            isActive
              ? "bg-(--accent) text-(--accent-foreground)"
              : "text-(--text-muted) hover:bg-(--background-subtle) hover:text-(--text-primary)",
          );

          if (!isAnchorLink(item.href)) {
            return (
              <Fragment key={item.href}>
                <span
                  aria-hidden="true"
                  className="my-1 h-px w-6 bg-[var(--border)]"
                />
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  className={itemClassName}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="pointer-events-none absolute left-12 whitespace-nowrap rounded-md bg-(--text-primary) px-2 py-1 text-xs text-(--background) opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                    {item.label}
                  </span>
                </Link>
              </Fragment>
            );
          }

          return (
            <button
              key={item.href}
              type="button"
              onClick={() => handleClick(item.href)}
              aria-label={item.label}
              aria-current={isActive ? "true" : undefined}
              className={itemClassName}
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
