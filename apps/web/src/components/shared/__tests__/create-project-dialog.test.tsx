import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { buildProjectVaultConfig } from "@/lib/crypto"
import { projectsApi } from "@/lib/api"
import { CreateProjectDialog } from "../create-project-dialog"

jest.mock("@/lib/crypto", () => ({
  buildProjectVaultConfig: jest.fn(),
}))

jest.mock("@/lib/api", () => ({
  projectsApi: {
    create: jest.fn(),
  },
}))

const mockedBuildProjectVaultConfig = jest.mocked(buildProjectVaultConfig)
const mockedCreateProject = jest.mocked(projectsApi.create)

describe("CreateProjectDialog", () => {
  beforeEach(() => {
    mockedBuildProjectVaultConfig.mockReset()
    mockedCreateProject.mockReset()
  })

  it("renders nothing when closed", () => {
    const { container } = render(
      <CreateProjectDialog open={false} onOpenChange={jest.fn()} onSuccess={jest.fn()} />
    )

    expect(container.firstChild).toBeNull()
  })

  it("validates vault password confirmation", async () => {
    render(<CreateProjectDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />)

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

    render(<CreateProjectDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} />)
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
})
