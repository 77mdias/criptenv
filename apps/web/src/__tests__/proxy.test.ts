import { proxy } from "@/proxy"

jest.mock("next/server", () => ({
  NextResponse: {
    next: () => ({
      headers: new Map(),
      status: 200,
    }),
    redirect: (url: URL) => ({
      headers: new Map([["location", url.toString()]]),
      status: 307,
    }),
  },
}))

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
})
