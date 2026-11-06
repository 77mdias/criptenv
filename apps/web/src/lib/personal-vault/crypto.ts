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
  derivePbkdf2Bits,
  encrypt,
  generateSalt,
  importAesKey,
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

export async function createPersonalVault(
  master: string,
  extra: string,
  iterations = PERSONAL_VAULT_ITERATIONS,
): Promise<SealedVault> {
  const vaultRaw = randomKey()
  const protectedRaw = randomKey()
  try {
    return await sealVault(vaultRaw, protectedRaw, master, extra, iterations)
  } finally {
    vaultRaw.fill(0)
    protectedRaw.fill(0)
  }
}

export async function unlockVault(config: PersonalVaultConfigInput, master: string): Promise<CryptoKey> {
  const kek = await passwordKek(master, config.master_salt, config.iterations)
  const raw = await unwrapRaw(config.master_wrapped_vault_key, kek, "WRONG_PASSWORD", AAD.masterVaultKey)
  try {
    return await importAesKey(raw)
  } finally {
    raw.fill(0)
  }
}

export async function unlockProtectedKey(
  config: PersonalVaultConfigInput,
  vaultKey: CryptoKey,
  extra: string,
): Promise<CryptoKey> {
  const kek = await passwordKek(extra, config.extra_salt, config.iterations)
  const raw = await unwrapProtectedRaw(config.extra_wrapped_protected_key, vaultKey, kek)
  try {
    return await importAesKey(raw)
  } finally {
    raw.fill(0)
  }
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
  const vaultRaw = await unwrapRaw(config.recovery_wrapped_vault_key, kek, "WRONG_RECOVERY_KEY", AAD.recoveryVaultKey)
  const protectedRaw = await unwrapRaw(config.recovery_wrapped_protected_key, kek, "WRONG_RECOVERY_KEY", AAD.recoveryProtectedKey)
  try {
    return await sealVault(vaultRaw, protectedRaw, newMaster, newExtra, iterations)
  } finally {
    vaultRaw.fill(0)
    protectedRaw.fill(0)
  }
}

/** Changes the master password; only master_salt and master_wrapped_vault_key change. */
export async function rewrapMaster(
  config: PersonalVaultConfigInput,
  currentMaster: string,
  newMaster: string,
): Promise<PersonalVaultConfigInput> {
  const current = await passwordKek(currentMaster, config.master_salt, config.iterations)
  const raw = await unwrapRaw(config.master_wrapped_vault_key, current, "WRONG_PASSWORD", AAD.masterVaultKey)
  try {
    const salt = bufferToBase64(generateSalt())
    const next = await passwordKek(newMaster, salt, config.iterations)
    return { ...config, master_salt: salt, master_wrapped_vault_key: await wrapRaw(raw, next, AAD.masterVaultKey) }
  } finally {
    raw.fill(0)
  }
}

/** Changes the extra password; only extra_salt and extra_wrapped_protected_key change. */
export async function rewrapExtra(
  config: PersonalVaultConfigInput,
  vaultKey: CryptoKey,
  currentExtra: string,
  newExtra: string,
): Promise<PersonalVaultConfigInput> {
  const current = await passwordKek(currentExtra, config.extra_salt, config.iterations)
  const raw = await unwrapProtectedRaw(config.extra_wrapped_protected_key, vaultKey, current)
  try {
    const salt = bufferToBase64(generateSalt())
    const next = await passwordKek(newExtra, salt, config.iterations)
    return { ...config, extra_salt: salt, extra_wrapped_protected_key: await wrapProtected(raw, next, vaultKey) }
  } finally {
    raw.fill(0)
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

function randomKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(KEY_BYTES))
}

async function sealVault(
  vaultRaw: Uint8Array,
  protectedRaw: Uint8Array,
  master: string,
  extra: string,
  iterations: number,
): Promise<SealedVault> {
  const masterSalt = bufferToBase64(generateSalt())
  const extraSalt = bufferToBase64(generateSalt())
  const recoveryRaw = randomKey()
  try {
    const recovery = await recoveryKek(recoveryRaw)
    const vaultKey = await importAesKey(vaultRaw)
    const config: PersonalVaultConfigInput = {
      kdf: PERSONAL_VAULT_KDF,
      iterations,
      master_salt: masterSalt,
      extra_salt: extraSalt,
      master_wrapped_vault_key: await wrapRaw(vaultRaw, await passwordKek(master, masterSalt, iterations), AAD.masterVaultKey),
      recovery_wrapped_vault_key: await wrapRaw(vaultRaw, recovery, AAD.recoveryVaultKey),
      extra_wrapped_protected_key: await wrapProtected(
        protectedRaw,
        await passwordKek(extra, extraSalt, iterations),
        vaultKey,
      ),
      recovery_wrapped_protected_key: await wrapRaw(protectedRaw, recovery, AAD.recoveryProtectedKey),
    }
    return { config, recoveryKey: encodeRecoveryKey(recoveryRaw), vaultKey }
  } finally {
    recoveryRaw.fill(0)
  }
}

async function passwordKek(password: string, saltBase64: string, iterations: number): Promise<CryptoKey> {
  const bits = await derivePbkdf2Bits(password, base64ToBuffer(saltBase64), iterations)
  try {
    return await importAesKey(bits)
  } finally {
    bits.fill(0)
  }
}

async function recoveryKek(raw: Uint8Array): Promise<CryptoKey> {
  const base = await importHkdfKey(raw)
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: new TextEncoder().encode(RECOVERY_INFO) },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

async function seal(plaintext: string, key: CryptoKey, aad: string): Promise<EncryptedField> {
  const { iv, ciphertext, authTag } = await encrypt(plaintext, key, aad)
  return { iv, ciphertext, auth_tag: authTag }
}

function open(field: EncryptedField, key: CryptoKey, aad: string): Promise<string> {
  return decrypt(field.ciphertext, key, field.iv, field.auth_tag, aad)
}

function wrapRaw(raw: Uint8Array, kek: CryptoKey, aad: string): Promise<EncryptedField> {
  return seal(bufferToBase64(raw), kek, aad)
}

async function unwrapRaw(field: EncryptedField, kek: CryptoKey, code: string, aad: string): Promise<Uint8Array> {
  try {
    return base64ToBuffer(await open(field, kek, aad))
  } catch {
    throw new CryptoError("Could not unlock personal vault", code)
  }
}

async function wrapProtected(raw: Uint8Array, extraKek: CryptoKey, vaultKey: CryptoKey): Promise<EncryptedField> {
  return seal(JSON.stringify(await wrapRaw(raw, extraKek, AAD.extraInner)), vaultKey, AAD.extraOuter)
}

async function unwrapProtectedRaw(field: EncryptedField, vaultKey: CryptoKey, extraKek: CryptoKey): Promise<Uint8Array> {
  try {
    const inner = JSON.parse(await open(field, vaultKey, AAD.extraOuter)) as EncryptedField
    return base64ToBuffer(await open(inner, extraKek, AAD.extraInner))
  } catch {
    throw new CryptoError("Could not unlock protected items", "WRONG_PASSWORD")
  }
}
