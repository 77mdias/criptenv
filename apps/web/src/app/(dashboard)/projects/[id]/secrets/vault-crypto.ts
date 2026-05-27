import type { DecryptedSecret } from "@/components/shared/secret-row"
import { checksum, decrypt, encrypt } from "@/lib/crypto"
import type { VaultBlob, VaultBlobPush } from "@/lib/api"

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
      }
    })
  )
}
