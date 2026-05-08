import { peekCached, request } from "../client"

describe("api client", () => {
  beforeEach(() => {
    jest.useRealTimers()
    window.history.replaceState(null, "", "http://localhost/")
  })

  it("caches successful GET responses", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({ ok: true }),
      ok: true,
      status: 200,
    })
    global.fetch = fetchMock as typeof fetch

    await expect(request("GET", "/api/test-cache")).resolves.toEqual({ ok: true })
    await expect(request("GET", "/api/test-cache")).resolves.toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(peekCached<{ ok: boolean }>("/api/test-cache")).toEqual({ ok: true })
  })

  it("throws ApiError with response detail on failed requests", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ detail: "Nope" }),
      ok: false,
      status: 403,
    }) as typeof fetch

    await expect(request("GET", "/api/forbidden")).rejects.toMatchObject({
      message: "Nope",
      status: 403,
    })
  })

  it("invalidates GET cache after a mutation", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ value: 1 }),
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        json: async () => ({ saved: true }),
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        json: async () => ({ value: 2 }),
        ok: true,
        status: 200,
      })

    global.fetch = fetchMock as typeof fetch

    await request("GET", "/api/mutable")
    await request("POST", "/api/mutable", { value: 2 })

    expect(peekCached("/api/mutable")).toBeNull()
    await expect(request("GET", "/api/mutable")).resolves.toEqual({ value: 2 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("does not cache stale GET responses that resolve after a mutation", async () => {
    let resolveGet: ((value: unknown) => void) | undefined
    const staleGet = new Promise((resolve) => {
      resolveGet = resolve
    })

    const fetchMock = jest
      .fn()
      .mockReturnValueOnce(staleGet)
      .mockResolvedValueOnce({
        json: async () => ({ saved: true }),
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        json: async () => ({ value: "fresh" }),
        ok: true,
        status: 200,
      })

    global.fetch = fetchMock as typeof fetch

    const firstGet = request("GET", "/api/racy")
    await request("POST", "/api/racy", { value: "new" })

    resolveGet?.({
      json: async () => ({ value: "stale" }),
      ok: true,
      status: 200,
    })

    await expect(firstGet).resolves.toEqual({ value: "stale" })
    expect(peekCached("/api/racy")).toBeNull()
    await expect(request("GET", "/api/racy")).resolves.toEqual({ value: "fresh" })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
