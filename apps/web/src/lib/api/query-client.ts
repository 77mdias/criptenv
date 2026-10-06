// Shared React Query client.
//
// Single source of truth for server-state caching. The API client uses this
// same instance, so `peekCached`/invalidation and component-level `useQuery`
// calls operate on the same cache (audit P0-1/P1-3, Sprint 2 2026-10).

import { QueryClient } from "@tanstack/react-query"

/** Cache key prefix for responses fetched through the API client. */
export const API_CACHE_PREFIX = "api" as const

/** How long a GET response is considered fresh (mirrors the previous 15s TTL). */
export const API_STALE_TIME_MS = 15_000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: API_STALE_TIME_MS,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry auth/permission failures — they will not succeed.
        const status = (error as { status?: number } | null)?.status
        if (status && status >= 400 && status < 500) return false
        return failureCount < 2
      },
    },
  },
})

/** Build the React Query cache key for an API URL. */
export function apiCacheKey(url: string) {
  return [API_CACHE_PREFIX, url] as const
}
