import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { renderWithIntl } from "@/test/render-with-intl"
import { ApiError } from "@/lib/api/client"
import { CryptoError } from "@/lib/crypto"
import * as api from "@/lib/api/personal-vault"
import * as vaultCrypto from "@/lib/personal-vault/crypto"
import { PersonalVaultSessionProvider } from "../_components/vault-session"
import { VaultItems } from "../_components/vault-items"

jest.mock("@/lib/api/personal-vault", () => ({
  getPersonalVaultConfig: jest.fn(),
  createPersonalVaultConfig: jest.fn(),
  updatePersonalVaultConfig: jest.fn(),
  listPersonalVaultItems: jest.fn(),
  createPersonalVaultItem: jest.fn(),
  updatePersonalVaultItem: jest.fn(),
  deletePersonalVaultItem: jest.fn(),
}))

jest.mock("@/lib/personal-vault/crypto", () => ({
  unlockVault: jest.fn(),
  decryptSummary: jest.fn(),
  decryptItem: jest.fn(),
  encryptItem: jest.fn(),
  unlockProtectedKey: jest.fn(),
  rewrapMaster: jest.fn(),
  rewrapExtra: jest.fn(),
}))

const mocked = <T extends (...args: never[]) => unknown>(fn: T) => fn as unknown as jest.MockedFunction<T>

const envelope = { iv: "A".repeat(16), ciphertext: "B", auth_tag: "C".repeat(24) }
const SAVED = {
  kdf: "PBKDF2-SHA256",
  iterations: 600_000,
  master_salt: "S".repeat(44),
  extra_salt: "T".repeat(44),
  master_wrapped_vault_key: envelope,
  recovery_wrapped_vault_key: envelope,
  extra_wrapped_protected_key: envelope,
  recovery_wrapped_protected_key: envelope,
  version: 4,
  created_at: "",
  updated_at: "",
}
const KEY = { name: "vk" } as unknown as CryptoKey
const PK = { name: "pk" } as unknown as CryptoKey
const ENC = { id: "enc", protected: true, summary: envelope, body: envelope }

const item = (id: string, isProtected = false) => ({
  id,
  protected: isProtected,
  summary: { ...envelope, ciphertext: id },
  body: envelope,
  version: 1,
  created_at: "",
  updated_at: "",
})

const SUMMARIES: Record<string, vaultCrypto.ItemSummary> = {
  i1: { type: "login", title: "Instagram", username: "jean", url: "https://instagram.com" },
  i2: { type: "login", title: "GitHub", username: "jean-dev", url: "https://github.com" },
  i3: { type: "note", title: "Wi-Fi" },
}

const onConfigChange = jest.fn()

function renderItems(items = [item("i1", true), item("i2"), item("i3")]) {
  mocked(api.listPersonalVaultItems).mockResolvedValue(items)
  mocked(vaultCrypto.decryptSummary).mockImplementation(async (id) => SUMMARIES[id])
  renderWithIntl(
    <PersonalVaultSessionProvider>
      <VaultItems vaultKey={KEY} config={SAVED} onConfigChange={onConfigChange} />
    </PersonalVaultSessionProvider>,
  )
  return screen.findByText("Instagram")
}

function type(label: string, value: string, container: HTMLElement | Document = document) {
  const scope = container === document ? screen : within(container as HTMLElement)
  fireEvent.change(scope.getByLabelText(label), { target: { value } })
}

describe("vault items", () => {
  it("filters by search and type", async () => {
    await renderItems()
    type("Buscar", "insta")
    expect(screen.getByText("Instagram")).toBeInTheDocument()
    expect(screen.queryByText("GitHub")).not.toBeInTheDocument()

    type("Buscar", "")
    fireEvent.click(screen.getByRole("button", { name: "Notas" }))
    expect(screen.getByText("Wi-Fi")).toBeInTheDocument()
    expect(screen.queryByText("Instagram")).not.toBeInTheDocument()
    expect(screen.queryByText("GitHub")).not.toBeInTheDocument()
  })

  it("protected item asks for the extra password and forgets it", async () => {
    mocked(vaultCrypto.unlockProtectedKey).mockResolvedValue(PK)
    mocked(vaultCrypto.decryptItem).mockResolvedValue({ ...SUMMARIES.i1, password: "s3nh@", notes: "" } as vaultCrypto.PersonalVaultItemPlain)
    await renderItems()

    fireEvent.click(screen.getByRole("button", { name: "Revelar Instagram" }))
    let dialog = await screen.findByRole("dialog")
    type("Senha de proteção extra", "extra-123", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Desbloquear" }))
    expect(await within(dialog).findByText("s3nh@")).toBeInTheDocument()
    expect(vaultCrypto.unlockProtectedKey).toHaveBeenCalledWith(SAVED, KEY, "extra-123")
    expect(vaultCrypto.decryptItem).toHaveBeenCalledWith(item("i1", true), KEY, PK)

    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: "Revelar Instagram" }))
    dialog = await screen.findByRole("dialog")
    expect(within(dialog).queryByText("s3nh@")).not.toBeInTheDocument()
    type("Senha de proteção extra", "extra-123", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Desbloquear" }))
    await within(dialog).findByText("s3nh@")
    expect(vaultCrypto.unlockProtectedKey).toHaveBeenCalledTimes(2)
  })

  it("a wrong extra password is reported", async () => {
    mocked(vaultCrypto.unlockProtectedKey).mockRejectedValue(new CryptoError("no", "WRONG_PASSWORD"))
    await renderItems()
    fireEvent.click(screen.getByRole("button", { name: "Revelar Instagram" }))
    const dialog = await screen.findByRole("dialog")
    type("Senha de proteção extra", "errada-1", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Desbloquear" }))
    expect(await within(dialog).findByText("Senha extra incorreta")).toBeInTheDocument()
    expect(vaultCrypto.decryptItem).not.toHaveBeenCalled()
  })

  it("common items reveal without the extra password", async () => {
    mocked(vaultCrypto.decryptItem).mockResolvedValue({ ...SUMMARIES.i3, content: "senha-do-wifi" } as vaultCrypto.PersonalVaultItemPlain)
    await renderItems()
    fireEvent.click(screen.getByRole("button", { name: "Revelar Wi-Fi" }))
    const dialog = await screen.findByRole("dialog")
    expect(await within(dialog).findByText("senha-do-wifi")).toBeInTheDocument()
    expect(vaultCrypto.decryptItem).toHaveBeenCalledWith(item("i3"), KEY, KEY)
    expect(vaultCrypto.unlockProtectedKey).not.toHaveBeenCalled()
  })

  it("new protected item is encrypted with the protected key", async () => {
    mocked(vaultCrypto.unlockProtectedKey).mockResolvedValue(PK)
    mocked(vaultCrypto.encryptItem).mockResolvedValue(ENC)
    mocked(api.createPersonalVaultItem).mockResolvedValue(item("i9", true))
    await renderItems()

    fireEvent.click(screen.getByRole("button", { name: "Novo item" }))
    const dialog = await screen.findByRole("dialog")
    type("Título", "Banco", dialog)
    type("Usuário", "jean", dialog)
    type("Senha", "1234", dialog)
    fireEvent.click(within(dialog).getByLabelText("Proteção extra"))
    type("Senha de proteção extra", "extra-123", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }))

    await waitFor(() => expect(api.createPersonalVaultItem).toHaveBeenCalledWith(ENC))
    expect(vaultCrypto.unlockProtectedKey).toHaveBeenCalledWith(SAVED, KEY, "extra-123")
    expect(vaultCrypto.encryptItem).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
      { type: "login", title: "Banco", username: "jean", password: "1234", url: "", notes: "" },
      KEY,
      PK,
    )
    await waitFor(() => expect(api.listPersonalVaultItems).toHaveBeenCalledTimes(2))
  })

  it("version conflict reloads instead of overwriting", async () => {
    mocked(vaultCrypto.decryptItem).mockResolvedValue({ ...SUMMARIES.i2, password: "x", notes: "" } as vaultCrypto.PersonalVaultItemPlain)
    mocked(vaultCrypto.encryptItem).mockResolvedValue({ ...ENC, protected: false })
    mocked(api.updatePersonalVaultItem).mockRejectedValue(new ApiError("Version conflict", 409, null))
    await renderItems()

    fireEvent.click(screen.getByRole("button", { name: "Editar GitHub" }))
    const dialog = await screen.findByRole("dialog")
    await waitFor(() => expect(within(dialog).getByLabelText("Título")).toHaveValue("GitHub"))
    type("Título", "GitHub pessoal", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }))

    expect(await screen.findByText("Este item mudou em outra aba. Recarregamos a versão mais recente.")).toBeInTheDocument()
    expect(api.updatePersonalVaultItem).toHaveBeenCalledTimes(1)
    expect(api.updatePersonalVaultItem).toHaveBeenCalledWith("i2", { ...ENC, protected: false }, 1)
    expect(vaultCrypto.encryptItem).toHaveBeenCalledWith("i2", expect.anything(), KEY, null)
    await waitFor(() => expect(api.listPersonalVaultItems).toHaveBeenCalledTimes(2))
  })

  it("deletes after confirmation", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true)
    mocked(api.deletePersonalVaultItem).mockResolvedValue(undefined)
    await renderItems()
    fireEvent.click(screen.getByRole("button", { name: "Apagar Wi-Fi" }))
    await waitFor(() => expect(api.deletePersonalVaultItem).toHaveBeenCalledWith("i3"))
    await waitFor(() => expect(api.listPersonalVaultItems).toHaveBeenCalledTimes(2))
  })

  it("change master password sends the rewrapped config with the current version", async () => {
    mocked(vaultCrypto.unlockProtectedKey).mockRejectedValue(new CryptoError("no", "WRONG_PASSWORD"))
    const next = { ...SAVED, master_salt: "N".repeat(44) }
    mocked(vaultCrypto.rewrapMaster).mockResolvedValue(next)
    mocked(api.updatePersonalVaultConfig).mockResolvedValue({ ...next, version: 5 })
    await renderItems()

    fireEvent.click(screen.getByRole("button", { name: "Configurações" }))
    const dialog = await screen.findByRole("dialog")
    type("Senha mestra atual", "mestra-forte-123", dialog)
    type("Nova senha mestra", "outra-mestra-789", dialog)
    type("Confirme a nova senha mestra", "outra-mestra-789", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Trocar senha mestra" }))

    await waitFor(() => expect(api.updatePersonalVaultConfig).toHaveBeenCalledWith(next, 4))
    expect(vaultCrypto.rewrapMaster).toHaveBeenCalledWith(SAVED, "mestra-forte-123", "outra-mestra-789")
    expect(onConfigChange).toHaveBeenCalledWith({ ...next, version: 5 })
  })

  it("change extra password reports a wrong current password", async () => {
    mocked(vaultCrypto.unlockVault).mockRejectedValue(new CryptoError("no", "WRONG_PASSWORD"))
    mocked(vaultCrypto.rewrapExtra).mockRejectedValue(new CryptoError("no", "WRONG_PASSWORD"))
    await renderItems()

    fireEvent.click(screen.getByRole("button", { name: "Configurações" }))
    const dialog = await screen.findByRole("dialog")
    type("Senha extra atual", "errada-1", dialog)
    type("Nova senha extra", "nova-extra-9", dialog)
    type("Confirme a nova senha extra", "nova-extra-9", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Trocar senha extra" }))

    expect(await within(dialog).findByText("Senha atual incorreta")).toBeInTheDocument()
    expect(vaultCrypto.rewrapExtra).toHaveBeenCalledWith(SAVED, KEY, "errada-1", "nova-extra-9")
    expect(api.updatePersonalVaultConfig).not.toHaveBeenCalled()
  })

  it("a config conflict reloads the config so the next try uses the new version", async () => {
    mocked(vaultCrypto.unlockProtectedKey).mockRejectedValue(new CryptoError("no", "WRONG_PASSWORD"))
    const fresh = { ...SAVED, version: 7 }
    mocked(vaultCrypto.rewrapMaster).mockResolvedValue(SAVED)
    mocked(api.updatePersonalVaultConfig).mockRejectedValue(new ApiError("Version conflict", 409, null))
    mocked(api.getPersonalVaultConfig).mockResolvedValue(fresh)
    await renderItems()

    fireEvent.click(screen.getByRole("button", { name: "Configurações" }))
    const dialog = await screen.findByRole("dialog")
    type("Senha mestra atual", "mestra-forte-123", dialog)
    type("Nova senha mestra", "outra-mestra-789", dialog)
    type("Confirme a nova senha mestra", "outra-mestra-789", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Trocar senha mestra" }))

    expect(
      await within(dialog).findByText("O cofre mudou em outra aba. Recarregamos a versão mais recente. Tente de novo."),
    ).toBeInTheDocument()
    expect(onConfigChange).toHaveBeenCalledWith(fresh)
  })

  it("editing cannot save before the item is decrypted, so nothing gets blanked", async () => {
    mocked(vaultCrypto.decryptItem).mockRejectedValue(new CryptoError("bad", "DECRYPTION_FAILED"))
    await renderItems()

    fireEvent.click(screen.getByRole("button", { name: "Editar GitHub" }))
    const dialog = await screen.findByRole("dialog")
    expect(await within(dialog).findByRole("alert")).toBeInTheDocument()
    type("Título", "GitHub", dialog)
    expect(within(dialog).getByRole("button", { name: "Salvar" })).toBeDisabled()
    fireEvent.submit(within(dialog).getByLabelText("Título").closest("form")!)
    expect(vaultCrypto.encryptItem).not.toHaveBeenCalled()
    expect(api.updatePersonalVaultItem).not.toHaveBeenCalled()
  })

  it("a new master password cannot equal the extra password", async () => {
    mocked(vaultCrypto.unlockProtectedKey).mockResolvedValue(PK)
    await renderItems()
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }))
    const dialog = await screen.findByRole("dialog")
    type("Senha mestra atual", "mestra-forte-123", dialog)
    type("Nova senha mestra", "outra-mestra-789", dialog)
    type("Confirme a nova senha mestra", "outra-mestra-789", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Trocar senha mestra" }))

    expect(await within(dialog).findByText("A senha extra precisa ser diferente da senha mestra.")).toBeInTheDocument()
    expect(vaultCrypto.unlockProtectedKey).toHaveBeenCalledWith(SAVED, KEY, "outra-mestra-789")
    expect(vaultCrypto.rewrapMaster).not.toHaveBeenCalled()
    expect(api.updatePersonalVaultConfig).not.toHaveBeenCalled()
  })

  it("a new extra password cannot equal the master password", async () => {
    mocked(vaultCrypto.unlockVault).mockResolvedValue(KEY)
    await renderItems()
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }))
    const dialog = await screen.findByRole("dialog")
    type("Senha extra atual", "extra-123", dialog)
    type("Nova senha extra", "mestra-forte-123", dialog)
    type("Confirme a nova senha extra", "mestra-forte-123", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Trocar senha extra" }))

    expect(await within(dialog).findByText("A senha extra precisa ser diferente da senha mestra.")).toBeInTheDocument()
    expect(vaultCrypto.unlockVault).toHaveBeenCalledWith(SAVED, "mestra-forte-123")
    expect(vaultCrypto.rewrapExtra).not.toHaveBeenCalled()
  })

  it("editing an item deleted elsewhere shows a notice and reloads", async () => {
    mocked(vaultCrypto.decryptItem).mockResolvedValue({ ...SUMMARIES.i2, password: "x", notes: "" } as vaultCrypto.PersonalVaultItemPlain)
    mocked(vaultCrypto.encryptItem).mockResolvedValue({ ...ENC, protected: false })
    mocked(api.updatePersonalVaultItem).mockRejectedValue(new ApiError("Item not found", 404, null))
    await renderItems()

    fireEvent.click(screen.getByRole("button", { name: "Editar GitHub" }))
    const dialog = await screen.findByRole("dialog")
    await waitFor(() => expect(within(dialog).getByLabelText("Título")).toHaveValue("GitHub"))
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }))

    expect(await screen.findByText("Este item foi apagado em outra aba.")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(api.listPersonalVaultItems).toHaveBeenCalledTimes(2))
    expect(api.updatePersonalVaultItem).toHaveBeenCalledTimes(1)
  })

  it("deleting an item already deleted elsewhere just reloads", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true)
    mocked(api.deletePersonalVaultItem).mockRejectedValue(new ApiError("Item not found", 404, null))
    await renderItems()
    fireEvent.click(screen.getByRole("button", { name: "Apagar Wi-Fi" }))
    await waitFor(() => expect(api.listPersonalVaultItems).toHaveBeenCalledTimes(2))
    expect(screen.queryByText("Não foi possível salvar. Tente de novo.")).not.toBeInTheDocument()
  })
})
