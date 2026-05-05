"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/layout/brand";
import { ThemeSwitch } from "@/components/ui/theme-switch";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Security", href: "#security" },
  { label: "Pricing", href: "#pricing" },
];

interface MarketingHeaderProps {
  className?: string;
}

function MarketingHeader({ className }: MarketingHeaderProps) {
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    if (currentScrollY < 10) {
      setVisible(true);
    } else if (currentScrollY > lastScrollY) {
      setVisible(false);
    } else {
      setVisible(true);
    }
    setLastScrollY(currentScrollY);
  }, [lastScrollY]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-40 w-full transition-transform duration-300",
          visible ? "translate-y-0" : "-translate-y-full",
          "bg-(--background)/80 backdrop-blur-md",
          "border-b border-(--border)",
          className,
        )}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-3 sm:px-4 lg:px-6">
          <Brand compact className="-ml-1 sm:ml-0" />

          {/* Center nav — hidden on mobile, visible on desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 text-sm text-(--text-tertiary) hover:text-(--text-primary) transition-colors rounded-md hover:bg-(--background-subtle)"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-0.5 sm:gap-2">
            <div className="scale-90 sm:scale-100">
              <ThemeSwitch />
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Entrar
                </Button>
              </Link>
              <Link href="/signup">
                <Button
                  size="sm"
                  className="bg-(--accent) text-(--accent-foreground) hover:bg-(--accent-hover)"
                >
                  Começar
                </Button>
              </Link>
            </div>
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile menu drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed top-0 right-0 z-50 h-screen w-70 flex-col border-l border-(--border) bg-(--background) transition-transform duration-300 ease-out motion-reduce:transform-none motion-reduce:transition-none md:hidden",
          mobileOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-(--border)">
          <span className="font-semibold text-(--text-primary)">Menu</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 flex flex-col gap-1 p-3 pt-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="px-3 py-3 text-sm font-medium text-(--text-tertiary) hover:text-(--text-primary) transition-colors rounded-md hover:bg-(--background-subtle)"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-(--border) flex flex-col gap-2">
          <Link href="/login" className="w-full">
            <Button variant="ghost" className="w-full justify-center">
              Entrar
            </Button>
          </Link>
          <Link href="/signup" className="w-full">
            <Button className="w-full justify-center bg-(--accent) text-(--accent-foreground) hover:bg-(--accent-hover)">
              Começar
            </Button>
          </Link>
        </div>
      </aside>
    </>
  );
}

export { MarketingHeader };
