import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware replacements for `next/link` and `next/navigation`.
 *
 * Importing the raw `next/navigation` hooks in a prefixed app silently drops
 * the locale (e.g. `router.push("/login")` sends an English user back to the
 * default locale), so every navigation import must come from here.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
