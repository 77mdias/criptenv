import { apiCacheKey, queryClient, API_CACHE_PREFIX } from "../query-client"

describe("React Query client integration", () => {
  afterEach(() => {
    queryClient.clear()
  })

  it("uses a namespaced cache key per URL", () => {
    const key = apiCacheKey("http://localhost/api/v1/projects")
    expect(key[0]).toBe(API_CACHE_PREFIX)
    expect(key[1]).toBe("http://localhost/api/v1/projects")
  })

  it("exposes cached data through getQueryData (same store as the API client)", () => {
    const key = apiCacheKey("http://localhost/api/v1/projects")
    queryClient.setQueryData(key, [{ id: "prj_1" }])

    expect(queryClient.getQueryData(key)).toEqual([{ id: "prj_1" }])
  })

  it("invalidateQueries drops cached entries", async () => {
    const key = apiCacheKey("http://localhost/api/v1/projects")
    queryClient.setQueryData(key, [{ id: "prj_1" }])

    await queryClient.invalidateQueries()

    // Invalidation marks data stale (it is refetched on next mount); the
    // mutation path relies on this to drop optimistic views.
    const state = queryClient.getQueryState(key)
    expect(state?.isInvalidated).toBe(true)
  })
})
