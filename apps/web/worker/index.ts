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

      return fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
        redirect: "manual",
      });
    }

    // Delegate everything to vinext handler
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
