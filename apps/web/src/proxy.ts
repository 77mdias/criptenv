import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Routes that require authentication
const protectedRoutes = ["/dashboard", "/projects"]

// Routes that are always public
const publicRoutes = ["/", "/login", "/signup", "/forgot-password"]

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

  // Skip proxy for static files and internal Next.js routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.\w+$/) // files with extensions (e.g. .js, .css, .png)
  ) {
    return NextResponse.next()
  }

  // Public routes pass through
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // Protected routes: check for session cookie
  if (isProtectedRoute(pathname)) {
    const token = request.cookies.get("session_token")?.value

    if (!token) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
