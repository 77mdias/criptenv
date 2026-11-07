import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import { renderWithIntl } from "@/test/render-with-intl"
import { CryptoError } from "@/lib/crypto"
import { ApiError } from "@/lib/api/client"
import * as api from "@/lib/api/personal-vault"
import * as vaultCrypto from "@/lib/personal-vault/crypto"
import { getDashboardNavGroups } from "@/components/layout/dashboard-nav"
import { authApi } from "@/lib/api/auth"
import { useRouter } from "@/i18n/navigation"
import PersonalVaultPage from "../page"

jest.mock("@/lib/api/personal-vault", () => ({
  getPersonalVaultConfig: jest.fn(),
  createPersonalVaultConfig: jest.fn(),
  updatePersonalVaultConfig: jest.fn(),
  listPersonalVaultItems: jest.fn(),
  createPersonalVaultItem: jest.fn(),
  updatePersonalVaultItem: jest.fn(),
  deletePersonalVaultItem: jest.fn(),
  listPersonalVaultFolders: jest.fn(() => Promise.resolve([])),
  isPlanLimitError: jest.fn(() => false),
}))

jest.mock("@/lib/api/me", () => ({
  meApi: { plan: jest.fn(() => Promise.resolve({ id: "free", limits: { personal_vault_items: 120, personal_vault_folders: 10 }, features: [] })) },
}))

jest.mock("@/lib/api/auth", () => ({ authApi: { signout: jest.fn(() => Promise.resolve({ message: "ok" })) } }))

jest.mock("@/lib/personal-vault/crypto", () => ({
  createPersonalVault: jest.fn(),
  unlockVault: jest.fn(),
  recoverVault: jest.fn(),
  decryptSummary: jest.fn(),
  decryptItem: jest.fn(),
  encryptItem: jest.fn(),
  unlockProtectedKey: jest.fn(),
  rewrapMaster: jest.fn(),
  rewrapExtra: jest.fn(),
  decryptFolderName: jest.fn(),
}))

const mocked = <T extends (...args: never[]) => unknown>(fn: T) => fn as unknown as jest.MockedFunction<T>

const envelope = { iv: "A".repeat(16), ciphertext: "B", auth_tag: "C".repeat(24) }
const CONFIG = {
  kdf: "PBKDF2-SHA256",
  iterations: 600_000,
  master_salt: "S".repeat(44),
  extra_salt: "T".repeat(44),
  master_wrapped_vault_key: envelope,
  recovery_wrapped_vault_key: envelope,
  extra_wrapped_protected_key: envelope,
  recovery_wrapped_protected_key: envelope,
}
const SAVED = { ...CONFIG, version: 4, created_at: "2026-11-06T00:00:00Z", updated_at: "2026-11-06T00:00:00Z" }
const KEY = {} as CryptoKey
const ITEM = { id: "i1", protected: false, summary: envelope, body: envelope, version: 1, created_at: "", updated_at: "" }

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function fillPasswords(master: string, extra: string) {
  type("Senha mestra", master)
  type("Confirme a senha mestra", master)
  type("Senha de proteção extra", extra)
  type("Confirme a senha extra", extra)
}

async function openVault() {
  mocked(api.getPersonalVaultConfig).mockResolvedValue(SAVED)
  mocked(vaultCrypto.unlockVault).mockResolvedValue(KEY)
  mocked(api.listPersonalVaultItems).mockResolvedValue([ITEM])
  mocked(vaultCrypto.decryptSummary).mockResolvedValue({ type: "login", title: "Instagram", username: "jean" })
  renderWithIntl(<PersonalVaultPage />)
  await screen.findByLabelText("Senha mestra")
  type("Senha mestra", "mestra-forte-123")
  fireEvent.click(await screen.findByRole("button", { name: "Abrir cofre" }))
  await screen.findByText("Instagram")
}

describe("personal vault page", () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it("asks pre-migration sessions to sign in again instead of a dead-end reload error", async () => {
    mocked(api.getPersonalVaultConfig).mockRejectedValue(
      new ApiError("Sign in again on the web dashboard to use the personal vault", 403, null),
    )
    renderWithIntl(<PersonalVaultPage />)

    expect(
      await screen.findByText("Por segurança, o cofre só abre com um login feito depois desta atualização. Saia e entre de novo."),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Entrar de novo" }))
    await waitFor(() => expect(authApi.signout).toHaveBeenCalled())
    expect(useRouter().push).toHaveBeenCalledWith("/login?redirect=%2Fvault")
  })

  it("shows setup when there is no config", async () => {
    mocked(api.getPersonalVaultConfig).mockResolvedValue(null)
    renderWithIntl(<PersonalVaultPage />)
    expect(await screen.findByRole("heading", { name: "Crie seu cofre pessoal" })).toBeInTheDocument()
  })

  it("setup does not save until the recovery key is confirmed", async () => {
    mocked(api.getPersonalVaultConfig).mockResolvedValue(null)
    mocked(vaultCrypto.createPersonalVault).mockResolvedValue({ config: CONFIG, recoveryKey: "ABCD-EFGH", vaultKey: KEY })
    mocked(api.createPersonalVaultConfig).mockResolvedValue(SAVED)
    mocked(api.listPersonalVaultItems).mockResolvedValue([])
    renderWithIntl(<PersonalVaultPage />)
    await screen.findByRole("heading", { name: "Crie seu cofre pessoal" })

    fillPasswords("mestra-forte-123", "extra-123")
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }))

    expect(await screen.findByText("ABCD-EFGH")).toBeInTheDocument()
    expect(
      screen.getByText("Sem a senha mestra ou esta chave de recuperação, ninguém consegue abrir este cofre, nem a equipe do CriptEnv."),
    ).toBeInTheDocument()
    expect(vaultCrypto.createPersonalVault).toHaveBeenCalledWith("mestra-forte-123", "extra-123")
    const finish = screen.getByRole("button", { name: "Concluir" })
    expect(finish).toBeDisabled()
    expect(api.createPersonalVaultConfig).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText("Guardei a chave de recuperação"))
    fireEvent.click(finish)
    await waitFor(() => expect(api.createPersonalVaultConfig).toHaveBeenCalledTimes(1))
    expect(api.createPersonalVaultConfig).toHaveBeenCalledWith(CONFIG)
    expect(await screen.findByRole("button", { name: "Trancar" })).toBeInTheDocument()
  })

  it("setup rejects short or equal passwords", async () => {
    mocked(api.getPersonalVaultConfig).mockResolvedValue(null)
    renderWithIntl(<PersonalVaultPage />)
    await screen.findByRole("heading", { name: "Crie seu cofre pessoal" })

    fillPasswords("curta-12345", "extra-123")
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }))
    expect(await screen.findByText("A senha mestra precisa ter pelo menos 12 caracteres.")).toBeInTheDocument()

    fillPasswords("mestra-forte-123", "mestra-forte-123")
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }))
    expect(await screen.findByText("A senha extra precisa ser diferente da senha mestra.")).toBeInTheDocument()
    expect(vaultCrypto.createPersonalVault).not.toHaveBeenCalled()
  })

  it("wrong master password shows an error and allows retry", async () => {
    mocked(api.getPersonalVaultConfig).mockResolvedValue(SAVED)
    mocked(vaultCrypto.unlockVault).mockRejectedValue(new CryptoError("nope", "WRONG_PASSWORD"))
    renderWithIntl(<PersonalVaultPage />)

    await screen.findByLabelText("Senha mestra")
    type("Senha mestra", "errada-errada-1")
    fireEvent.click(await screen.findByRole("button", { name: "Abrir cofre" }))

    expect(await screen.findByText("Senha mestra incorreta")).toBeInTheDocument()
    const input = screen.getByLabelText("Senha mestra")
    expect(input).toHaveValue("")
    expect(input).toHaveFocus()
    expect(api.listPersonalVaultItems).not.toHaveBeenCalled()
    expect(vaultCrypto.unlockVault).toHaveBeenCalledWith(SAVED, "errada-errada-1")
  })

  it("locks after 10 minutes idle and clears decrypted content", async () => {
    jest.useFakeTimers({ advanceTimers: true })
    await openVault()

    act(() => {
      jest.advanceTimersByTime(599_000)
    })
    expect(screen.getByText("Instagram")).toBeInTheDocument()
    fireEvent.keyDown(window, { key: "a" })
    act(() => {
      jest.advanceTimersByTime(599_000)
    })
    expect(screen.getByText("Instagram")).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(1_000)
    })
    expect(screen.getByRole("heading", { name: "Cofre trancado" })).toBeInTheDocument()
    expect(screen.queryByText("Instagram")).not.toBeInTheDocument()
  })

  it("locks when the page is hidden, so the back-forward cache never restores it open", async () => {
    await openVault()
    act(() => {
      window.dispatchEvent(new Event("pagehide"))
    })
    expect(screen.getByRole("heading", { name: "Cofre trancado" })).toBeInTheDocument()
    expect(screen.queryByText("Instagram")).not.toBeInTheDocument()
  })

  it("idle lock closes an open reveal dialog and drops its content", async () => {
    jest.useFakeTimers({ advanceTimers: true })
    mocked(vaultCrypto.decryptItem).mockResolvedValue({
      type: "login", title: "Instagram", username: "jean", password: "s3nh@-revelada", url: "", notes: "",
    })
    await openVault()
    fireEvent.click(screen.getByRole("button", { name: "Revelar Instagram" }))
    expect(await screen.findByText("s3nh@-revelada")).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(600_000)
    })
    expect(screen.getByRole("heading", { name: "Cofre trancado" })).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByText("s3nh@-revelada")).not.toBeInTheDocument()
  })

  it("lock button closes the vault", async () => {
    await openVault()
    fireEvent.click(screen.getByRole("button", { name: "Trancar" }))
    expect(screen.getByRole("heading", { name: "Cofre trancado" })).toBeInTheDocument()
    expect(screen.queryByText("Instagram")).not.toBeInTheDocument()
  })

  it("recovery sets new passwords with the printed key and shows a new one", async () => {
    mocked(api.getPersonalVaultConfig).mockResolvedValue(SAVED)
    mocked(vaultCrypto.recoverVault).mockResolvedValue({ config: CONFIG, recoveryKey: "NEW0-KEY1", vaultKey: KEY })
    mocked(api.updatePersonalVaultConfig).mockResolvedValue({ ...SAVED, version: 5 })
    mocked(api.listPersonalVaultItems).mockResolvedValue([])
    renderWithIntl(<PersonalVaultPage />)

    fireEvent.click(await screen.findByRole("button", { name: "Esqueci a senha mestra" }))
    type("Chave de recuperação", "old-key")
    fillPasswords("nova-mestra-456", "nova-extra-4")
    fireEvent.click(screen.getByRole("button", { name: "Recuperar" }))

    expect(await screen.findByText("NEW0-KEY1")).toBeInTheDocument()
    expect(vaultCrypto.recoverVault).toHaveBeenCalledWith(SAVED, "old-key", "nova-mestra-456", "nova-extra-4")
    expect(api.updatePersonalVaultConfig).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText("Guardei a chave de recuperação"))
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))
    await waitFor(() => expect(api.updatePersonalVaultConfig).toHaveBeenCalledWith(CONFIG, 4))
    expect(await screen.findByRole("button", { name: "Trancar" })).toBeInTheDocument()
  })

  it("recovery conflict drops the unsaved key and reloads the config", async () => {
    mocked(api.getPersonalVaultConfig).mockResolvedValueOnce(SAVED).mockResolvedValueOnce({ ...SAVED, version: 9 })
    mocked(vaultCrypto.recoverVault).mockResolvedValue({ config: CONFIG, recoveryKey: "NEW0-KEY1", vaultKey: KEY })
    mocked(api.updatePersonalVaultConfig).mockRejectedValue(new ApiError("Version conflict", 409, null))
    renderWithIntl(<PersonalVaultPage />)

    fireEvent.click(await screen.findByRole("button", { name: "Esqueci a senha mestra" }))
    type("Chave de recuperação", "old-key")
    fillPasswords("nova-mestra-456", "nova-extra-4")
    fireEvent.click(screen.getByRole("button", { name: "Recuperar" }))
    await screen.findByText("NEW0-KEY1")
    fireEvent.click(screen.getByLabelText("Guardei a chave de recuperação"))
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))

    expect(
      await screen.findByText("O cofre mudou em outra aba. A chave mostrada não foi salva e não vale. Faça a recuperação de novo."),
    ).toBeInTheDocument()
    expect(screen.queryByText("NEW0-KEY1")).not.toBeInTheDocument()
    expect(api.getPersonalVaultConfig).toHaveBeenCalledTimes(2)

    fillPasswords("nova-mestra-456", "nova-extra-4")
    type("Chave de recuperação", "old-key")
    fireEvent.click(screen.getByRole("button", { name: "Recuperar" }))
    await screen.findByText("NEW0-KEY1")
    expect(vaultCrypto.recoverVault).toHaveBeenLastCalledWith({ ...SAVED, version: 9 }, "old-key", "nova-mestra-456", "nova-extra-4")
  })

  it("recovery explains an invalid key", async () => {
    mocked(api.getPersonalVaultConfig).mockResolvedValue(SAVED)
    mocked(vaultCrypto.recoverVault).mockRejectedValue(new CryptoError("bad", "INVALID_RECOVERY_KEY"))
    renderWithIntl(<PersonalVaultPage />)

    fireEvent.click(await screen.findByRole("button", { name: "Esqueci a senha mestra" }))
    type("Chave de recuperação", "abc")
    fillPasswords("nova-mestra-456", "nova-extra-4")
    fireEvent.click(screen.getByRole("button", { name: "Recuperar" }))
    expect(await screen.findByText("Chave de recuperação inválida. Confira os caracteres.")).toBeInTheDocument()
  })

  it("nav shows the vault entry", () => {
    expect(getDashboardNavGroups().mainNavItems.map((item) => item.href)).toContain("/vault")
  })
})
