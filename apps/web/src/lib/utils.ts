import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string, locale = "pt-BR"): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date))
}

export function formatRelativeTime(
  date: Date | string,
  locale = "pt-BR",
  now: Date = new Date(),
): string {
  // Negative = past ("2 hours ago"), positive = future ("in 3 days")
  const seconds = Math.trunc((new Date(date).getTime() - now.getTime()) / 1000)
  const abs = Math.abs(seconds)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

  if (abs < 60) return rtf.format(0, "second")
  if (abs < 3600) return rtf.format(Math.trunc(seconds / 60), "minute")
  if (abs < 86400) return rtf.format(Math.trunc(seconds / 3600), "hour")
  if (abs <= 30 * 86400) return rtf.format(Math.trunc(seconds / 86400), "day")
  return formatDate(date, locale)
}

export function maskSecret(value: string): string {
  if (value.length <= 8) return "••••••••"
  return value.slice(0, 3) + "••••••••" + value.slice(-3)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
}
