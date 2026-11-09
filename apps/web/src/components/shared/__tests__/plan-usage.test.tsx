import { screen } from "@testing-library/react"

import type { Plan } from "@/lib/api/me"
import { renderWithIntl } from "@/test/render-with-intl"

import { isPlanFull, PlanUsage } from "../plan-usage"

function plan(usage: Plan["usage"], limits: Partial<Plan["limits"]> = {}): Plan {
  return {
    id: "free",
    features: [],
    usage,
    limits: {
      projects: 3,
      environments_per_project: 3,
      members_per_project: 3,
      integrations_per_project: 1,
      audit_retention_days: 7,
      personal_vault_items: 120,
      personal_vault_folders: 10,
      ...limits,
    },
  }
}

describe("PlanUsage", () => {
  it("shows usage below the limit and no notice", () => {
    renderWithIntl(<PlanUsage plan={plan({ projects: 2 })} limitKey="projects" />)
    expect(screen.getByText("2 de 3 projetos")).toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("shows the notice at the limit", () => {
    renderWithIntl(<PlanUsage plan={plan({ projects: 3 })} limitKey="projects" />)
    expect(screen.getByText("3 de 3 projetos")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("limite de 3 projetos")
  })

  it("names the owner's plan for per-project limits", () => {
    renderWithIntl(<PlanUsage plan={plan({ members_per_project: 3 })} limitKey="members_per_project" />)
    expect(screen.getByRole("status")).toHaveTextContent("limite de 3 membros do plano do dono")
  })

  it("renders nothing for an unlimited plan", () => {
    const { container } = renderWithIntl(
      <PlanUsage plan={plan({ projects: 9 }, { projects: null })} limitKey="projects" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing while the plan is unknown", () => {
    const { container } = renderWithIntl(<PlanUsage plan={null} limitKey="projects" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the generic notice on a 402 with an unknown plan", () => {
    renderWithIntl(<PlanUsage plan={null} limitKey="projects" limitHit />)
    expect(screen.getByRole("status")).toHaveTextContent("O limite do plano foi atingido.")
  })

  it("shows the notice on a 402 even when the loaded plan looks under the limit", () => {
    renderWithIntl(<PlanUsage plan={plan({ projects: 2 })} limitKey="projects" limitHit />)
    expect(screen.getByRole("status")).toHaveTextContent("limite de 3 projetos")
  })
})

describe("isPlanFull", () => {
  it("is true only at or over a known limit", () => {
    expect(isPlanFull(plan({ projects: 3 }), "projects")).toBe(true)
    expect(isPlanFull(plan({ projects: 4 }), "projects")).toBe(true)
    expect(isPlanFull(plan({ projects: 2 }), "projects")).toBe(false)
    expect(isPlanFull(plan({ projects: 9 }, { projects: null }), "projects")).toBe(false)
    expect(isPlanFull(null, "projects")).toBe(false)
  })
})
