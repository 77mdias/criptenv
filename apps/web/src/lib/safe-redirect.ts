/**
 * Post-login navigation helpers.
 *
 * Auth pages accept a destination from the query string (`?next=` on the 2FA
 * page, `?redirect=` on the login page). Passing that value straight to
 * `router.push` turns the page into an open redirect: an absolute URL
 * ("https://evil.tld") or a protocol-relative one ("//evil.tld") would send the
 * freshly authenticated user to an attacker's origin.
 */

const DEFAULT_AUTH_DESTINATION = "/dashboard"

/**
 * Return `raw` only when it is a same-origin absolute path, else the default.
 */
export function safeRedirectPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return DEFAULT_AUTH_DESTINATION
  }
  return raw
}
