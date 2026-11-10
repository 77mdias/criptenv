const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

/** Prices are always in BRL, whatever the locale of the page. */
export function brl(value: string | number): string {
  return BRL.format(Number(value))
}

export function day(iso: string | null, locale: string): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" })
}
