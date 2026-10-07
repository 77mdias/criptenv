import createMiddleware from "next-intl/middleware"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { routing, type Locale } from "@/i18n/routing"

/**
 * Locale resolution runs first, then the pre-existing auth guard.
 *
 * Order matters: next-intl must decide the locale (NEXT_LOCALE cookie →
 * Accept-Language → defaultLocale) and settle the URL before we evaluate auth,
 * otherwise a prefixed path like `/en/dashboard` would never match the
 * unprefixed protected-route list.
 */
const handleI18n = createMiddleware(routing)

// Routes that require authentication (locale-agnostic; prefix is stripped first)
const protectedRoutes = ["/dashboard", "/projects"]

// Routes that are always public
const publicRoutes = ["/", "/login", "/signup", "/forgot-password"]

/** `/en/dashboard` → `/dashboard`; `/dashboard` → `/dashboard`. */
function stripLocalePrefix(pathname: string): string {
  const [, first, ...rest] = pathname.split("/")
  if (first && routing.locales.includes(first as Locale)) {
    return `/${rest.join("/")}`
  }
  return pathname
}

/**
 * Prefix to re-apply when redirecting. With `as-needed` the default locale has
 * no prefix, so redirecting an `/en/...` visitor to a bare `/login` would
 * silently switch them to Portuguese.
 */
function localePrefixFor(pathname: string): string {
  const [, first] = pathname.split("/")
  if (
    first &&
    first !== routing.defaultLocale &&
    routing.locales.includes(first as Locale)
  ) {
    return `/${first}`
  }
  return ""
}

function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

function isPublicRoute(pathname: string): boolean {
  // API routes are always public (they handle their own auth)
  if (pathname.startsWith("/api/")) return true
  return publicRoutes.some((route) => pathname === route)
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static files and internal Next.js routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.\w+$/) // files with extensions (e.g. .js, .css, .png)
  ) {
    return NextResponse.next()
  }

  const i18nResponse = handleI18n(request)

  // next-intl wants to redirect (e.g. locale prefix missing/mismatched, or
  // detected language differs). Honour it before the auth guard runs.
  if (i18nResponse.headers.get("location")) {
    return i18nResponse
  }

  const bare = stripLocalePrefix(pathname)

  // Public routes pass through (keeping next-intl's rewrite/cookies)
  if (isPublicRoute(bare)) {
    return i18nResponse
  }

  // Protected routes: check for session cookie
  if (isProtectedRoute(bare)) {
    const token = request.cookies.get("session_token")?.value

    if (!token) {
      const loginUrl = new URL(`${localePrefixFor(pathname)}/login`, request.url)
      loginUrl.searchParams.set("redirect", pathname)
      const redirect = NextResponse.redirect(loginUrl)

      // Preserve any cookie next-intl set on this request (e.g. NEXT_LOCALE)
      for (const cookie of i18nResponse.cookies.getAll()) {
        redirect.cookies.set(cookie)
      }

      return redirect
    }
  }

  return i18nResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (backend proxy / route handlers)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
}
