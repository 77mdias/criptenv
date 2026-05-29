import { getProjectNavigationItems } from "../project-navigation"

describe("project navigation permissions", () => {
  it("shows settings for admins and owners", () => {
    expect(getProjectNavigationItems("project-id", "admin").map((item) => item.key)).toContain("settings")
    expect(getProjectNavigationItems("project-id", "owner").map((item) => item.key)).toContain("settings")
  })

  it("hides settings for developers and viewers", () => {
    expect(getProjectNavigationItems("project-id", "developer").map((item) => item.key)).not.toContain("settings")
    expect(getProjectNavigationItems("project-id", "viewer").map((item) => item.key)).not.toContain("settings")
  })
})
