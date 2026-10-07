"use client"

import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { Check, Globe } from "lucide-react"

import { Button } from "@/components/ui/button"
import { usePathname, useRouter } from "@/i18n/navigation"
import { LOCALE_LABELS, routing, type Locale } from "@/i18n/routing"

/**
 * Switches locale by navigating to the same route under a different prefix.
 *
 * next-intl's `usePathname` strips the locale segment, and `router.replace` with
 * a `locale` option re-applies the correct `as-needed` prefix and syncs the
 * NEXT_LOCALE cookie, so the choice survives later unprefixed navigations.
 */
export function LocaleSwitcher() {
  const t = useTranslations("common.localeSwitcher")
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const onSelect = (next: Locale) => {
    if (next === locale) return
    const query = searchParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { locale: next })
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("aria")}>
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-40 overflow-hidden rounded-lg border border-(--border) bg-(--surface-elevated) p-1 shadow-xl shadow-black/20"
        >
          <DropdownMenu.Label className="px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-(--text-tertiary)">
            {t("label")}
          </DropdownMenu.Label>
          {routing.locales.map((option) => (
            <DropdownMenu.Item
              key={option}
              onSelect={() => onSelect(option)}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-(--text-secondary) outline-none transition-colors data-[highlighted]:bg-(--background-subtle) data-[highlighted]:text-(--text-primary)"
            >
              <span>{LOCALE_LABELS[option]}</span>
              {option === locale && <Check className="h-3.5 w-3.5 text-(--accent)" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
