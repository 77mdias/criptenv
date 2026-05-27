/**
 * Cloudflare Worker entry point — simplified for Pages free tier
 * Removes IMAGES binding dependency that may not be available on free plan
 */
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  API_URL?: string;
  NEXT_PUBLIC_API_URL?: string;
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

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const apiBaseUrl = normalizeApiBaseUrl(env);
      if (!apiBaseUrl) {
        return new Response("API proxy is not configured.", { status: 500 });
      }

      const targetUrl = `${apiBaseUrl}${url.pathname}${url.search}`;
      const headers = new Headers(request.headers);

      headers.set("x-forwarded-host", url.host);
      headers.set("x-forwarded-proto", url.protocol.replace(":", ""));

      const clientIp = request.headers.get("cf-connecting-ip");
      if (clientIp) {
        headers.set("x-forwarded-for", clientIp);
      }

      // Remove Content-Length when proxying a stream body to prevent mismatches
      // between the original length and the actual streamed bytes.
      headers.delete("content-length");
      headers.delete("content-encoding");

      const isBodyAllowed = request.method !== "GET" && request.method !== "HEAD";

      try {
        const response = await fetch(targetUrl, {
          method: request.method,
          headers,
          body: isBodyAllowed ? request.body : undefined,
          redirect: "manual",
        });
        return response;
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
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
