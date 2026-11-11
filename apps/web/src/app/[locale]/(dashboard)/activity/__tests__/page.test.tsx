import { fireEvent, screen } from "@testing-library/react"
import { useSearchParams } from "next/navigation"

import { useRouter } from "@/i18n/navigation"
import { meApi } from "@/lib/api"
import type { AuditLog, OverviewResponse } from "@/lib/api"
import { renderWithIntl } from "@/test/render-with-intl"

import ActivityPage from "../page"

jest.mock("@/lib/api", () => ({
  peekCached: jest.fn(() => undefined),
  meApi: { overview: jest.fn(), audit: jest.fn() },
}))

const overview = {
  projects: [{ id: "p1", name: "api", slug: "api", role: "owner", member_count: 1, last_activity_at: null, environments: [] }],
  attention: { expired: [], expiring: [], pending_invites: [], stale_credentials: [], failing_integrations: [] },
  totals: { projects: 1, secrets: 0, members: 1 },
} as OverviewResponse

const log: AuditLog = {
  id: "l1",
  project_id: "p1",
  user_id: null,
  action: "vault.pushed",
  resource_type: "vault",
  resource_id: null,
  created_at: new Date().toISOString(),
  auth_type: "ci_session",
  meta: { blob_count: 2 },
}

beforeEach(() => {
  jest.mocked(meApi.overview).mockResolvedValue(overview)
  jest.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams() as unknown as ReturnType<typeof useSearchParams>,
  )
})

describe("ActivityPage", () => {
  it("lists events from every project with the project name", async () => {
    jest.mocked(meApi.audit).mockResolvedValue({ logs: [log], total: 1, page: 1, per_page: 50 })
    renderWithIntl(<ActivityPage />)

    expect(await screen.findByText("vault.pushed", { exact: false })).toBeInTheDocument()
    expect(await screen.findAllByText("api")).not.toHaveLength(0)
    expect(screen.getByText("1 evento nos seus projetos")).toBeInTheDocument()
    expect(meApi.audit).toHaveBeenCalledWith({ page: 1, per_page: 50 })
  })

  it("sends the filters in the URL to the API and keeps them in the address", async () => {
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("origin=ci_session") as unknown as ReturnType<typeof useSearchParams>,
    )
    jest.mocked(meApi.audit).mockResolvedValue({ logs: [], total: 0, page: 1, per_page: 50 })
    renderWithIntl(<ActivityPage />)

    expect(await screen.findByText("Nada com esses filtros")).toBeInTheDocument()
    expect(meApi.audit).toHaveBeenCalledWith({ page: 1, per_page: 50, auth_type: "ci_session" })

    fireEvent.change(screen.getByLabelText("Período"), { target: { value: "30" } })
    expect(useRouter().replace).toHaveBeenCalledWith("/?origin=ci_session&days=30", { scroll: false })
  })

  it("shows the empty state when nothing happened yet", async () => {
    jest.mocked(meApi.audit).mockResolvedValue({ logs: [], total: 0, page: 1, per_page: 50 })
    renderWithIntl(<ActivityPage />)

    expect(await screen.findByText("Nenhuma atividade ainda")).toBeInTheDocument()
  })
})
