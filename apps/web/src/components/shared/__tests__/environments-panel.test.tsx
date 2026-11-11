import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { environmentsApi, projectsApi } from "@/lib/api"
import type { Environment } from "@/lib/api"
import { ApiError } from "@/lib/api/client"
import type { Plan } from "@/lib/api/me"
import { renderWithIntl } from "@/test/render-with-intl"

import { EnvironmentsPanel } from "../environments-panel"

jest.mock("@/lib/api", () => ({
  environmentsApi: { list: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  projectsApi: { plan: jest.fn() },
}))

const mocked = {
  list: jest.mocked(environmentsApi.list),
  create: jest.mocked(environmentsApi.create),
  update: jest.mocked(environmentsApi.update),
  remove: jest.mocked(environmentsApi.delete),
  plan: jest.mocked(projectsApi.plan),
}

function env(name: string, over: Partial<Environment> = {}): Environment {
  return {
    id: `env-${name}`,
    project_id: "project-1",
    name,
    display_name: null,
    is_default: false,
    restricted: false,
    created_at: "2027-01-01T00:00:00Z",
    updated_at: "2027-01-01T00:00:00Z",
    ...over,
  }
}

const SEEDED = [env("production", { is_default: true }), env("staging"), env("development")]

function plan(used: number, max: number | null, canUpgrade = true): Plan {
  return {
    id: "pro",
    features: [],
    usage: { environments_per_project: used },
    limits: {
      projects: null,
      environments_per_project: max,
      members_per_project: 10,
      integrations_per_project: null,
      audit_retention_days: 30,
      personal_vault_items: null,
      personal_vault_folders: null,
    },
    can_upgrade: canUpgrade,
  }
}

async function open(environments: Environment[] = SEEDED, ownerPlan: Plan = plan(environments.length, 5)) {
  mocked.list.mockResolvedValue({ environments })
  mocked.plan.mockResolvedValue(ownerPlan)
  renderWithIntl(<EnvironmentsPanel projectId="project-1" />)
  await screen.findByRole("heading", { name: "Ambientes" })
  await screen.findByText("production")
}

const row = (name: string) => screen.getByRole("listitem", { name })

describe("EnvironmentsPanel", () => {
  beforeEach(() => jest.clearAllMocks())

  it("lists the environments with the plan usage", async () => {
    await open([...SEEDED, env("db-admin", { restricted: true })], plan(4, 5))

    expect(screen.getByText("4 de 5 ambientes")).toBeInTheDocument()
    expect(within(row("db-admin")).getByText("Restrito a administradores")).toBeInTheDocument()
    expect(within(row("staging")).queryByText("Restrito a administradores")).not.toBeInTheDocument()
  })

  it("creates a restricted environment", async () => {
    mocked.create.mockResolvedValue(env("db-admin", { restricted: true }))
    await open()

    await userEvent.type(screen.getByLabelText("Nome"), "db-admin")
    await userEvent.type(screen.getByLabelText("Nome de exibição"), "Banco (admin)")
    await userEvent.click(screen.getByLabelText("Restrito a administradores"))
    await userEvent.click(screen.getByRole("button", { name: "Criar ambiente" }))

    await waitFor(() =>
      expect(mocked.create).toHaveBeenCalledWith("project-1", {
        name: "db-admin",
        display_name: "Banco (admin)",
        restricted: true,
      }),
    )
    await waitFor(() => expect(mocked.list).toHaveBeenCalledTimes(2))
  })

  it("rejects a name the API would refuse", async () => {
    await open()

    await userEvent.type(screen.getByLabelText("Nome"), "Banco Admin")
    await userEvent.click(screen.getByRole("button", { name: "Criar ambiente" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("letras minúsculas, números e hífen")
    expect(mocked.create).not.toHaveBeenCalled()
  })

  it("blocks creating at the limit and shows the way to the plans", async () => {
    await open(SEEDED, plan(3, 3))

    expect(screen.getByText("3 de 3 ambientes")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("limite de 3 ambientes")
    expect(screen.getByRole("link", { name: "Ver planos" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Criar ambiente" })).toBeDisabled()
  })

  it("offers the restriction only on extra environments", async () => {
    await open([...SEEDED, env("backup")])

    expect(within(row("backup")).getByRole("button", { name: "Restringir" })).toBeInTheDocument()
    for (const name of ["production", "staging", "development"]) {
      expect(within(row(name)).queryByRole("button", { name: "Restringir" })).not.toBeInTheDocument()
    }
  })

  it("warns when restricting an environment that was open", async () => {
    mocked.update.mockResolvedValue(env("backup", { restricted: true }))
    await open([...SEEDED, env("backup")])

    await userEvent.click(within(row("backup")).getByRole("button", { name: "Restringir" }))
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveTextContent("O que já foi baixado não volta")
    await userEvent.click(within(dialog).getByRole("button", { name: "Restringir" }))

    await waitFor(() => expect(mocked.update).toHaveBeenCalledWith("project-1", "env-backup", { restricted: true }))
  })

  it("opens a restricted environment to the team again", async () => {
    mocked.update.mockResolvedValue(env("backup"))
    await open([...SEEDED, env("backup", { restricted: true })])

    await userEvent.click(within(row("backup")).getByRole("button", { name: "Abrir ao time" }))

    await waitFor(() => expect(mocked.update).toHaveBeenCalledWith("project-1", "env-backup", { restricted: false }))
  })

  it("archives after confirmation and never offers it for the default one", async () => {
    mocked.remove.mockResolvedValue(undefined)
    await open([...SEEDED, env("backup")])

    expect(within(row("production")).queryByRole("button", { name: "Arquivar" })).not.toBeInTheDocument()
    await userEvent.click(within(row("backup")).getByRole("button", { name: "Arquivar" }))
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveTextContent("o nome não pode ser reutilizado")
    expect(mocked.remove).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole("button", { name: "Arquivar" }))

    await waitFor(() => expect(mocked.remove).toHaveBeenCalledWith("project-1", "env-backup"))
  })

  it("shows a server error without breaking", async () => {
    mocked.create.mockRejectedValue(new ApiError("Plan limit reached: environments_per_project (5)", 402, null))
    await open()

    await userEvent.type(screen.getByLabelText("Nome"), "backup")
    await userEvent.click(screen.getByRole("button", { name: "Criar ambiente" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("limite de ambientes do plano")
    expect(screen.getByText("production")).toBeInTheDocument()
  })
})
