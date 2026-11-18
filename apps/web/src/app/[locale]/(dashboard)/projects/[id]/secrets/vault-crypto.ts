import type { DecryptedSecret } from "@/components/shared/secret-row"
import { checksum, decrypt, encrypt } from "@/lib/crypto"
import type { VaultBlob, VaultBlobPush, VaultResolvedBlob } from "@/lib/api"

export function sortSecrets(secrets: DecryptedSecret[]): DecryptedSecret[] {
  return [...secrets].sort((a, b) => a.key.localeCompare(b.key))
}

export async function decryptVault(
  blobs: VaultBlob[],
  key: CryptoKey
): Promise<DecryptedSecret[]> {
  const secrets = await Promise.all(
    blobs.map(async (blob) => ({
      key: blob.key_id,
      value: await decrypt(blob.ciphertext, key, blob.iv, blob.auth_tag),
      kind: blob.kind ?? undefined,
      updatedAt: blob.updated_at || blob.created_at,
    }))
  )

  return sortSecrets(secrets)
}

export async function encryptVault(
  secrets: DecryptedSecret[],
  key: CryptoKey,
  version: number
): Promise<VaultBlobPush[]> {
  return Promise.all(
    sortSecrets(secrets).map(async (secret) => {
      const encrypted = await encrypt(secret.value, key)
      const digest = await checksum(
        `${secret.key}:${encrypted.iv}:${encrypted.ciphertext}:${encrypted.authTag}`
      )

      return {
        key_id: secret.key,
        iv: encrypted.iv,
        ciphertext: encrypted.ciphertext,
        auth_tag: encrypted.authTag,
        checksum: digest,
        version,
        ...(secret.kind ? { kind: secret.kind } : {}),
      }
    })
  )
}

/**
 * A child environment's resolved view: each blob decrypted with the key of the environment holding it
 * (`keyFor(environment_id)`), inherited ones tagged with that environment's name.
 */
export async function decryptResolved(
  blobs: VaultResolvedBlob[],
  keyFor: (environmentId: string) => Promise<CryptoKey>
): Promise<DecryptedSecret[]> {
  const secrets = await Promise.all(
    blobs.map(async (blob) => ({
      key: blob.key_id,
      value: await decrypt(blob.ciphertext, await keyFor(blob.environment_id), blob.iv, blob.auth_tag),
      kind: blob.kind ?? undefined,
      updatedAt: blob.updated_at || blob.created_at,
      inheritedFrom: blob.origin === "inherited" ? blob.source_environment_name : null,
    }))
  )
  return sortSecrets(secrets)
}

/** What a child resolves to after a change: its own secrets plus what it still inherits. */
export function mergeInherited(
  own: DecryptedSecret[],
  resolved: DecryptedSecret[],
  unsetKeys: string[]
): DecryptedSecret[] {
  const hidden = new Set([...own.map((secret) => secret.key), ...unsetKeys])
  return sortSecrets([...own, ...resolved.filter((secret) => secret.inheritedFrom && !hidden.has(secret.key))])
}
