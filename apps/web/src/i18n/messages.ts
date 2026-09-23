import type { Locale } from "./routing";

/**
 * Catalogues are split by namespace instead of one large JSON per locale.
 * Keeping them separate limits merge conflicts and lets routes ship only the
 * namespaces they need to the client (see `loadMessages` consumers).
 *
 * Grows as each surface is migrated: dashboard, docs, legal.
 */
export const NAMESPACES = ["common", "auth", "marketing"] as const;

export type Namespace = (typeof NAMESPACES)[number];

export type Messages = Record<string, unknown>;

export async function loadMessages(locale: Locale): Promise<Messages> {
  const entries = await Promise.all(
    NAMESPACES.map(
      async (ns) =>
        [
          ns,
          (await import(`../../messages/${locale}/${ns}.json`)).default,
        ] as const,
    ),
  );

  return Object.fromEntries(entries);
}

/**
 * Same as `loadMessages` but only for the given namespaces.
 *
 * `NextIntlClientProvider` serialises every message it receives into the client
 * payload. Passing the full catalogue on every route would bloat the Worker
 * bundle, so routes should pass exactly what their client components read.
 */
export async function loadNamespaceMessages(
  locale: Locale,
  namespaces: readonly Namespace[],
): Promise<Messages> {
  const entries = await Promise.all(
    namespaces.map(
      async (ns) =>
        [
          ns,
          (await import(`../../messages/${locale}/${ns}.json`)).default,
        ] as const,
    ),
  );

  return Object.fromEntries(entries);
}
