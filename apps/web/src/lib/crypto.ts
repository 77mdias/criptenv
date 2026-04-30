/**
 * CriptEnv Crypto Module — Zero-Knowledge Encryption
 *
 * All encryption happens client-side. The server NEVER sees plaintext secrets.
 * Uses AES-GCM 256-bit with PBKDF2 key derivation.
 */

const PBKDF2_ITERATIONS = 100_000
const SALT_LENGTH = 32
const IV_LENGTH = 12
const KEY_LENGTH = 256

export class CryptoError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = "CryptoError"
  }
}

/**
 * Generate a random salt for PBKDF2 key derivation
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
}

/**
 * Derive a session key from a master password using PBKDF2
 */
export async function deriveSessionKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  )

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  )
}

export async function deriveSessionKeyFromBase64Salt(
  password: string,
  saltBase64: string
): Promise<CryptoKey> {
  return deriveSessionKey(password, base64ToBuffer(saltBase64))
}

/**
 * Encrypt plaintext using AES-GCM 256-bit
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<{ iv: string; ciphertext: string; authTag: string }> {
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  try {
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(plaintext)
    )

    const encryptedArray = new Uint8Array(encrypted)
    const ciphertext = encryptedArray.slice(0, -16)
    const authTag = encryptedArray.slice(-16)

    return {
      iv: bufferToBase64(iv),
      ciphertext: bufferToBase64(ciphertext),
      authTag: bufferToBase64(authTag),
    }
  } catch {
    throw new CryptoError("Encryption failed", "ENCRYPTION_FAILED")
  }
}

export async function checksum(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Decrypt ciphertext using AES-GCM 256-bit
 */
export async function decrypt(
  ciphertext: string,
  key: CryptoKey,
  iv: string,
  authTag: string
): Promise<string> {
  const ctBuffer = base64ToBuffer(ciphertext)
  const ivBuffer = base64ToBuffer(iv)
  const authTagBuffer = base64ToBuffer(authTag)

  const encryptedData = new Uint8Array(ctBuffer.length + authTagBuffer.length)
  encryptedData.set(ctBuffer)
  encryptedData.set(authTagBuffer, ctBuffer.length)

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBuffer.buffer as ArrayBuffer },
      key,
      encryptedData
    )

    return new TextDecoder().decode(decrypted)
  } catch {
    throw new CryptoError("Decryption failed", "DECRYPTION_FAILED")
  }
}

// --- Helpers ---

export function bufferToBase64(buffer: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i])
  }
  return btoa(binary)
}

export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
