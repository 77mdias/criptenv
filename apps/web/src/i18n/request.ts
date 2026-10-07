import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { loadMessages } from "./messages";

/**
 * vinext auto-detects next-intl from this file (`i18n/request.ts` or
 * `src/i18n/request.ts`) and registers the `next-intl/config` alias itself —
 * do NOT wrap next.config.ts with `createNextIntlPlugin()`, it crashes under
 * vinext because it requires `next/package.json`.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
