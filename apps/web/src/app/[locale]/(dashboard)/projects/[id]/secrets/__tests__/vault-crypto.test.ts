import type { DecryptedSecret } from "@/components/shared/secret-row"
import type { VaultBlob } from "@/lib/api"
import { checksum, decrypt, encrypt } from "@/lib/crypto"
import { decryptVault, encryptVault } from "../vault-crypto"

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
        updatedAt: "2026-05-01T00:00:00.000Z",
      },
      {
        key: "Z_TOKEN",
        value: "plain:z",
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

  it("computes checksums from the canonical key, iv, ciphertext, and auth tag shape", async () => {
    await encryptVault([{ key: "DATABASE_URL", value: "postgres://local" }], {} as CryptoKey, 3)

    expect(mockedChecksum).toHaveBeenCalledWith(
      "DATABASE_URL:iv:postgres://local:cipher:postgres://local:tag:postgres://local"
    )
  })
})
