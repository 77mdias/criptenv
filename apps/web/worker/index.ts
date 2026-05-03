/**
 * Cloudflare Worker entry point — simplified for Pages free tier
 * Removes IMAGES binding dependency that may not be available on free plan
 */
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Delegate everything to vinext handler
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
