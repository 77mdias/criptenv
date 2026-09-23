import { proxy } from "@/proxy"

// next-intl ships ESM-only; mocking keeps this suite focused on the auth guard.
// Locale negotiation itself is covered by the runtime smoke test.
const mockHandleI18n = jest.fn()

jest.mock("next-intl/middleware", () => ({
  __esModule: true,
  default: () => (request: unknown) => mockHandleI18n(request),
}))

jest.mock("next/server", () => ({
  NextResponse: {
    next: () => ({
      cookies: { getAll: () => [], set: jest.fn() },
      headers: new Map(),
      status: 200,
    }),
    redirect: (url: URL) => ({
      cookies: { getAll: () => [], set: jest.fn() },
      headers: new Map([["location", url.toString()]]),
      status: 307,
    }),
  },
}))

/** Pass-through response, as next-intl returns when the locale is already right. */
function passThrough() {
  return {
    cookies: { getAll: () => [], set: jest.fn() },
    headers: new Map<string, string>(),
    status: 200,
  }
}

function makeRequest(path: string, cookie?: string) {
  return {
    cookies: {
      get: (name: string) =>
        cookie && name === "session_token" ? { value: cookie.split("=", 2)[1] } : undefined,
    },
    nextUrl: new URL(`http://localhost${path}`),
    url: `http://localhost${path}`,
  }
}

describe("proxy", () => {
  beforeEach(() => {
    mockHandleI18n.mockReturnValue(passThrough())
  })

  it("redirects protected routes without a session cookie", () => {
    const response = proxy(makeRequest("/dashboard") as never)

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("http://localhost/login?redirect=%2Fdashboard")
  })

  it("allows protected routes with a session cookie", () => {
    const response = proxy(makeRequest("/projects", "session_token=test-session") as never)

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeUndefined()
  })

  it("allows API routes to handle their own auth", () => {
    const response = proxy(makeRequest("/api/v1/projects") as never)

    expect(response.status).toBe(200)
  })

  it("treats a locale-prefixed protected route as protected", () => {
    const response = proxy(makeRequest("/en/dashboard") as never)

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("http://localhost/en/login?redirect=%2Fen%2Fdashboard")
  })

  it("redirects an es visitor to the es login page, not the default locale", () => {
    const response = proxy(makeRequest("/es/projects") as never)

    expect(response.headers.get("location")).toBe("http://localhost/es/login?redirect=%2Fes%2Fprojects")
  })

  it("keeps the default locale unprefixed in the login redirect", () => {
    const response = proxy(makeRequest("/dashboard") as never)

    expect(response.headers.get("location")).toBe("http://localhost/login?redirect=%2Fdashboard")
  })

  it("allows a locale-prefixed protected route with a session cookie", () => {
    const response = proxy(makeRequest("/es/projects", "session_token=test-session") as never)

    expect(response.status).toBe(200)
  })

  it("lets next-intl's locale redirect win over the auth guard", () => {
    mockHandleI18n.mockReturnValue({
      cookies: { getAll: () => [], set: jest.fn() },
      headers: new Map([["location", "http://localhost/en/dashboard"]]),
      status: 307,
    })

    const response = proxy(makeRequest("/dashboard") as never)

    expect(response.headers.get("location")).toBe("http://localhost/en/dashboard")
  })
})
