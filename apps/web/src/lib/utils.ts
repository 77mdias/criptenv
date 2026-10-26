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
  const seconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

  if (seconds < 60) return rtf.format(0, "second")
  if (minutes < 60) return rtf.format(-minutes, "minute")
  if (hours < 24) return rtf.format(-hours, "hour")
  if (days <= 30) return rtf.format(-days, "day")
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
