import { getProjectNavigationItems } from "../project-navigation"

describe("project navigation permissions", () => {
  it("shows settings for admins and owners", () => {
    expect(getProjectNavigationItems("project-id", "admin").map((item) => item.key)).toContain("settings")
    expect(getProjectNavigationItems("project-id", "owner").map((item) => item.key)).toContain("settings")
  })

  it("offers the environment comparison to every role, right after secrets", () => {
    for (const role of ["owner", "admin", "developer", "viewer"] as const) {
      const items = getProjectNavigationItems("project-id", role)
      const keys = items.map((item) => item.key)
      expect(keys.indexOf("compare")).toBe(keys.indexOf("secrets") + 1)
      expect(items.find((item) => item.key === "compare")?.href).toBe("/projects/project-id/compare")
    }
  })

  it("hides settings for developers and viewers", () => {
    expect(getProjectNavigationItems("project-id", "developer").map((item) => item.key)).not.toContain("settings")
    expect(getProjectNavigationItems("project-id", "viewer").map((item) => item.key)).not.toContain("settings")
  })
})
