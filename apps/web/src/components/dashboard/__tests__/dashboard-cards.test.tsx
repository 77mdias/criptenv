import { screen } from "@testing-library/react"
import { renderWithIntl } from "@/test/render-with-intl"
import type { AttentionItem } from "@/lib/dashboard/attention"
import { ActivityChart } from "../activity-chart"
import { AttentionCard } from "../attention-card"

const expired: AttentionItem = {
  id: "expired:e1:API_KEY",
  projectId: "p1",
  kind: "expired",
  severity: "high",
  messageKey: "expired",
  values: { key: "API_KEY", environment: "production", project: "api" },
  href: "/projects/p1/secrets?key=API_KEY",
  date: null,
}

describe("AttentionCard", () => {
  it("renders each item as a link to its fix, with severity for screen readers", () => {
    renderWithIntl(<AttentionCard items={[expired]} />)
    const link = screen.getByRole("link", { name: /API_KEY expirou em production/ })
    expect(link).toHaveAttribute("href", expect.stringContaining("/projects/p1/secrets?key=API_KEY"))
    expect(link).toHaveTextContent("Urgente")
    expect(screen.getByText("1 item pede uma ação sua")).toBeInTheDocument()
  })

  it("shows an all-clear state when there is nothing to do", () => {
    renderWithIntl(<AttentionCard items={[]} />)
    expect(screen.getByText(/Tudo em ordem/)).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
})

describe("ActivityChart", () => {
  it("handles days without events and exposes an accessible summary", () => {
    renderWithIntl(<ActivityChart days={[
      { date: "2026-10-25", changes: 0, other: 0 },
      { date: "2026-10-26", changes: 2, other: 1 },
    ]} />)
    expect(screen.getByRole("img", { name: "3 eventos nos últimos 2 dias" })).toBeInTheDocument()
    // only days with events go to the screen-reader table
    expect(screen.getAllByRole("row")).toHaveLength(2)
  })

  it("says there were no events", () => {
    renderWithIntl(<ActivityChart days={[{ date: "2026-10-26", changes: 0, other: 0 }]} />)
    expect(screen.getByRole("img", { name: "Nenhum evento nos últimos 1 dias" })).toBeInTheDocument()
  })
})
