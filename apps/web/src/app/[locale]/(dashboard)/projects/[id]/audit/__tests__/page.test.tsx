import { screen } from "@testing-library/react"

import { projectsApi } from "@/lib/api"
import type { Plan } from "@/lib/api/me"
import { renderWithIntl } from "@/test/render-with-intl"

import AuditPage from "../page"

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "project-1" }),
}))

jest.mock("@/lib/api", () => ({
  peekCached: jest.fn(() => undefined),
  auditApi: { getLogs: jest.fn(() => Promise.resolve({ logs: [], total: 0, page: 1, per_page: 50 })) },
  projectsApi: { plan: jest.fn() },
}))

jest.mock("@/components/shared/audit-timeline", () => ({
  AuditTimeline: () => <div>timeline</div>,
}))

const mockedPlan = jest.mocked(projectsApi.plan)

function ownerPlan(days: number | null): Plan {
  return {
    id: days === null ? "unlimited" : "free",
    features: [],
    usage: {},
    limits: {
      projects: 3,
      environments_per_project: 3,
      members_per_project: 3,
      integrations_per_project: 1,
      audit_retention_days: days,
      personal_vault_items: 120,
      personal_vault_folders: 10,
    },
  }
}

describe("AuditPage history window", () => {
  it("says how far back the owner's plan shows", async () => {
    mockedPlan.mockResolvedValue(ownerPlan(7))
    renderWithIntl(<AuditPage />)

    expect(
      await screen.findByText("Mostrando os últimos 7 dias, conforme o plano do dono do projeto."),
    ).toBeInTheDocument()
    expect(mockedPlan).toHaveBeenCalledWith("project-1")
  })

  it("says nothing when the plan keeps the whole history", async () => {
    mockedPlan.mockResolvedValue(ownerPlan(null))
    renderWithIntl(<AuditPage />)

    await screen.findByText("timeline")
    expect(screen.queryByText(/Mostrando os últimos/)).not.toBeInTheDocument()
  })
})
