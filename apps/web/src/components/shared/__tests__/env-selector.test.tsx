import { screen } from "@testing-library/react"

import type { Environment } from "@/lib/api"
import { renderWithIntl } from "@/test/render-with-intl"

import { EnvSelector } from "../env-selector"

function env(name: string, restricted: boolean): Environment {
  return { id: name, project_id: "p", name, display_name: null, restricted, created_at: "", updated_at: "" }
}

describe("EnvSelector", () => {
  it("marks a restricted environment with a lock and leaves the others plain", () => {
    renderWithIntl(
      <EnvSelector
        environments={[env("production", false), env("db-admin", true)]}
        activeEnvironmentId="production"
        onSelect={() => {}}
      />,
    )

    expect(screen.getAllByLabelText("Restrito a administradores")).toHaveLength(1)
    expect(screen.getByRole("tab", { name: /db-admin/ })).toContainElement(
      screen.getByLabelText("Restrito a administradores"),
    )
  })
})
