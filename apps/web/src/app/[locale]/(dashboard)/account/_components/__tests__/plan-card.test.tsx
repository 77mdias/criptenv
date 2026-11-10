import { screen, waitFor } from "@testing-library/react"

import { meApi } from "@/lib/api"
import { renderWithIntl } from "@/test/render-with-intl"

import { PlanCard } from "../plan-card"

jest.mock("@/lib/api", () => ({ meApi: { plan: jest.fn() } }))

const mockedPlan = jest.mocked(meApi.plan)

describe("PlanCard", () => {
  beforeEach(() => mockedPlan.mockReset())

  it("shows the plan and the way to the subscription when billing is on", async () => {
    mockedPlan.mockResolvedValue({ id: "pro", can_upgrade: true } as never)
    renderWithIntl(<PlanCard />)

    expect(await screen.findByText("Pro")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Gerenciar assinatura" })).toHaveAttribute("href", "/account/billing")
  })

  it("renders nothing when billing is off", async () => {
    mockedPlan.mockResolvedValue({ id: "unlimited", can_upgrade: false } as never)
    const { container } = renderWithIntl(<PlanCard />)

    await waitFor(() => expect(mockedPlan).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when the plan fails to load", async () => {
    mockedPlan.mockRejectedValue(new Error("offline"))
    const { container } = renderWithIntl(<PlanCard />)

    await waitFor(() => expect(mockedPlan).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
