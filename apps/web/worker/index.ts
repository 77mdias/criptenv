/**
 * Cloudflare Worker entry point — simplified for Pages free tier
 * Removes IMAGES binding dependency that may not be available on free plan
 */
import handler from "vinext/server/app-router-entry";
import { renderEmergencyPage } from "./error-page";

interface Env {
  ASSETS: Fetcher;
  API_URL?: string;
  NEXT_PUBLIC_API_URL?: string;
  /**
   * Comma-separated origins allowed to serve user avatars (the R2 public URL /
   * custom domain). Overrides the defaults below. Example:
   *   AVATAR_PUBLIC_ORIGIN=https://avatars.example.com,https://*.r2.dev
   */
  AVATAR_PUBLIC_ORIGIN?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function normalizeApiBaseUrl(env: Env): string | null {
  const configuredUrl = env.API_URL?.trim() || env.NEXT_PUBLIC_API_URL?.trim();
  if (!configuredUrl) {
    return null;
  }

  return configuredUrl.replace(/\/+$/, "");
}

// Avatars are uploaded to Cloudflare R2 and rendered straight from its public
// URL with a plain <img>. The CSP must allow that origin, otherwise the browser
// blocks the image and the UI silently falls back to the user's initials.
// Override per deployment with AVATAR_PUBLIC_ORIGIN.
const DEFAULT_AVATAR_ORIGINS = [
  "https://avatars.77mdevseven.tech",
  "https://*.r2.dev",
];

function resolveAvatarOrigins(env: Env): string[] {
  const raw = env.AVATAR_PUBLIC_ORIGIN?.trim();
  const values = raw ? raw.split(",") : DEFAULT_AVATAR_ORIGINS;

  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        // Collapse a full URL (e.g. https://host/some/path) to its origin.
        const parsed = new URL(value);
        return `${parsed.protocol}//${parsed.host}`;
      } catch {
        return value;
      }
    });
}

function buildCsp(env: Env): string {
  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    ...resolveAvatarOrigins(env),
  ].join(" ");

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const SECURITY_HEADERS: Record<string, string> = {
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

function withSecurityHeaders(response: Response, url: URL, env: Env): Response {
  // Only enforce on https: in plain-http local dev `upgrade-insecure-requests`
  // would break the vinext image optimizer's http redirects.
  if (url.protocol !== "https:") {
    return response;
  }

  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  headers.set("content-security-policy", buildCsp(env));

  if (response.body) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const apiBaseUrl = normalizeApiBaseUrl(env);
      if (!apiBaseUrl) {
        return new Response(
          JSON.stringify({ detail: "API proxy is not configured." }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      const targetUrl = `${apiBaseUrl}${url.pathname}${url.search}`;
      const headers = new Headers(request.headers);

      headers.set("x-forwarded-host", url.host);
      headers.set("x-forwarded-proto", url.protocol.replace(":", ""));

      const clientIp = request.headers.get("cf-connecting-ip");
      if (clientIp) {
        headers.set("x-forwarded-for", clientIp);
      }

      // Remove hop-by-hop headers that can cause issues when proxying
      headers.delete("content-length");
      headers.delete("content-encoding");
      headers.delete("transfer-encoding");

      const isBodyAllowed = request.method !== "GET" && request.method !== "HEAD";
      let body: ArrayBuffer | undefined;

      if (isBodyAllowed && request.body) {
        try {
          // Bufferize body to avoid stream issues when proxying multipart uploads.
          // Cloudflare Workers may truncate or corrupt ReadableStream bodies
          // when forwarding to external origins.
          body = await request.arrayBuffer();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error("[worker] Failed to read request body:", message);
          return new Response(
            JSON.stringify({ detail: `Failed to read request body: ${message}` }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      try {
        const response = await fetch(targetUrl, {
          method: request.method,
          headers,
          body,
          redirect: "manual",
        });

        // Log non-success responses for debugging
        if (!response.ok) {
          console.warn(
            `[worker] API proxy ${request.method} ${url.pathname} -> ${response.status} ${response.statusText}`
          );
        }

        return withSecurityHeaders(response, url, env);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[worker] API proxy error:", message, "URL:", targetUrl);
        return new Response(
          JSON.stringify({ detail: `API proxy error: ${message}` }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Delegate everything to vinext handler
    try {
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(response, url, env);
    } catch (err) {
      console.error(
        "[worker] Unhandled error:",
        err instanceof Error ? err.stack : err,
        "Path:",
        url.pathname
      );
      return renderEmergencyPage(request);
    }
  },
};

export default worker;
