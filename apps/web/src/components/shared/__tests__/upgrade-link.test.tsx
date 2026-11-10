import { screen } from "@testing-library/react"

import type { Plan } from "@/lib/api/me"
import { renderWithIntl } from "@/test/render-with-intl"

import { PlanUsage } from "../plan-usage"
import { UpgradeLink } from "../upgrade-link"

function plan(used: number, canUpgrade: boolean | undefined): Plan {
  return {
    id: "free",
    features: [],
    usage: { projects: used },
    limits: {
      projects: 3,
      environments_per_project: 3,
      members_per_project: 3,
      integrations_per_project: 1,
      audit_retention_days: 7,
      personal_vault_items: 120,
      personal_vault_folders: 10,
    },
    can_upgrade: canUpgrade,
  }
}

describe("UpgradeLink", () => {
  it("links to the billing page when the plan can be upgraded", () => {
    renderWithIntl(<UpgradeLink plan={plan(0, true)} />)

    expect(screen.getByRole("link", { name: "Ver planos" })).toHaveAttribute("href", "/account/billing")
  })

  it.each([
    ["billing is off", plan(0, false)],
    ["an older API omits the field", plan(0, undefined)],
    ["the plan is unknown", null],
  ])("renders nothing when %s", (_, value) => {
    const { container } = renderWithIntl(<UpgradeLink plan={value} />)

    expect(container).toBeEmptyDOMElement()
  })
})

describe("PlanUsage upgrade shortcut", () => {
  it("shows the link once the limit is reached", () => {
    renderWithIntl(<PlanUsage plan={plan(3, true)} limitKey="projects" />)

    expect(screen.getByRole("status")).toHaveTextContent("Você chegou ao limite de 3 projetos")
    expect(screen.getByRole("link", { name: "Ver planos" })).toBeInTheDocument()
  })

  it("has no link below the limit", () => {
    renderWithIntl(<PlanUsage plan={plan(2, true)} limitKey="projects" />)

    expect(screen.queryByRole("link", { name: "Ver planos" })).not.toBeInTheDocument()
  })

  it("has no link for a member of someone else's project", () => {
    renderWithIntl(<PlanUsage plan={plan(3, false)} limitKey="projects" />)

    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Ver planos" })).not.toBeInTheDocument()
  })
})
