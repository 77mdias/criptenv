import { screen } from "@testing-library/react"

import { meApi } from "@/lib/api"
import type { OverviewResponse } from "@/lib/api"
import { renderWithIntl } from "@/test/render-with-intl"

import DashboardPage from "../page"

jest.mock("@/lib/api", () => ({
  peekCached: jest.fn(() => undefined),
  meApi: { overview: jest.fn(), activityStats: jest.fn(), audit: jest.fn() },
}))

jest.mock("@/components/dashboard/activity-chart", () => ({ ActivityChart: () => <div>chart</div> }))

const overview: OverviewResponse = {
  projects: [
    {
      id: "p1",
      name: "api",
      slug: "api",
      role: "owner",
      member_count: 1,
      manager_count: 1,
      last_activity_at: null,
      environments: [],
    },
  ],
  attention: { expired: [], expiring: [], pending_invites: [], stale_credentials: [], failing_integrations: [] },
  totals: { projects: 1, secrets: 0, members: 1 },
}

describe("DashboardPage", () => {
  it("keeps the dashboard up when only the activity feed fails (e.g. the API is one release behind)", async () => {
    jest.mocked(meApi.overview).mockResolvedValue(overview)
    jest.mocked(meApi.activityStats).mockResolvedValue([])
    jest.mocked(meApi.audit).mockRejectedValue(new Error("Not Found"))
    renderWithIntl(<DashboardPage />)

    expect(await screen.findByText("Nenhuma atividade recente")).toBeInTheDocument()
    expect(screen.getAllByText("api").length).toBeGreaterThan(0)
    expect(screen.queryByText("Not Found")).not.toBeInTheDocument()
  })
})
