import { screen, waitFor } from "@testing-library/react"

import { meApi } from "@/lib/api"
import { renderWithIntl } from "@/test/render-with-intl"

import { BillingNotice } from "../billing-notice"

jest.mock("@/lib/api", () => ({ meApi: { plan: jest.fn() } }))

const mockedPlan = jest.mocked(meApi.plan)

describe("BillingNotice", () => {
  beforeEach(() => mockedPlan.mockReset())

  it("shows until when the plan holds and where to fix the payment", async () => {
    mockedPlan.mockResolvedValue({ can_upgrade: true, grace_until: "2027-05-08T12:00:00Z" } as never)
    renderWithIntl(<BillingNotice />)

    const notice = await screen.findByRole("alert")
    expect(notice).toHaveTextContent("Não conseguimos cobrar sua assinatura. Seu plano vale até 08/05/2027.")
    expect(screen.getByRole("link", { name: "Resolver" })).toHaveAttribute("href", "/account/billing")
  })

  it.each([
    ["nothing is overdue", { can_upgrade: true, grace_until: null }],
    ["billing is off", { can_upgrade: false, grace_until: "2027-05-08T12:00:00Z" }],
  ])("stays hidden when %s", async (_, plan) => {
    mockedPlan.mockResolvedValue(plan as never)
    const { container } = renderWithIntl(<BillingNotice />)

    await waitFor(() => expect(mockedPlan).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it("stays hidden when the plan fails to load", async () => {
    mockedPlan.mockRejectedValue(new Error("offline"))
    const { container } = renderWithIntl(<BillingNotice />)

    await waitFor(() => expect(mockedPlan).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
