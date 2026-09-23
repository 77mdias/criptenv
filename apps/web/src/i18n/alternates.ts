import { getPathname } from "./navigation";
import { routing, type Locale } from "./routing";

/** Open Graph wants `pt_BR`-style tags, not `pt-BR`. */
export const OG_LOCALES: Record<Locale, string> = {
  "pt-BR": "pt_BR",
  en: "en_US",
  es: "es_ES",
};

/**
 * Build canonical + hreflang alternates for a route.
 *
 * Because `localePrefix` is `as-needed`, the default locale resolves to the
 * unprefixed path (`/login`) while en/es resolve to `/en/login`, `/es/login`.
 * `getPathname` applies exactly that rule, so the tags stay correct if the
 * prefix strategy ever changes.
 */
export function buildAlternates(href: string) {
  const languages: Record<string, string> = {};

  for (const locale of routing.locales) {
    languages[locale] = getPathname({ href, locale });
  }

  const canonical = getPathname({ href, locale: routing.defaultLocale });
  languages["x-default"] = canonical;

  return { canonical, languages };
}
