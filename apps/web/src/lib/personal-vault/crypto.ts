/**
 * Personal vault (cofre pessoal) — zero-knowledge key hierarchy.
 *
 *   master password ─PBKDF2─▶ KEK_master ─wraps─▶ vault key (VK)
 *   recovery key ───HKDF───▶ KEK_rec ────wraps─▶ VK and protected key (PK)
 *   extra password ─PBKDF2─▶ KEK_extra ──wraps─▶ PK, and that envelope is sealed again with VK
 *
 * VK encrypts every item summary and the body of common items; PK encrypts the
 * body of "proteção extra" items, so those need both passwords. VK and PK are
 * random, so changing a password only re-wraps one key. Details and threat
 * model: docs/security/personal-vault.md.
 */
import {
  base64ToBuffer,
  bufferToBase64,
  CryptoError,
  decrypt,
  encrypt,
  generateSalt,
  importHkdfKey,
} from "@/lib/crypto"

export const PERSONAL_VAULT_ITERATIONS = 600_000
export const PERSONAL_VAULT_KDF = "PBKDF2-SHA256"

const KEY_BYTES = 32
const RECOVERY_INFO = "criptenv-personal-recovery-v1"
// AES-GCM associated data: binds every envelope to its item and field, so a server
// cannot swap envelopes between items/fields or flip the protected flag undetected.
const AAD = {
  masterVaultKey: "criptenv:pv1:config:master_vault_key",
  recoveryVaultKey: "criptenv:pv1:config:recovery_vault_key",
  recoveryProtectedKey: "criptenv:pv1:config:recovery_protected_key",
  extraInner: "criptenv:pv1:config:extra_protected_key:inner",
  extraOuter: "criptenv:pv1:config:extra_protected_key:outer",
  summary: (id: string) => `criptenv:pv1:item:${id}:summary`,
  body: (id: string, isProtected: boolean) => `criptenv:pv1:item:${id}:body:${isProtected ? "protected" : "common"}`,
}
// Crockford base32: no I, L, O, U, so a printed key is hard to misread.
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

export interface EncryptedField {
  iv: string
  ciphertext: string
  auth_tag: string
}

export interface PersonalVaultConfigInput {
  kdf: string
  iterations: number
  master_salt: string
  extra_salt: string
  master_wrapped_vault_key: EncryptedField
  recovery_wrapped_vault_key: EncryptedField
  extra_wrapped_protected_key: EncryptedField
  recovery_wrapped_protected_key: EncryptedField
}

export type PersonalVaultItemPlain =
  | { type: "login"; title: string; username: string; password: string; url: string; notes: string }
  | { type: "note"; title: string; content: string }

export interface ItemSummary {
  type: "login" | "note"
  title: string
  username?: string
  url?: string
}

export interface EncryptedItem {
  id: string
  protected: boolean
  summary: EncryptedField
  body: EncryptedField
}

interface SealedVault {
  config: PersonalVaultConfigInput
  recoveryKey: string
  vaultKey: CryptoKey
}

// ─── Recovery key encoding ──────────────────────────────────────────────────

export function encodeRecoveryKey(bytes: Uint8Array): string {
  let out = ""
  let value = 0
  let bits = 0
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31]
      bits -= 5
      value &= (1 << bits) - 1
    }
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31]
  return out.match(/.{1,4}/g)!.join("-")
}

export function decodeRecoveryKey(input: string): Uint8Array {
  const chars = input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1")
  const bytes: number[] = []
  let value = 0
  let bits = 0
  for (const char of chars) {
    const index = CROCKFORD.indexOf(char)
    if (index < 0) throw invalidRecoveryKey()
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
      value &= (1 << bits) - 1
    }
  }
  if (bytes.length !== KEY_BYTES || value !== 0) throw invalidRecoveryKey()
  return new Uint8Array(bytes)
}

function invalidRecoveryKey(): CryptoError {
  return new CryptoError("Invalid recovery key", "INVALID_RECOVERY_KEY")
}

// ─── Vault lifecycle ────────────────────────────────────────────────────────
// VK and PK only ever exist as CryptoKey objects: they are wrapped/unwrapped by
// WebCrypto (wrapKey/unwrapKey), never exported to bytes or strings. Keys handed
// to callers are non-extractable; extractable copies live only inside a re-wrap.

export async function createPersonalVault(
  master: string,
  extra: string,
  iterations = PERSONAL_VAULT_ITERATIONS,
): Promise<SealedVault> {
  const [vaultKey, protectedKey] = await Promise.all([generateAesKey(), generateAesKey()])
  return sealVault(vaultKey, protectedKey, master, extra, iterations)
}

export async function unlockVault(config: PersonalVaultConfigInput, master: string): Promise<CryptoKey> {
  const kek = await passwordKek(master, config.master_salt, config.iterations)
  return unwrapField(config.master_wrapped_vault_key, kek, AAD.masterVaultKey, "WRONG_PASSWORD", false)
}

export async function unlockProtectedKey(
  config: PersonalVaultConfigInput,
  vaultKey: CryptoKey,
  extra: string,
): Promise<CryptoKey> {
  const kek = await passwordKek(extra, config.extra_salt, config.iterations)
  return unwrapProtected(config.extra_wrapped_protected_key, vaultKey, kek, false)
}

/** Resets both passwords from the printed recovery key and issues a new one. */
export async function recoverVault(
  config: PersonalVaultConfigInput,
  recoveryKey: string,
  newMaster: string,
  newExtra: string,
  iterations = PERSONAL_VAULT_ITERATIONS,
): Promise<SealedVault> {
  const kek = await recoveryKek(decodeRecoveryKey(recoveryKey))
  const vaultKey = await unwrapField(config.recovery_wrapped_vault_key, kek, AAD.recoveryVaultKey, "WRONG_RECOVERY_KEY", true)
  const protectedKey = await unwrapField(
    config.recovery_wrapped_protected_key,
    kek,
    AAD.recoveryProtectedKey,
    "WRONG_RECOVERY_KEY",
    true,
  )
  return sealVault(vaultKey, protectedKey, newMaster, newExtra, iterations)
}

/** Changes the master password; only master_salt and master_wrapped_vault_key change. */
export async function rewrapMaster(
  config: PersonalVaultConfigInput,
  currentMaster: string,
  newMaster: string,
): Promise<PersonalVaultConfigInput> {
  const current = await passwordKek(currentMaster, config.master_salt, config.iterations)
  const vaultKey = await unwrapField(config.master_wrapped_vault_key, current, AAD.masterVaultKey, "WRONG_PASSWORD", true)
  const salt = bufferToBase64(generateSalt())
  const next = await passwordKek(newMaster, salt, config.iterations)
  return { ...config, master_salt: salt, master_wrapped_vault_key: await wrapField(vaultKey, next, AAD.masterVaultKey) }
}

/** Changes the extra password; only extra_salt and extra_wrapped_protected_key change. */
export async function rewrapExtra(
  config: PersonalVaultConfigInput,
  vaultKey: CryptoKey,
  currentExtra: string,
  newExtra: string,
): Promise<PersonalVaultConfigInput> {
  const current = await passwordKek(currentExtra, config.extra_salt, config.iterations)
  const protectedKey = await unwrapProtected(config.extra_wrapped_protected_key, vaultKey, current, true)
  const salt = bufferToBase64(generateSalt())
  const next = await passwordKek(newExtra, salt, config.iterations)
  return {
    ...config,
    extra_salt: salt,
    extra_wrapped_protected_key: await wrapProtected(protectedKey, next, vaultKey),
  }
}

// ─── Items ──────────────────────────────────────────────────────────────────

export async function encryptItem(
  id: string,
  item: PersonalVaultItemPlain,
  vaultKey: CryptoKey,
  protectedKey: CryptoKey | null,
): Promise<EncryptedItem> {
  const summary: ItemSummary =
    item.type === "login"
      ? { type: item.type, title: item.title, username: item.username, url: item.url }
      : { type: item.type, title: item.title }
  const body = item.type === "login" ? { password: item.password, notes: item.notes } : { content: item.content }
  const isProtected = protectedKey !== null
  return {
    id,
    protected: isProtected,
    summary: await seal(JSON.stringify(summary), vaultKey, AAD.summary(id)),
    body: await seal(JSON.stringify(body), protectedKey ?? vaultKey, AAD.body(id, isProtected)),
  }
}

export async function decryptSummary(id: string, summary: EncryptedField, vaultKey: CryptoKey): Promise<ItemSummary> {
  return JSON.parse(await open(summary, vaultKey, AAD.summary(id))) as ItemSummary
}

export async function decryptItem(
  item: { id: string; protected: boolean; summary: EncryptedField; body: EncryptedField },
  vaultKey: CryptoKey,
  bodyKey: CryptoKey,
): Promise<PersonalVaultItemPlain> {
  const summary = await decryptSummary(item.id, item.summary, vaultKey)
  const body = JSON.parse(await open(item.body, bodyKey, AAD.body(item.id, item.protected)))
  // Field by field: summary owns type/title/username/url, so a body can never override them.
  if (summary.type === "login") {
    return {
      type: "login",
      title: summary.title,
      username: summary.username ?? "",
      url: summary.url ?? "",
      password: String(body.password ?? ""),
      notes: String(body.notes ?? ""),
    }
  }
  return { type: "note", title: summary.title, content: String(body.content ?? "") }
}

// ─── Internals ──────────────────────────────────────────────────────────────

const encodeText = (text: string) => new TextEncoder().encode(text)

/** Extractable only so it can be wrapped; callers receive non-extractable copies. */
function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
}

async function sealVault(
  vaultKey: CryptoKey,
  protectedKey: CryptoKey,
  master: string,
  extra: string,
  iterations: number,
): Promise<SealedVault> {
  const masterSalt = bufferToBase64(generateSalt())
  const extraSalt = bufferToBase64(generateSalt())
  const recoveryRaw = crypto.getRandomValues(new Uint8Array(KEY_BYTES))
  const recoveryKey = encodeRecoveryKey(recoveryRaw)
  const recovery = await recoveryKek(recoveryRaw)
  const config: PersonalVaultConfigInput = {
    kdf: PERSONAL_VAULT_KDF,
    iterations,
    master_salt: masterSalt,
    extra_salt: extraSalt,
    master_wrapped_vault_key: await wrapField(vaultKey, await passwordKek(master, masterSalt, iterations), AAD.masterVaultKey),
    recovery_wrapped_vault_key: await wrapField(vaultKey, recovery, AAD.recoveryVaultKey),
    extra_wrapped_protected_key: await wrapProtected(protectedKey, await passwordKek(extra, extraSalt, iterations), vaultKey),
    recovery_wrapped_protected_key: await wrapField(protectedKey, recovery, AAD.recoveryProtectedKey),
  }
  // Hand back a non-extractable copy of VK for the open vault.
  const openKey = await unwrapField(config.recovery_wrapped_vault_key, recovery, AAD.recoveryVaultKey, "WRONG_RECOVERY_KEY", false)
  return { config, recoveryKey, vaultKey: openKey }
}

async function passwordKek(password: string, saltBase64: string, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", encodeText(password), "PBKDF2", false, ["deriveKey"])
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: base64ToBuffer(saltBase64) as BufferSource, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  )
}

async function recoveryKek(raw: Uint8Array): Promise<CryptoKey> {
  try {
    const base = await importHkdfKey(raw)
    return await crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: encodeText(RECOVERY_INFO) },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["wrapKey", "unwrapKey"],
    )
  } finally {
    raw.fill(0)
  }
}

async function seal(plaintext: string, key: CryptoKey, aad: string): Promise<EncryptedField> {
  const { iv, ciphertext, authTag } = await encrypt(plaintext, key, aad)
  return { iv, ciphertext, auth_tag: authTag }
}

function open(field: EncryptedField, key: CryptoKey, aad: string): Promise<string> {
  return decrypt(field.ciphertext, key, field.iv, field.auth_tag, aad)
}

async function wrapField(key: CryptoKey, kek: CryptoKey, aad: string): Promise<EncryptedField> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const wrapped = new Uint8Array(
    await crypto.subtle.wrapKey("raw", key, kek, { name: "AES-GCM", iv, additionalData: encodeText(aad) }),
  )
  return {
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(wrapped.slice(0, -16)),
    auth_tag: bufferToBase64(wrapped.slice(-16)),
  }
}

async function unwrapField(
  field: EncryptedField,
  kek: CryptoKey,
  aad: string,
  code: string,
  extractable: boolean,
): Promise<CryptoKey> {
  try {
    const ciphertext = base64ToBuffer(field.ciphertext)
    const tag = base64ToBuffer(field.auth_tag)
    const data = new Uint8Array(ciphertext.length + tag.length)
    data.set(ciphertext)
    data.set(tag, ciphertext.length)
    return await crypto.subtle.unwrapKey(
      "raw",
      data,
      kek,
      { name: "AES-GCM", iv: base64ToBuffer(field.iv) as BufferSource, additionalData: encodeText(aad) },
      { name: "AES-GCM", length: 256 },
      extractable,
      ["encrypt", "decrypt"],
    )
  } catch {
    throw new CryptoError("Could not unlock personal vault", code)
  }
}

async function wrapProtected(protectedKey: CryptoKey, extraKek: CryptoKey, vaultKey: CryptoKey): Promise<EncryptedField> {
  return seal(JSON.stringify(await wrapField(protectedKey, extraKek, AAD.extraInner)), vaultKey, AAD.extraOuter)
}

async function unwrapProtected(
  field: EncryptedField,
  vaultKey: CryptoKey,
  extraKek: CryptoKey,
  extractable: boolean,
): Promise<CryptoKey> {
  let inner: EncryptedField
  try {
    inner = JSON.parse(await open(field, vaultKey, AAD.extraOuter)) as EncryptedField
  } catch {
    throw new CryptoError("Could not unlock protected items", "WRONG_PASSWORD")
  }
  return unwrapField(inner, extraKek, AAD.extraInner, "WRONG_PASSWORD", extractable)
}
