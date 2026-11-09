import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { integrationsApi, projectsApi } from "@/lib/api"
import { ApiError } from "@/lib/api/client"
import type { Plan } from "@/lib/api/me"
import { renderWithIntl } from "@/test/render-with-intl"

import IntegrationsPage from "../page"

jest.mock("@/lib/api", () => ({
  integrationsApi: {
    list: jest.fn(),
    create: jest.fn(),
    validate: jest.fn(),
    delete: jest.fn(),
  },
  projectsApi: { list: jest.fn(), plan: jest.fn() },
}))

const mockedPlan = jest.mocked(projectsApi.plan)
const mockedCreate = jest.mocked(integrationsApi.create)

function ownerPlan(integrations: number): Plan {
  return {
    id: "free",
    features: [],
    usage: { integrations_per_project: integrations },
    limits: {
      projects: 3,
      environments_per_project: 3,
      members_per_project: 3,
      integrations_per_project: 1,
      audit_retention_days: 7,
      personal_vault_items: 120,
      personal_vault_folders: 10,
    },
  }
}

const connect = () => screen.getByRole("button", { name: /^Conectar/ })

async function fillAndConnect() {
  await screen.findByRole("heading", { name: "Integrações" })
  const form = connect().closest("form") as HTMLFormElement
  for (const input of Array.from(form.querySelectorAll("input[required]"))) {
    await userEvent.type(input as HTMLInputElement, "value")
  }
  await userEvent.click(connect())
}

describe("IntegrationsPage plan limit", () => {
  beforeEach(() => {
    jest.mocked(projectsApi.list).mockResolvedValue({ projects: [{ id: "project-1", name: "App" }], total: 1 } as never)
    jest.mocked(integrationsApi.list).mockResolvedValue({ integrations: [], total: 0 } as never)
    mockedCreate.mockReset()
    mockedPlan.mockReset()
    mockedPlan.mockRejectedValue(new Error("offline"))
  })

  it("shows the connections usage of the selected project", async () => {
    mockedPlan.mockResolvedValue(ownerPlan(0))
    renderWithIntl(<IntegrationsPage />)

    expect(await screen.findByText("0 de 1 conexões")).toBeInTheDocument()
    expect(mockedPlan).toHaveBeenCalledWith("project-1")
    expect(connect()).toBeEnabled()
  })

  it("disables connecting at the limit", async () => {
    mockedPlan.mockResolvedValue(ownerPlan(1))
    renderWithIntl(<IntegrationsPage />)

    expect(await screen.findByRole("status")).toHaveTextContent("limite de 1 conexões com hospedagem do plano do dono")
    expect(connect()).toBeDisabled()
  })

  it("shows the limit notice instead of the raw error on a 402", async () => {
    mockedCreate.mockRejectedValue(new ApiError("Plan limit reached: integrations_per_project (1)", 402, {}))
    renderWithIntl(<IntegrationsPage />)
    await fillAndConnect()

    expect(await screen.findByRole("status")).toHaveTextContent("O limite do plano foi atingido.")
    expect(screen.queryByText(/Plan limit reached/)).not.toBeInTheDocument()
  })

  it("reloads the plan after a connection is created", async () => {
    mockedPlan.mockResolvedValue(ownerPlan(0))
    mockedCreate.mockResolvedValue({} as never)
    renderWithIntl(<IntegrationsPage />)
    await screen.findByText("0 de 1 conexões")
    mockedPlan.mockResolvedValue(ownerPlan(1))
    await fillAndConnect()

    expect(await screen.findByText("1 de 1 conexões")).toBeInTheDocument()
    await waitFor(() => expect(mockedPlan).toHaveBeenCalledTimes(2))
  })
})
