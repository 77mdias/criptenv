import type { DecryptedSecret } from "@/components/shared/secret-row"
import type { VaultBlob, VaultResolvedBlob } from "@/lib/api"
import { checksum, decrypt, encrypt } from "@/lib/crypto"
import { decryptResolved, decryptVault, encryptVault, mergeInherited } from "../vault-crypto"

jest.mock("@/lib/crypto", () => ({
  checksum: jest.fn(async (value: string) => `sha256:${value}`),
  decrypt: jest.fn(async (ciphertext: string) => `plain:${ciphertext}`),
  encrypt: jest.fn(async (value: string) => ({
    iv: `iv:${value}`,
    ciphertext: `cipher:${value}`,
    authTag: `tag:${value}`,
  })),
}))

const mockedChecksum = checksum as jest.MockedFunction<typeof checksum>
const mockedDecrypt = decrypt as jest.MockedFunction<typeof decrypt>
const mockedEncrypt = encrypt as jest.MockedFunction<typeof encrypt>

function vaultBlob(overrides: Partial<VaultBlob>): VaultBlob {
  return {
    id: "blob-id",
    project_id: "project-id",
    environment_id: "environment-id",
    key_id: "KEY",
    iv: "iv",
    ciphertext: "ciphertext",
    auth_tag: "auth-tag",
    version: 1,
    checksum: "checksum",
    kind: "config",
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: null,
    ...overrides,
  }
}

describe("vault crypto helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("decrypts vault blobs and sorts secrets by key", async () => {
    const key = {} as CryptoKey

    const secrets = await decryptVault(
      [
        vaultBlob({ key_id: "Z_TOKEN", ciphertext: "z", updated_at: "2026-05-02T00:00:00.000Z" }),
        vaultBlob({ key_id: "API_KEY", ciphertext: "a" }),
      ],
      key
    )

    expect(secrets).toEqual([
      {
        key: "API_KEY",
        value: "plain:a",
        kind: "config",
        updatedAt: "2026-05-01T00:00:00.000Z",
      },
      {
        key: "Z_TOKEN",
        value: "plain:z",
        kind: "config",
        updatedAt: "2026-05-02T00:00:00.000Z",
      },
    ])
    expect(mockedDecrypt).toHaveBeenCalledWith("z", key, "iv", "auth-tag")
  })

  it("encrypts secrets in stable key order with the supplied vault version", async () => {
    const key = {} as CryptoKey
    const secrets: DecryptedSecret[] = [
      { key: "Z_TOKEN", value: "z-value" },
      { key: "API_KEY", value: "a-value" },
    ]

    const blobs = await encryptVault(secrets, key, 9)

    expect(blobs.map((blob) => blob.key_id)).toEqual(["API_KEY", "Z_TOKEN"])
    expect(blobs).toEqual([
      {
        key_id: "API_KEY",
        iv: "iv:a-value",
        ciphertext: "cipher:a-value",
        auth_tag: "tag:a-value",
        checksum: "sha256:API_KEY:iv:a-value:cipher:a-value:tag:a-value",
        version: 9,
      },
      {
        key_id: "Z_TOKEN",
        iv: "iv:z-value",
        ciphertext: "cipher:z-value",
        auth_tag: "tag:z-value",
        checksum: "sha256:Z_TOKEN:iv:z-value:cipher:z-value:tag:z-value",
        version: 9,
      },
    ])
    expect(mockedEncrypt).toHaveBeenCalledWith("a-value", key)
  })

  it("carries each blob's kind into the decrypted secret", async () => {
    const secrets = await decryptVault([vaultBlob({ key_id: "TOKEN", kind: "secret" })], {} as CryptoKey)

    expect(secrets[0].kind).toBe("secret")
  })

  it("leaves kind out for a variable whose kind was never chosen", async () => {
    const [secret] = await decryptVault([vaultBlob({ key_id: "OLD", kind: null })], {} as CryptoKey)
    const [blob] = await encryptVault([secret], {} as CryptoKey, 2)

    expect(secret.kind).toBeUndefined()
    expect("kind" in blob).toBe(false)
  })

  it("sends kind only for secrets that have one", async () => {
    const blobs = await encryptVault(
      [
        { key: "A_TOKEN", value: "a", kind: "secret" },
        { key: "B_URL", value: "b" },
      ],
      {} as CryptoKey,
      2
    )

    expect(blobs[0].kind).toBe("secret")
    expect("kind" in blobs[1]).toBe(false)
  })

  it("computes checksums from the canonical key, iv, ciphertext, and auth tag shape", async () => {
    await encryptVault([{ key: "DATABASE_URL", value: "postgres://local" }], {} as CryptoKey, 3)

    expect(mockedChecksum).toHaveBeenCalledWith(
      "DATABASE_URL:iv:postgres://local:cipher:postgres://local:tag:postgres://local"
    )
  })

  it("decrypts a child's resolved view with each blob's own environment key", async () => {
    const keys: Record<string, CryptoKey> = { "env-dev": { id: "dev" } as unknown as CryptoKey, "env-wt": { id: "wt" } as unknown as CryptoKey }
    const keyFor = jest.fn(async (environmentId: string) => keys[environmentId])
    const blob = (over: Partial<VaultResolvedBlob>): VaultResolvedBlob => ({
      ...vaultBlob({}), source_environment_name: "dev/wt-x", origin: "local", ...over,
    })

    const secrets = await decryptResolved(
      [
        blob({ key_id: "PORT", ciphertext: "p", environment_id: "env-wt" }),
        blob({ key_id: "DATABASE_URL", ciphertext: "d", environment_id: "env-dev", origin: "inherited", source_environment_name: "dev" }),
      ],
      keyFor
    )

    expect(secrets.map((secret) => [secret.key, secret.inheritedFrom])).toEqual([
      ["DATABASE_URL", "dev"],
      ["PORT", null],
    ])
    expect(mockedDecrypt).toHaveBeenCalledWith("d", keys["env-dev"], "iv", "auth-tag")
    expect(mockedDecrypt).toHaveBeenCalledWith("p", keys["env-wt"], "iv", "auth-tag")
  })

  it("merges a child's own secrets with what it still inherits", () => {
    const resolved = [
      { key: "A", value: "a", inheritedFrom: "dev" },
      { key: "B", value: "b", inheritedFrom: "dev" },
      { key: "C", value: "own-old", inheritedFrom: null },
      { key: "D", value: "d", inheritedFrom: "dev" },
    ]
    const own = [{ key: "B", value: "override" }, { key: "E", value: "new" }]

    expect(mergeInherited(own, resolved, ["D"]).map((secret) => [secret.key, secret.value])).toEqual([
      ["A", "a"],
      ["B", "override"],
      ["E", "new"],
    ])
  })
})
