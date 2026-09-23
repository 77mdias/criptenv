import { defineRouting } from "next-intl/routing";

/**
 * Locale routing for CriptEnv.
 *
 * `as-needed` keeps the default locale (pt-BR) unprefixed so the published
 * URLs — indexed docs and the LGPD legal pages already linked from emails,
 * signup and the footer — keep their SEO equity. en/es get a prefix.
 */
export const routing = defineRouting({
  locales: ["pt-BR", "en", "es"],
  defaultLocale: "pt-BR",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  "pt-BR": "Português",
  en: "English",
  es: "Español",
};
