import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { renderWithIntl } from "@/test/render-with-intl"
import { ApiError } from "@/lib/api/client"
import { CryptoError } from "@/lib/crypto"
import * as api from "@/lib/api/personal-vault"
import { meApi, type Plan } from "@/lib/api/me"
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
  listPersonalVaultFolders: jest.fn(),
  createPersonalVaultFolder: jest.fn(),
  updatePersonalVaultFolder: jest.fn(),
  deletePersonalVaultFolder: jest.fn(),
  isPlanLimitError: jest.requireActual("@/lib/api/personal-vault").isPlanLimitError,
}))

jest.mock("@/lib/api/me", () => ({ meApi: { plan: jest.fn() } }))

jest.mock("@/lib/personal-vault/crypto", () => ({
  unlockVault: jest.fn(),
  decryptSummary: jest.fn(),
  decryptItem: jest.fn(),
  encryptItem: jest.fn(),
  unlockProtectedKey: jest.fn(),
  rewrapMaster: jest.fn(),
  rewrapExtra: jest.fn(),
  encryptFolderName: jest.fn(),
  decryptFolderName: jest.fn(),
  resealSummary: jest.fn(),
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

const FREE: Plan = { id: "free", limits: { personal_vault_items: 120, personal_vault_folders: 10 }, features: [] }
const folder = (id: string, version = 1) => ({ id, name: { ...envelope, ciphertext: id }, version, created_at: "", updated_at: "" })

function renderItems(
  items = [item("i1", true), item("i2"), item("i3")],
  {
    folders = [] as ReturnType<typeof folder>[],
    names = {} as Record<string, string>,
    summaries = SUMMARIES,
    plan = Promise.resolve(FREE) as Promise<Plan>,
  } = {},
) {
  mocked(api.listPersonalVaultItems).mockResolvedValue(items)
  mocked(api.listPersonalVaultFolders).mockResolvedValue(folders)
  mocked(meApi.plan).mockReturnValue(plan)
  mocked(vaultCrypto.decryptSummary).mockImplementation(async (id) => summaries[id])
  mocked(vaultCrypto.decryptFolderName).mockImplementation(async (id) => {
    if (!(id in names)) throw new CryptoError("bad", "DECRYPTION_FAILED")
    return names[id]
  })
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

  it("mobile menu holds the item actions", async () => {
    mocked(vaultCrypto.decryptItem).mockResolvedValue({ ...SUMMARIES.i2, password: "x", notes: "" } as vaultCrypto.PersonalVaultItemPlain)
    await renderItems()

    fireEvent.keyDown(screen.getByRole("button", { name: "Ações de GitHub" }), { key: "Enter" })
    const menu = await screen.findByRole("menu")
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Copiar usuário",
      "Revelar",
      "Mover para pasta",
      "Editar",
      "Apagar",
    ])

    fireEvent.click(within(menu).getByRole("menuitem", { name: "Editar" }))
    const dialog = await screen.findByRole("dialog")
    await waitFor(() => expect(within(dialog).getByLabelText("Título")).toHaveValue("GitHub"))
  })

  it("mobile menu of a note has no copy username", async () => {
    await renderItems()
    fireEvent.keyDown(screen.getByRole("button", { name: "Ações de Wi-Fi" }), { key: "Enter" })
    const menu = await screen.findByRole("menu")
    expect(within(menu).queryByRole("menuitem", { name: "Copiar usuário" })).not.toBeInTheDocument()
    expect(within(menu).getByRole("menuitem", { name: "Apagar" })).toBeInTheDocument()
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

  it("an undecryptable item is listed as unreadable and the rest still shows", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true)
    mocked(api.deletePersonalVaultItem).mockResolvedValue(undefined)
    mocked(api.listPersonalVaultItems).mockResolvedValue([item("i1", true), item("i2"), item("i3")])
    mocked(vaultCrypto.decryptSummary).mockImplementation(async (id) => {
      if (id === "i2") throw new CryptoError("bad", "DECRYPTION_FAILED")
      return SUMMARIES[id]
    })
    renderWithIntl(
      <PersonalVaultSessionProvider>
        <VaultItems vaultKey={KEY} config={SAVED} onConfigChange={onConfigChange} />
      </PersonalVaultSessionProvider>,
    )

    expect(await screen.findByText("Instagram")).toBeInTheDocument()
    expect(screen.getByText("Wi-Fi")).toBeInTheDocument()
    expect(screen.getByText("Item ilegível")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Revelar Item ilegível|Editar Item ilegível/ })).not.toBeInTheDocument()

    type("Buscar", "ileg")
    expect(screen.queryByText("Item ilegível")).not.toBeInTheDocument()
    type("Buscar", "")

    fireEvent.click(screen.getByRole("button", { name: "Apagar Item ilegível" }))
    await waitFor(() => expect(api.deletePersonalVaultItem).toHaveBeenCalledWith("i2"))
  })

  it("a create retried after a lost response saves the latest edits over the landed copy", async () => {
    mocked(vaultCrypto.encryptItem).mockResolvedValue({ ...ENC, protected: false })
    mocked(api.createPersonalVaultItem).mockRejectedValue(new ApiError("Item id already exists", 409, null))
    mocked(api.updatePersonalVaultItem).mockResolvedValue(item("enc"))
    await renderItems()

    fireEvent.click(screen.getByRole("button", { name: "Novo item" }))
    const dialog = await screen.findByRole("dialog")
    type("Título", "Banco", dialog)
    type("Senha", "P2", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }))

    await waitFor(() => expect(api.updatePersonalVaultItem).toHaveBeenCalledTimes(1))
    const [createdId] = mocked(vaultCrypto.encryptItem).mock.calls[0]
    expect(api.updatePersonalVaultItem).toHaveBeenCalledWith(createdId, { ...ENC, protected: false }, 1)
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(api.listPersonalVaultItems).toHaveBeenCalledTimes(2))
    expect(screen.queryByText("Este item mudou em outra aba. Recarregamos a versão mais recente.")).not.toBeInTheDocument()
  })

  it("if the landed copy was edited elsewhere, the retry reports a conflict instead", async () => {
    mocked(vaultCrypto.encryptItem).mockResolvedValue({ ...ENC, protected: false })
    mocked(api.createPersonalVaultItem).mockRejectedValue(new ApiError("Item id already exists", 409, null))
    mocked(api.updatePersonalVaultItem).mockRejectedValue(new ApiError("Version conflict", 409, null))
    await renderItems()

    fireEvent.click(screen.getByRole("button", { name: "Novo item" }))
    const dialog = await screen.findByRole("dialog")
    type("Título", "Banco", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }))

    expect(await screen.findByText("Este item mudou em outra aba. Recarregamos a versão mais recente.")).toBeInTheDocument()
    expect(api.updatePersonalVaultItem).toHaveBeenCalledTimes(1)
  })

  it("a 402 when creating an item shows the item limit notice", async () => {
    mocked(vaultCrypto.encryptItem).mockResolvedValue({ ...ENC, protected: false })
    mocked(api.createPersonalVaultItem).mockRejectedValue(new ApiError("Plan limit reached", 402, null))
    await renderItems()

    fireEvent.click(screen.getByRole("button", { name: "Novo item" }))
    const dialog = await screen.findByRole("dialog")
    type("Título", "Banco", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }))

    expect(await screen.findByText("Você chegou ao limite de itens do plano gratuito.")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })
})

describe("site icons", () => {
  beforeEach(() => localStorage.clear())

  it("shows the site icon for logins with a URL, not for notes", async () => {
    await renderItems()
    await screen.findByText("Wi-Fi")
    expect(document.querySelector('img[src$="/api/v1/icons/instagram.com/icon.png"]')).not.toBeNull()
    expect(document.querySelectorAll("img")).toHaveLength(2)
  })

  it("falls back to the key icon when the image fails", async () => {
    await renderItems()
    const img = document.querySelector('img[src$="/api/v1/icons/github.com/icon.png"]')!
    const row = img.closest("li")!
    fireEvent.error(img)
    expect(row.querySelector("img")).toBeNull()
    expect(row.querySelector(".lucide-key-round")).not.toBeNull()
  })

  it("turning icons off in settings hides them at once and remembers it", async () => {
    await renderItems()
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }))
    fireEvent.click(await screen.findByRole("checkbox", { name: "Mostrar ícones de sites" }))
    expect(document.querySelector("img")).toBeNull()
    expect(localStorage.getItem("criptenv:vault:site-icons")).toBe("off")
  })

  it("starts with icons off when this browser saved off", async () => {
    localStorage.setItem("criptenv:vault:site-icons", "off")
    await renderItems()
    expect(document.querySelector("img")).toBeNull()
  })
})

describe("folders", () => {
  const IN_FOLDERS: Record<string, vaultCrypto.ItemSummary> = {
    i1: { ...SUMMARIES.i1, folderId: "f1" },
    i2: { ...SUMMARIES.i2, folderId: "f2" },
    i3: { ...SUMMARIES.i3, folderId: "f1" },
  }
  const TWO = { folders: [folder("f1"), folder("f2")], names: { f1: "Trabalho", f2: "Pessoal" } }
  const column = () => within(screen.getByRole("navigation", { name: "Pastas" }))

  it("lists folders alphabetically with counts and filters together with the type filter", async () => {
    await renderItems(undefined, { ...TWO, summaries: IN_FOLDERS })
    const names = column().getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent)
    expect(names.slice(0, 4)).toEqual(["Todas, 3 itens", "Pessoal, 1 item", "Trabalho, 2 itens", "Sem pasta, 0 itens"])

    fireEvent.click(column().getByRole("button", { name: "Trabalho, 2 itens" }))
    expect(screen.getByRole("heading", { name: "Trabalho" })).toBeInTheDocument()
    expect(screen.getByText("Instagram")).toBeInTheDocument()
    expect(screen.getByText("Wi-Fi")).toBeInTheDocument()
    expect(screen.queryByText("GitHub")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Logins" }))
    expect(screen.getByText("Instagram")).toBeInTheDocument()
    expect(screen.queryByText("Wi-Fi")).not.toBeInTheDocument()
  })

  it("items without a folder or pointing to a deleted folder are under Sem pasta", async () => {
    const summaries = { i1: SUMMARIES.i1, i2: { ...SUMMARIES.i2, folderId: "gone" }, i3: { ...SUMMARIES.i3, folderId: "f1" } }
    await renderItems(undefined, { folders: [folder("f1")], names: { f1: "Trabalho" }, summaries })
    expect(column().getByRole("button", { name: "Todas, 3 itens" })).toBeInTheDocument()
    fireEvent.click(column().getByRole("button", { name: "Sem pasta, 2 itens" }))
    expect(screen.getByText("Instagram")).toBeInTheDocument()
    expect(screen.getByText("GitHub")).toBeInTheDocument()
    expect(screen.queryByText("Wi-Fi")).not.toBeInTheDocument()
  })

  it("creates a folder with an encrypted name", async () => {
    mocked(vaultCrypto.encryptFolderName).mockResolvedValue(envelope)
    mocked(api.createPersonalVaultFolder).mockResolvedValue(folder("new"))
    await renderItems()
    fireEvent.click(column().getByRole("button", { name: "Nova pasta" }))
    const dialog = await screen.findByRole("dialog")
    type("Nome", "  Trabalho  ", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }))

    await waitFor(() => expect(api.createPersonalVaultFolder).toHaveBeenCalledTimes(1))
    const [id, name, key] = mocked(vaultCrypto.encryptFolderName).mock.calls[0]
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect([name, key]).toEqual(["Trabalho", KEY])
    expect(api.createPersonalVaultFolder).toHaveBeenCalledWith({ id, name: envelope })
    await waitFor(() => expect(api.listPersonalVaultFolders).toHaveBeenCalledTimes(2))
  })

  it("refuses an empty or too long folder name", async () => {
    await renderItems()
    fireEvent.click(column().getByRole("button", { name: "Nova pasta" }))
    const dialog = await screen.findByRole("dialog")
    type("Nome", "   ", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }))
    expect(await within(dialog).findByText("Dê um nome à pasta.")).toBeInTheDocument()
    type("Nome", "x".repeat(101), dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }))
    expect(await within(dialog).findByText("Use até 100 caracteres.")).toBeInTheDocument()
    expect(vaultCrypto.encryptFolderName).not.toHaveBeenCalled()
    expect(api.createPersonalVaultFolder).not.toHaveBeenCalled()
  })

  it("renames and deletes the selected folder without touching items", async () => {
    mocked(vaultCrypto.encryptFolderName).mockResolvedValue(envelope)
    mocked(api.updatePersonalVaultFolder).mockResolvedValue(folder("f1", 2))
    mocked(api.deletePersonalVaultFolder).mockResolvedValue(undefined)
    jest.spyOn(window, "confirm").mockReturnValue(true)
    await renderItems(undefined, { ...TWO, summaries: IN_FOLDERS })

    fireEvent.click(column().getByRole("button", { name: "Trabalho, 2 itens" }))
    fireEvent.click(screen.getByRole("button", { name: "Renomear Trabalho" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByLabelText("Nome")).toHaveValue("Trabalho")
    type("Nome", "Clientes", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(api.updatePersonalVaultFolder).toHaveBeenCalledWith("f1", envelope, 1))
    expect(vaultCrypto.encryptFolderName).toHaveBeenCalledWith("f1", "Clientes", KEY)
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: "Apagar Trabalho" }))
    expect(window.confirm).toHaveBeenCalledWith('Apagar a pasta "Trabalho"? Os itens dela vão para Sem pasta.')
    await waitFor(() => expect(api.deletePersonalVaultFolder).toHaveBeenCalledWith("f1"))
    expect(await screen.findByRole("heading", { name: "Todas" })).toBeInTheDocument()
    expect(api.updatePersonalVaultItem).not.toHaveBeenCalled()
  })

  it("an unreadable folder can only be deleted", async () => {
    await renderItems(undefined, { folders: [folder("f1"), folder("bad")], names: { f1: "Trabalho" },
      summaries: { ...IN_FOLDERS, i2: { ...SUMMARIES.i2, folderId: "bad" } } })
    fireEvent.click(column().getByRole("button", { name: "Pasta ilegível, 1 item" }))
    expect(screen.getByText("GitHub")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Apagar Pasta ilegível" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Renomear/ })).not.toBeInTheDocument()
  })

  it("shows usage and disables creation at the plan limit", async () => {
    const plan = Promise.resolve({ ...FREE, limits: { personal_vault_items: 3, personal_vault_folders: 2 } })
    await renderItems(undefined, { ...TWO, summaries: IN_FOLDERS, plan })
    expect(await screen.findByText("2 de 2 pastas")).toBeInTheDocument()
    expect(screen.getByText("3 de 3 itens")).toBeInTheDocument()
    expect(column().getByRole("button", { name: "Nova pasta" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Novo item" })).toBeDisabled()
    expect(screen.getByText("Você chegou ao limite de pastas do plano gratuito.")).toBeInTheDocument()
    expect(screen.getByText("Você chegou ao limite de itens do plano gratuito.")).toBeInTheDocument()
  })

  it("an unlimited plan shows plain counts and never disables creation", async () => {
    const plan = Promise.resolve({ ...FREE, id: "unlimited", limits: { personal_vault_items: null, personal_vault_folders: null } })
    await renderItems(undefined, { ...TWO, summaries: IN_FOLDERS, plan })
    expect(await screen.findByText("2 pastas")).toBeInTheDocument()
    expect(screen.getByText("3 itens")).toBeInTheDocument()
    expect(column().getByRole("button", { name: "Nova pasta" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Novo item" })).toBeEnabled()
  })

  it("a 402 from the server shows the limit notice", async () => {
    mocked(vaultCrypto.encryptFolderName).mockResolvedValue(envelope)
    mocked(api.createPersonalVaultFolder).mockRejectedValue(new ApiError("Plan limit reached", 402, null))
    await renderItems()
    fireEvent.click(column().getByRole("button", { name: "Nova pasta" }))
    const dialog = await screen.findByRole("dialog")
    type("Nome", "Trabalho", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }))
    expect(await screen.findByText("Você chegou ao limite de pastas do plano gratuito.")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("when the plan cannot load, creation stays enabled and no usage is shown", async () => {
    await renderItems(undefined, { ...TWO, summaries: IN_FOLDERS, plan: Promise.reject(new Error("offline")) })
    await waitFor(() => expect(meApi.plan).toHaveBeenCalled())
    expect(column().getByRole("button", { name: "Nova pasta" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Novo item" })).toBeEnabled()
    expect(screen.queryByText(/pastas$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/itens$/)).not.toBeInTheDocument()
  })
})

describe("review fixes", () => {
  it("the item limit notice goes away once an item is deleted", async () => {
    mocked(vaultCrypto.encryptItem).mockResolvedValue({ ...ENC, protected: false })
    mocked(api.createPersonalVaultItem).mockRejectedValue(new ApiError("Plan limit reached", 402, null))
    mocked(api.deletePersonalVaultItem).mockResolvedValue(undefined)
    jest.spyOn(window, "confirm").mockReturnValue(true)
    await renderItems()

    fireEvent.click(screen.getByRole("button", { name: "Novo item" }))
    const dialog = await screen.findByRole("dialog")
    type("Título", "Banco", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }))
    expect(await screen.findByText("Você chegou ao limite de itens do plano gratuito.")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: "Apagar GitHub" }))
    await waitFor(() => expect(api.deletePersonalVaultItem).toHaveBeenCalledWith("i2"))
    await waitFor(() =>
      expect(screen.queryByText("Você chegou ao limite de itens do plano gratuito.")).not.toBeInTheDocument(),
    )
  })

  it("items still load when the folders cannot", async () => {
    mocked(api.listPersonalVaultItems).mockResolvedValue([item("i1", true), item("i2"), item("i3")])
    mocked(api.listPersonalVaultFolders).mockRejectedValue(new ApiError("Not Found", 404, null))
    mocked(meApi.plan).mockResolvedValue(FREE)
    mocked(vaultCrypto.decryptSummary).mockImplementation(async (id) => SUMMARIES[id])
    renderWithIntl(
      <PersonalVaultSessionProvider>
        <VaultItems vaultKey={KEY} config={SAVED} onConfigChange={onConfigChange} />
      </PersonalVaultSessionProvider>,
    )
    expect(await screen.findByText("Instagram")).toBeInTheDocument()
    expect(screen.getByText("Não foi possível carregar as pastas.")).toBeInTheDocument()
    expect(screen.queryByText("Não foi possível carregar o cofre. Recarregue a página.")).not.toBeInTheDocument()
  })
})

describe("item folders", () => {
  const IN_FOLDERS: Record<string, vaultCrypto.ItemSummary> = {
    i1: { ...SUMMARIES.i1, folderId: "f1" },
    i2: { ...SUMMARIES.i2, folderId: "f2" },
    i3: { ...SUMMARIES.i3, folderId: "f1" },
  }
  const TWO = { folders: [folder("f1"), folder("f2")], names: { f1: "Trabalho", f2: "Pessoal" }, summaries: IN_FOLDERS }
  const column = () => within(screen.getByRole("navigation", { name: "Pastas" }))
  const plainOf = (call: number) => mocked(vaultCrypto.encryptItem).mock.calls[call][1]

  it("a new item takes the selected folder by default", async () => {
    mocked(vaultCrypto.encryptItem).mockResolvedValue({ ...ENC, protected: false })
    mocked(api.createPersonalVaultItem).mockResolvedValue(item("new"))
    await renderItems(undefined, TWO)

    fireEvent.click(column().getByRole("button", { name: "Trabalho, 2 itens" }))
    fireEvent.click(screen.getByRole("button", { name: "Novo item" }))
    let dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByLabelText("Pasta")).toHaveValue("f1")
    type("Título", "Banco", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(api.createPersonalVaultItem).toHaveBeenCalledTimes(1))
    expect(plainOf(0)).toMatchObject({ title: "Banco", folderId: "f1" })

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Novo item" }))
    dialog = await screen.findByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText("Pasta"), { target: { value: "" } })
    type("Título", "Solto", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(api.createPersonalVaultItem).toHaveBeenCalledTimes(2))
    expect(plainOf(1)).not.toHaveProperty("folderId")
  })

  it("editing an item keeps its folder, common or protected", async () => {
    mocked(vaultCrypto.encryptItem).mockResolvedValue({ ...ENC, protected: false })
    mocked(api.updatePersonalVaultItem).mockResolvedValue(item("i3"))
    mocked(vaultCrypto.decryptItem).mockResolvedValue({ type: "note", title: "Wi-Fi", content: "x", folderId: "f1" })
    await renderItems(undefined, TWO)

    fireEvent.click(screen.getByRole("button", { name: "Editar Wi-Fi" }))
    let dialog = await screen.findByRole("dialog")
    await waitFor(() => expect(within(dialog).getByLabelText("Título")).toHaveValue("Wi-Fi"))
    expect(within(dialog).getByLabelText("Pasta")).toHaveValue("f1")
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(api.updatePersonalVaultItem).toHaveBeenCalledTimes(1))
    expect(plainOf(0)).toMatchObject({ folderId: "f1" })

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    mocked(vaultCrypto.unlockProtectedKey).mockResolvedValue(PK)
    mocked(vaultCrypto.decryptItem).mockResolvedValue({ ...SUMMARIES.i1, password: "s3nh@", notes: "", folderId: "f1" } as vaultCrypto.PersonalVaultItemPlain)
    fireEvent.click(screen.getByRole("button", { name: "Editar Instagram" }))
    dialog = await screen.findByRole("dialog")
    type("Senha de proteção extra", "extra-123", dialog)
    fireEvent.click(within(dialog).getByRole("button", { name: "Desbloquear" }))
    await waitFor(() => expect(within(dialog).getByLabelText("Título")).toHaveValue("Instagram"))
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(api.updatePersonalVaultItem).toHaveBeenCalledTimes(2))
    expect(plainOf(1)).toMatchObject({ title: "Instagram", folderId: "f1" })
    expect(mocked(vaultCrypto.encryptItem).mock.calls[1][3]).toBe(PK)
  })

  it("moving a protected item never asks for the extra password", async () => {
    const moved = { ...envelope, ciphertext: "moved" }
    mocked(vaultCrypto.resealSummary).mockResolvedValue(moved)
    mocked(api.updatePersonalVaultItem).mockResolvedValue(item("i1", true))
    await renderItems(undefined, TWO)

    fireEvent.click(screen.getByRole("button", { name: "Mover Instagram" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByLabelText("Pasta")).toHaveValue("f1")
    expect(within(dialog).queryByLabelText("Senha de proteção extra")).not.toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText("Pasta"), { target: { value: "f2" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Mover" }))

    await waitFor(() => expect(api.updatePersonalVaultItem).toHaveBeenCalledTimes(1))
    expect(vaultCrypto.resealSummary).toHaveBeenCalledWith("i1", { ...SUMMARIES.i1, folderId: "f2" }, KEY)
    expect(api.updatePersonalVaultItem).toHaveBeenCalledWith("i1", { id: "i1", protected: true, summary: moved, body: envelope }, 1)
    expect(vaultCrypto.unlockProtectedKey).not.toHaveBeenCalled()
    expect(vaultCrypto.encryptItem).not.toHaveBeenCalled()
    await waitFor(() => expect(api.listPersonalVaultItems).toHaveBeenCalledTimes(2))
  })

  it("moving to Sem pasta drops the folderId from the summary", async () => {
    mocked(vaultCrypto.resealSummary).mockResolvedValue(envelope)
    mocked(api.updatePersonalVaultItem).mockResolvedValue(item("i3"))
    await renderItems(undefined, TWO)
    fireEvent.click(screen.getByRole("button", { name: "Mover Wi-Fi" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText("Pasta"), { target: { value: "" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Mover" }))
    await waitFor(() => expect(vaultCrypto.resealSummary).toHaveBeenCalledTimes(1))
    expect(mocked(vaultCrypto.resealSummary).mock.calls[0][1]).toEqual({ type: "note", title: "Wi-Fi" })
  })

  it.each([
    [409, "Este item mudou em outra aba. Recarregamos a versão mais recente."],
    [404, "Este item foi apagado em outra aba."],
  ])("a stale move (%i) reloads with a notice", async (code, text) => {
    mocked(vaultCrypto.resealSummary).mockResolvedValue(envelope)
    mocked(api.updatePersonalVaultItem).mockRejectedValue(new ApiError("stale", code, null))
    await renderItems(undefined, TWO)
    fireEvent.click(screen.getByRole("button", { name: "Mover GitHub" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText("Pasta"), { target: { value: "f1" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Mover" }))
    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(api.updatePersonalVaultItem).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(api.listPersonalVaultItems).toHaveBeenCalledTimes(2))
  })
})
