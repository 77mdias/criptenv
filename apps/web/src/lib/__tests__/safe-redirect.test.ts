import { safeRedirectPath } from "../safe-redirect"

describe("safeRedirectPath", () => {
  it("keeps same-origin absolute paths", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard")
    expect(safeRedirectPath("/projects/prj_1/secrets?env=dev")).toBe(
      "/projects/prj_1/secrets?env=dev",
    )
  })

  it("falls back to the dashboard for cross-origin URLs", () => {
    expect(safeRedirectPath("https://evil.tld/steal")).toBe("/dashboard")
    expect(safeRedirectPath("http://evil.tld")).toBe("/dashboard")
  })

  it("rejects protocol-relative URLs", () => {
    expect(safeRedirectPath("//evil.tld/steal")).toBe("/dashboard")
    expect(safeRedirectPath("//evil.tld")).toBe("/dashboard")
  })

  it("falls back for missing or non-absolute values", () => {
    expect(safeRedirectPath(null)).toBe("/dashboard")
    expect(safeRedirectPath(undefined)).toBe("/dashboard")
    expect(safeRedirectPath("")).toBe("/dashboard")
    expect(safeRedirectPath("dashboard")).toBe("/dashboard")
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/dashboard")
  })
})
