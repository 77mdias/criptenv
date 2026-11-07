import { encrypt } from "@/lib/crypto"
import {
  createPersonalVault,
  decodeRecoveryKey,
  decryptFolderName,
  decryptItem,
  decryptSummary,
  encodeRecoveryKey,
  encryptFolderName,
  encryptItem,
  PERSONAL_VAULT_ITERATIONS,
  recoverVault,
  resealSummary,
  rewrapExtra,
  rewrapMaster,
  unlockProtectedKey,
  unlockVault,
  type PersonalVaultItemPlain,
} from "../crypto"

// Low iteration count keeps the suite fast; production uses PERSONAL_VAULT_ITERATIONS.
const ITER = 1_000
const MASTER = "mestra-forte-123"
const EXTRA = "extra-123"
const ID_A = "2f1c9a4e-0000-4000-8000-00000000000a"
const ID_B = "2f1c9a4e-0000-4000-8000-00000000000b"

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (error) {
    return (error as { code?: string }).code
  }
  return undefined
}

const login: PersonalVaultItemPlain = {
  type: "login",
  title: "Instagram",
  username: "jean",
  password: "s3nh@",
  url: "https://instagram.com",
  notes: "",
}

describe("personal vault crypto", () => {
  it("uses 600k PBKDF2 iterations by default", () => {
    expect(PERSONAL_VAULT_ITERATIONS).toBe(600_000)
  })

  it("roundtrips recovery keys and tolerates sloppy typing", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const key = encodeRecoveryKey(bytes)
    expect(key).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){12}[0-9A-HJKMNP-TV-Z]{4}$/)
    const sloppy = ` ${key.toLowerCase().replace(/-/g, " ").replace(/0/g, "o").replace(/1/g, "l")} `
    expect(Array.from(decodeRecoveryKey(sloppy))).toEqual(Array.from(bytes))
    // Pasted from PDFs/docs: typographic dashes, underscores, dots, newlines, NBSP.
    for (const separator of ["–", "—", "_", ".", "\n", "\u00a0", " - "]) {
      expect(Array.from(decodeRecoveryKey(key.split("-").join(separator)))).toEqual(Array.from(bytes))
    }
    expect(codeOf(() => decodeRecoveryKey("abc"))).toBe("INVALID_RECOVERY_KEY")
    expect(codeOf(() => decodeRecoveryKey(key.replace(/^./, "U")))).toBe("INVALID_RECOVERY_KEY")
  })

  it("opens with the master password and rejects a wrong one", async () => {
    const { config } = await createPersonalVault(MASTER, EXTRA, ITER)
    expect(config.iterations).toBe(ITER)
    expect(config.kdf).toBe("PBKDF2-SHA256")
    expect(config.master_salt).toHaveLength(44)
    expect(config.master_wrapped_vault_key.iv).toHaveLength(16)
    expect(config.master_wrapped_vault_key.auth_tag).toHaveLength(24)
    await expect(unlockVault(config, MASTER)).resolves.toBeDefined()
    await expect(unlockVault(config, "errada-errada-1")).rejects.toMatchObject({ code: "WRONG_PASSWORD" })
  })

  it("keeps the vault key non-extractable", async () => {
    const { config, vaultKey } = await createPersonalVault(MASTER, EXTRA, ITER)
    expect(vaultKey.extractable).toBe(false)
    expect((await unlockVault(config, MASTER)).extractable).toBe(false)
    expect((await unlockProtectedKey(config, vaultKey, EXTRA)).extractable).toBe(false)
  })

  it("protected body needs the extra password on top of the vault key", async () => {
    const { config, vaultKey } = await createPersonalVault(MASTER, EXTRA, ITER)
    const pk = await unlockProtectedKey(config, vaultKey, EXTRA)
    const enc = await encryptItem(ID_A, login, vaultKey, pk)
    expect(enc.protected).toBe(true)
    expect(await decryptSummary(ID_A, enc.summary, vaultKey)).toEqual({
      type: "login",
      title: "Instagram",
      username: "jean",
      url: "https://instagram.com",
    })
    await expect(decryptItem(enc, vaultKey, vaultKey)).rejects.toMatchObject({ code: "DECRYPTION_FAILED" })
    expect(await decryptItem(enc, vaultKey, pk)).toEqual(login)
    await expect(unlockProtectedKey(config, vaultKey, "outra-123")).rejects.toMatchObject({ code: "WRONG_PASSWORD" })
  })

  it("the extra password alone cannot open the protected key", async () => {
    const a = await createPersonalVault(MASTER, EXTRA, ITER)
    const b = await createPersonalVault(MASTER, EXTRA, ITER)
    await expect(unlockProtectedKey(a.config, b.vaultKey, EXTRA)).rejects.toMatchObject({ code: "WRONG_PASSWORD" })
  })

  it("common items use the vault key for the body", async () => {
    const { vaultKey } = await createPersonalVault(MASTER, EXTRA, ITER)
    const note: PersonalVaultItemPlain = { type: "note", title: "Wi-Fi", content: "senha-do-wifi" }
    const enc = await encryptItem(ID_A, note, vaultKey, null)
    expect(enc.protected).toBe(false)
    expect(await decryptSummary(ID_A, enc.summary, vaultKey)).toEqual({ type: "note", title: "Wi-Fi" })
    expect(await decryptItem(enc, vaultKey, vaultKey)).toEqual(note)
  })

  it("recovery resets both passwords, keeps data and rotates the recovery key", async () => {
    const created = await createPersonalVault(MASTER, EXTRA, ITER)
    const pk = await unlockProtectedKey(created.config, created.vaultKey, EXTRA)
    const note: PersonalVaultItemPlain = { type: "note", title: "Banco", content: "PIN 1234" }
    const enc = await encryptItem(ID_A, note, created.vaultKey, pk)

    const rec = await recoverVault(created.config, created.recoveryKey, "nova-mestra-456", "nova-extra-4", ITER)
    expect(rec.recoveryKey).not.toBe(created.recoveryKey)
    const vk = await unlockVault(rec.config, "nova-mestra-456")
    const pk2 = await unlockProtectedKey(rec.config, vk, "nova-extra-4")
    expect(await decryptItem(enc, vk, pk2)).toEqual(note)
    await expect(unlockVault(rec.config, MASTER)).rejects.toMatchObject({ code: "WRONG_PASSWORD" })
    await expect(
      recoverVault(rec.config, created.recoveryKey, "x".repeat(12), "y".repeat(8), ITER),
    ).rejects.toMatchObject({ code: "WRONG_RECOVERY_KEY" })
    await expect(recoverVault(rec.config, "nope", "x".repeat(12), "y".repeat(8), ITER)).rejects.toMatchObject({
      code: "INVALID_RECOVERY_KEY",
    })
  })

  it("rewrapMaster changes only the master fields", async () => {
    const { config } = await createPersonalVault(MASTER, EXTRA, ITER)
    const next = await rewrapMaster(config, MASTER, "outra-mestra-789")
    expect({ ...next, master_salt: 0, master_wrapped_vault_key: 0 }).toEqual({
      ...config,
      master_salt: 0,
      master_wrapped_vault_key: 0,
    })
    await expect(unlockVault(next, "outra-mestra-789")).resolves.toBeDefined()
    await expect(unlockVault(next, MASTER)).rejects.toMatchObject({ code: "WRONG_PASSWORD" })
    await expect(rewrapMaster(config, "errada-errada-1", "x".repeat(12))).rejects.toMatchObject({
      code: "WRONG_PASSWORD",
    })
  })

  it("rewrapExtra changes only the extra fields and keeps protected data readable", async () => {
    const { config, vaultKey } = await createPersonalVault(MASTER, EXTRA, ITER)
    const enc = await encryptItem(ID_A, login, vaultKey, await unlockProtectedKey(config, vaultKey, EXTRA))
    const next = await rewrapExtra(config, vaultKey, EXTRA, "nova-extra-9")
    expect({ ...next, extra_salt: 0, extra_wrapped_protected_key: 0 }).toEqual({
      ...config,
      extra_salt: 0,
      extra_wrapped_protected_key: 0,
    })
    const pk = await unlockProtectedKey(next, vaultKey, "nova-extra-9")
    expect(await decryptItem(enc, vaultKey, pk)).toEqual(login)
    await expect(unlockProtectedKey(next, vaultKey, EXTRA)).rejects.toMatchObject({ code: "WRONG_PASSWORD" })
  })

  it("binds envelopes to their item: swapping between items is rejected", async () => {
    const { vaultKey } = await createPersonalVault(MASTER, EXTRA, ITER)
    const a = await encryptItem(ID_A, login, vaultKey, null)
    const b = await encryptItem(ID_B, { type: "note", title: "Outro", content: "x" }, vaultKey, null)
    expect(a.id).toBe(ID_A)
    await expect(decryptSummary(ID_A, b.summary, vaultKey)).rejects.toMatchObject({ code: "DECRYPTION_FAILED" })
    await expect(decryptItem({ ...a, body: b.body }, vaultKey, vaultKey)).rejects.toMatchObject({ code: "DECRYPTION_FAILED" })
    await expect(decryptSummary(ID_A, a.body, vaultKey)).rejects.toMatchObject({ code: "DECRYPTION_FAILED" })
  })

  it("flipping the protected flag is rejected", async () => {
    const { config, vaultKey } = await createPersonalVault(MASTER, EXTRA, ITER)
    const pk = await unlockProtectedKey(config, vaultKey, EXTRA)
    const enc = await encryptItem(ID_A, login, vaultKey, pk)
    await expect(decryptItem({ ...enc, protected: false }, vaultKey, pk)).rejects.toMatchObject({ code: "DECRYPTION_FAILED" })
    const common = await encryptItem(ID_B, login, vaultKey, null)
    await expect(decryptItem({ ...common, protected: true }, vaultKey, vaultKey)).rejects.toMatchObject({ code: "DECRYPTION_FAILED" })
  })

  it("a body cannot override summary fields", async () => {
    const { vaultKey } = await createPersonalVault(MASTER, EXTRA, ITER)
    const enc = await encryptItem(ID_A, login, vaultKey, null)
    const forged = await encrypt(
      JSON.stringify({ title: "Forjado", type: "note", password: "p", notes: "" }),
      vaultKey,
      `criptenv:pv1:item:${ID_A}:body:common`,
    )
    const body = { iv: forged.iv, ciphertext: forged.ciphertext, auth_tag: forged.authTag }
    const plain = await decryptItem({ ...enc, body }, vaultKey, vaultKey)
    expect(plain).toEqual({ ...login, password: "p" })
  })

  it("config envelopes are bound to their field", async () => {
    // Both recovery envelopes use the same KEK: only the AAD tells them apart.
    const { config, recoveryKey } = await createPersonalVault(MASTER, EXTRA, ITER)
    const swapped = {
      ...config,
      recovery_wrapped_vault_key: config.recovery_wrapped_protected_key,
      recovery_wrapped_protected_key: config.recovery_wrapped_vault_key,
    }
    await expect(recoverVault(swapped, recoveryKey, "x".repeat(12), "y".repeat(8), ITER)).rejects.toMatchObject({
      code: "WRONG_RECOVERY_KEY",
    })
  })

  it("unlocking never turns key material into text", async () => {
    const { config, vaultKey } = await createPersonalVault(MASTER, EXTRA, ITER)
    const decryptSpy = jest.spyOn(crypto.subtle, "decrypt")
    const unwrapSpy = jest.spyOn(crypto.subtle, "unwrapKey")
    try {
      await unlockVault(config, MASTER)
      expect(decryptSpy).not.toHaveBeenCalled()
      expect(unwrapSpy).toHaveBeenCalledTimes(1)

      unwrapSpy.mockClear()
      await unlockProtectedKey(config, vaultKey, EXTRA)
      // The outer layer decrypts the inner *envelope* (ciphertext); the key itself is unwrapped.
      expect(unwrapSpy).toHaveBeenCalledTimes(1)
    } finally {
      decryptSpy.mockRestore()
      unwrapSpy.mockRestore()
    }
  })

  describe("folders", () => {
    it("folder name round-trips", async () => {
      const { vaultKey } = await createPersonalVault(MASTER, EXTRA, ITER)
      const sealed = await encryptFolderName(ID_A, "Trabalho", vaultKey)
      expect(sealed.ciphertext).not.toContain("Trabalho")
      expect(await decryptFolderName(ID_A, sealed, vaultKey)).toBe("Trabalho")
    })

    it("folder name is bound to its id", async () => {
      const { vaultKey } = await createPersonalVault(MASTER, EXTRA, ITER)
      const sealed = await encryptFolderName(ID_A, "Trabalho", vaultKey)
      await expect(decryptFolderName(ID_B, sealed, vaultKey)).rejects.toMatchObject({ code: "DECRYPTION_FAILED" })
    })

    it("a folder name cannot pass as an item summary", async () => {
      const { vaultKey } = await createPersonalVault(MASTER, EXTRA, ITER)
      const sealed = await encryptFolderName(ID_A, "Trabalho", vaultKey)
      await expect(decryptSummary(ID_A, sealed, vaultKey)).rejects.toMatchObject({ code: "DECRYPTION_FAILED" })
    })

    it("summary keeps folderId", async () => {
      const { vaultKey } = await createPersonalVault(MASTER, EXTRA, ITER)
      const enc = await encryptItem(ID_A, { ...login, folderId: "f1" }, vaultKey, null)
      expect((await decryptSummary(ID_A, enc.summary, vaultKey)).folderId).toBe("f1")
      expect((await decryptItem(enc, vaultKey, vaultKey)).folderId).toBe("f1")
    })

    it("summary without folderId has no folderId key", async () => {
      const { vaultKey } = await createPersonalVault(MASTER, EXTRA, ITER)
      const enc = await encryptItem(ID_A, { type: "note", title: "Wi-Fi", content: "x" }, vaultKey, null)
      expect(Object.keys(await decryptSummary(ID_A, enc.summary, vaultKey))).toEqual(["type", "title"])
      expect("folderId" in (await decryptItem(enc, vaultKey, vaultKey))).toBe(false)
    })

    it("resealSummary moves an item without touching the body", async () => {
      const { config, vaultKey } = await createPersonalVault(MASTER, EXTRA, ITER)
      const pk = await unlockProtectedKey(config, vaultKey, EXTRA)
      const enc = await encryptItem(ID_A, { ...login, folderId: "f1" }, vaultKey, pk)
      const summary = await decryptSummary(ID_A, enc.summary, vaultKey)
      const moved = await resealSummary(ID_A, { ...summary, folderId: "f2" }, vaultKey)
      const opened = await decryptItem({ id: ID_A, protected: true, summary: moved, body: enc.body }, vaultKey, pk)
      expect(opened).toEqual({ ...login, folderId: "f2" })
      await expect(decryptSummary(ID_B, moved, vaultKey)).rejects.toMatchObject({ code: "DECRYPTION_FAILED" })
    })
  })
})
