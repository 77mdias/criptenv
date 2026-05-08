import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { unlockProjectVault } from "@/lib/crypto"
import { VaultUnlockPanel } from "../vault-unlock-panel"

jest.mock("@/lib/crypto", () => ({
  unlockProjectVault: jest.fn(),
}))

const mockedUnlockProjectVault = jest.mocked(unlockProjectVault)

const vaultConfig = {
  version: 1,
  kdf: "PBKDF2-SHA256",
  iterations: 100000,
  salt: "salt",
  proof_salt: "proof-salt",
  verifier_iv: "iv",
  verifier_ciphertext: "ciphertext",
  verifier_auth_tag: "auth-tag",
}

describe("VaultUnlockPanel", () => {
  beforeEach(() => {
    mockedUnlockProjectVault.mockReset()
  })

  it("disables submit when no password or config is available", () => {
    render(<VaultUnlockPanel vaultConfig={null} onUnlock={jest.fn()} />)

    expect(screen.getByRole("button", { name: "Desbloquear" })).toBeDisabled()
    expect(screen.getByText(/não tem configuração de vault/i)).toBeInTheDocument()
  })

  it("unlocks with valid vault material", async () => {
    const material = { keyMaterial: {} as CryptoKey, vaultProof: "proof" }
    const onUnlock = jest.fn()
    mockedUnlockProjectVault.mockResolvedValue(material)

    render(<VaultUnlockPanel vaultConfig={vaultConfig} onUnlock={onUnlock} />)
    await userEvent.type(screen.getByLabelText("Senha mestra"), "VaultPassw0rd!")
    await userEvent.click(screen.getByRole("button", { name: "Desbloquear" }))

    await waitFor(() => expect(onUnlock).toHaveBeenCalledWith(material))
    expect(mockedUnlockProjectVault).toHaveBeenCalledWith("VaultPassw0rd!", vaultConfig)
  })

  it("shows an error when unlock fails", async () => {
    mockedUnlockProjectVault.mockRejectedValue(new Error("bad password"))

    render(<VaultUnlockPanel vaultConfig={vaultConfig} onUnlock={jest.fn()} />)
    await userEvent.type(screen.getByLabelText("Senha mestra"), "wrong-password")
    await userEvent.click(screen.getByRole("button", { name: "Desbloquear" }))

    expect(await screen.findByText("Não foi possível desbloquear o vault com essa senha.")).toBeInTheDocument()
  })
})
