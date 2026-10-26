import type { Locale } from "./routing";

/** Open Graph wants `pt_BR`-style tags, not `pt-BR`. */
export const OG_LOCALES: Record<Locale, string> = {
  "pt-BR": "pt_BR",
  en: "en_US",
  es: "es_ES",
};
