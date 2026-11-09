import { useState } from "react"
import { screen, waitFor } from "@testing-library/react"
import { renderWithIntl } from "@/test/render-with-intl"
import userEvent from "@testing-library/user-event"
import { buildProjectVaultConfig } from "@/lib/crypto"
import { projectsApi } from "@/lib/api"
import { ApiError } from "@/lib/api/client"
import { meApi, type Plan } from "@/lib/api/me"
import { CreateProjectDialog } from "../create-project-dialog"

jest.mock("@/lib/crypto", () => ({
  buildProjectVaultConfig: jest.fn(),
}))

jest.mock("@/lib/api", () => ({
  projectsApi: {
    create: jest.fn(),
  },
}))

jest.mock("@/lib/api/me", () => ({
  meApi: {
    plan: jest.fn(),
  },
}))

const mockedBuildProjectVaultConfig = jest.mocked(buildProjectVaultConfig)
const mockedCreateProject = jest.mocked(projectsApi.create)
const mockedPlan = jest.mocked(meApi.plan)

function freePlan(projects: number): Plan {
  return {
    id: "free",
    features: [],
    usage: { projects },
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

async function fillAndSubmit() {
  mockedBuildProjectVaultConfig.mockResolvedValue({
    vaultConfig: {} as Awaited<ReturnType<typeof buildProjectVaultConfig>>["vaultConfig"],
    vaultProof: "proof",
  })
  await userEvent.type(screen.getByLabelText("Nome do projeto"), "my-api")
  await userEvent.type(screen.getByLabelText("Senha do vault"), "VaultPassw0rd!")
  await userEvent.type(screen.getByLabelText("Confirmar senha do vault"), "VaultPassw0rd!")
  await userEvent.click(screen.getByRole("button", { name: "Criar Projeto" }))
}

describe("CreateProjectDialog", () => {
  beforeEach(() => {
    mockedBuildProjectVaultConfig.mockReset()
    mockedCreateProject.mockReset()
    // Plan unknown unless a test says otherwise: nothing is shown or disabled.
    mockedPlan.mockReset()
    mockedPlan.mockRejectedValue(new Error("offline"))
  })

  it("renders nothing when closed", () => {
    const { container } = renderWithIntl(
      <CreateProjectDialog open={false} onOpenChange={jest.fn()} onSuccess={jest.fn()} />
    )

    expect(container.firstChild).toBeNull()
  })

  it("validates vault password confirmation", async () => {
    renderWithIntl(<CreateProjectDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />)

    await userEvent.type(screen.getByLabelText("Nome do projeto"), "my-api")
    await userEvent.type(screen.getByLabelText("Senha do vault"), "VaultPassw0rd!")
    await userEvent.type(screen.getByLabelText("Confirmar senha do vault"), "DifferentPassw0rd!")
    await userEvent.click(screen.getByRole("button", { name: "Criar Projeto" }))

    expect(await screen.findByText("Senhas do vault não conferem")).toBeInTheDocument()
    expect(mockedCreateProject).not.toHaveBeenCalled()
  })

  it("builds vault config and creates a project", async () => {
    const onOpenChange = jest.fn()
    const onSuccess = jest.fn()
    mockedBuildProjectVaultConfig.mockResolvedValue({
      vaultConfig: {
        version: 1,
        kdf: "PBKDF2-SHA256",
        iterations: 100000,
        salt: "salt",
        proof_salt: "proof-salt",
        verifier_iv: "iv",
        verifier_ciphertext: "ciphertext",
        verifier_auth_tag: "auth-tag",
      },
      vaultProof: "proof",
    })
    mockedCreateProject.mockResolvedValue({ id: "project-id" } as Awaited<ReturnType<typeof projectsApi.create>>)

    renderWithIntl(<CreateProjectDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} />)
    await userEvent.type(screen.getByLabelText("Nome do projeto"), "my-api")
    await userEvent.type(screen.getByLabelText("Descrição"), "API project")
    await userEvent.type(screen.getByLabelText("Senha do vault"), "VaultPassw0rd!")
    await userEvent.type(screen.getByLabelText("Confirmar senha do vault"), "VaultPassw0rd!")
    await userEvent.click(screen.getByRole("button", { name: "Criar Projeto" }))

    await waitFor(() =>
      expect(mockedCreateProject).toHaveBeenCalledWith({
        name: "my-api",
        description: "API project",
        vault_config: expect.objectContaining({ version: 1 }),
        vault_proof: "proof",
      })
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onSuccess).toHaveBeenCalled()
  })

  it("shows project usage and leaves create enabled below the limit", async () => {
    mockedPlan.mockResolvedValue(freePlan(2))
    renderWithIntl(<CreateProjectDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />)

    expect(await screen.findByText("2 de 3 projetos")).toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Criar Projeto" })).toBeEnabled()
  })

  it("disables create and explains why at the limit", async () => {
    mockedPlan.mockResolvedValue(freePlan(3))
    renderWithIntl(<CreateProjectDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />)

    expect(await screen.findByRole("status")).toHaveTextContent("limite de 3 projetos")
    expect(screen.getByRole("button", { name: "Criar Projeto" })).toBeDisabled()
  })

  it("shows the limit notice instead of the raw error on a 402", async () => {
    mockedCreateProject.mockRejectedValue(
      new ApiError("Plan limit reached: projects (3)", 402, { detail: "Plan limit reached: projects (3)" })
    )
    renderWithIntl(<CreateProjectDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />)
    await fillAndSubmit()

    expect(await screen.findByRole("status")).toHaveTextContent("O limite do plano foi atingido.")
    expect(screen.queryByText(/Plan limit reached/)).not.toBeInTheDocument()
  })

  it("keeps the API message for other failures", async () => {
    mockedCreateProject.mockRejectedValue(new ApiError("Project with this name already exists", 409, {}))
    renderWithIntl(<CreateProjectDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />)
    await fillAndSubmit()

    expect(await screen.findByText("Project with this name already exists")).toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("loads the plan again each time the dialog opens", async () => {
    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button onClick={() => setOpen(true)}>reopen</button>
          <CreateProjectDialog open={open} onOpenChange={setOpen} onSuccess={jest.fn()} />
        </>
      )
    }
    mockedPlan.mockResolvedValue(freePlan(1))
    renderWithIntl(<Harness />)
    expect(await screen.findByText("1 de 3 projetos")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    mockedPlan.mockResolvedValue(freePlan(2))
    await userEvent.click(screen.getByRole("button", { name: "reopen" }))

    expect(await screen.findByText("2 de 3 projetos")).toBeInTheDocument()
    expect(mockedPlan).toHaveBeenCalledTimes(2)
  })
})
