import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { environmentsApi, integrationsApi, projectsApi } from "@/lib/api"
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
    update: jest.fn(),
  },
  projectsApi: { list: jest.fn(), plan: jest.fn() },
  environmentsApi: { list: jest.fn() },
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
    jest.mocked(environmentsApi.list).mockResolvedValue({ environments: [] })
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

describe("IntegrationsPage automatic sync", () => {
  const connection = {
    id: "i1",
    project_id: "project-1",
    provider: "vercel",
    name: "Site",
    status: "active",
    last_sync_at: null,
    last_error: null,
    created_at: "2026-11-10T00:00:00Z",
    auto_sync_targets: {},
    redeploy: false,
  }
  const production = { id: "e-prod", project_id: "project-1", name: "production", display_name: null, created_at: "", updated_at: "" }

  beforeEach(() => {
    jest.mocked(projectsApi.list).mockResolvedValue({ projects: [{ id: "project-1", name: "App" }], total: 1 } as never)
    jest.mocked(environmentsApi.list).mockResolvedValue({ environments: [production] })
    mockedPlan.mockReset().mockRejectedValue(new Error("offline"))
    jest.mocked(integrationsApi.update).mockReset()
  })

  function listWith(features: string[]) {
    jest.mocked(integrationsApi.list).mockResolvedValue({
      integrations: [connection], total: 1, available_providers: [], features,
    })
  }

  it("shows the option locked, naming the Max plan, to an owner without it", async () => {
    listWith([])
    renderWithIntl(<IntegrationsPage />)

    expect(await screen.findByRole("heading", { name: "Envio automático" })).toBeInTheDocument()
    expect(screen.getByLabelText("production")).toBeDisabled()
    expect(screen.getByText("Disponível no plano Max.")).toBeInTheDocument()
    expect(jest.mocked(environmentsApi.list)).toHaveBeenCalledWith("project-1")
  })

  it("binds an environment and keeps the saved binding on screen", async () => {
    listWith(["auto_sync", "ci_sync", "sync_redeploy"])
    jest.mocked(integrationsApi.update).mockResolvedValue({ ...connection, auto_sync_targets: { "e-prod": "preview" } })
    renderWithIntl(<IntegrationsPage />)

    await userEvent.selectOptions(await screen.findByLabelText("production"), "preview")

    expect(jest.mocked(integrationsApi.update)).toHaveBeenCalledWith("project-1", "i1", {
      auto_sync_targets: { "e-prod": "preview" },
    })
    await waitFor(() => expect(screen.getByLabelText("production")).toHaveValue("preview"))
  })

  it("still lists the connections when the environments fail to load", async () => {
    listWith([])
    jest.mocked(environmentsApi.list).mockRejectedValue(new Error("offline"))
    renderWithIntl(<IntegrationsPage />)

    expect(await screen.findByRole("heading", { name: "Site" })).toBeInTheDocument()
    expect(screen.queryByText("offline")).not.toBeInTheDocument()
  })
})
