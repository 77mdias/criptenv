import { redactIconPath } from "../redact"

describe("redactIconPath", () => {
  it("hides the hostname in paths and full URLs", () => {
    expect(redactIconPath("/api/v1/icons/github.com/icon.png")).toBe("/api/v1/icons/[oculto]/icon.png")
    expect(redactIconPath("https://api.test/api/v1/icons/github.com/icon.png")).toBe(
      "https://api.test/api/v1/icons/[oculto]/icon.png"
    )
    expect(redactIconPath("/api/v1/projects")).toBe("/api/v1/projects")
  })
})
