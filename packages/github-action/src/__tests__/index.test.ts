import * as core from "@actions/core"
import * as crypto from "crypto"
import { getInputs, normalizeKeyName, retry, run } from "../index"

const mockPostJson = jest.fn()
const mockGetJson = jest.fn()

jest.mock("@actions/core", () => ({
  debug: jest.fn(),
  exportVariable: jest.fn(),
  getInput: jest.fn(),
  info: jest.fn(),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
  setSecret: jest.fn(),
  warning: jest.fn(),
}))

describe("github action", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPostJson.mockReset()
    mockGetJson.mockReset()
  })

  it("normalizes secret keys into environment variable names", () => {
    expect(normalizeKeyName("database-url")).toBe("DATABASE_URL")
    expect(normalizeKeyName("api.key/v1")).toBe("API_KEY_V1")
  })

  it("loads defaults from action inputs", () => {
    jest.mocked(core.getInput).mockImplementation((name: string) => {
      const values: Record<string, string> = {
        token: "ci_token",
        project: "project-id",
        environment: "",
        "api-url": "https://api.example.com/api/v1/",
        prefix: "",
        "version-output": "",
        "vault-password": "",
      }
      return values[name] ?? ""
    })

    expect(getInputs()).toEqual({
      token: "ci_token",
      project: "project-id",
      environment: "production",
      apiUrl: "https://api.example.com/api/v1",
      prefix: "SECRET_",
      versionOutput: "version",
      vaultPassword: "",
    })
  })

  it("retries failed operations", async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce("ok")

    await expect(retry(operation, 2, [0, 0])).resolves.toBe("ok")
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it("exports fetched secrets and masks their values", async () => {
    mockPostJson.mockResolvedValue({
      result: {
        expires_in: 3600,
        permissions: ["read:secrets"],
        project_id: "project-id",
        session_token: "session-token",
      },
      statusCode: 200,
    })
    mockGetJson.mockResolvedValue({
      result: {
        blobs: [
          {
            auth_tag: "tag",
            checksum: "checksum",
            ciphertext: "encrypted-value",
            id: "blob-id",
            iv: "iv",
            key_id: "database-url",
            version: 1,
          },
        ],
        environment: "production",
        environment_id: "env-id",
        version: 7,
      },
      statusCode: 200,
    })

    await run(
      {
        apiUrl: "https://api.example.com/api/v1",
        environment: "production",
        prefix: "SECRET_",
        project: "project-id",
        token: "ci_token",
        vaultPassword: "",
        versionOutput: "vault-version",
      },
      () => ({ getJson: mockGetJson, postJson: mockPostJson }) as any,
      [0, 0, 0],
    )

    expect(core.setSecret).toHaveBeenCalledWith("encrypted-value")
    expect(core.exportVariable).toHaveBeenCalledWith("SECRET_DATABASE_URL", "encrypted-value")
    expect(core.setOutput).toHaveBeenCalledWith("secrets-count", "1")
    expect(core.setOutput).toHaveBeenCalledWith("vault-version", "7")
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it("marks the action failed when login fails", async () => {
    mockPostJson.mockResolvedValue({ result: undefined, statusCode: 401 })

    await run(
      {
        apiUrl: "https://api.example.com/api/v1",
        environment: "production",
        prefix: "SECRET_",
        project: "project-id",
        token: "bad-token",
        vaultPassword: "",
        versionOutput: "version",
      },
      () => ({ getJson: mockGetJson, postJson: mockPostJson }) as any,
      [0, 0, 0],
    )

    expect(core.setFailed).toHaveBeenCalledWith(
      "CriptEnv action failed: Login failed: 401",
    )
  })

  it("decrypts fetched secrets when vault password is provided", async () => {
    const vaultPassword = "vault-password"
    const envId = "env-id"
    const salt = Buffer.from("project-salt-project-salt-123456")
    const proofSalt = Buffer.from("proof-salt-proof-salt-1234567890")
    const masterKey = crypto.pbkdf2Sync(vaultPassword, salt, 100000, 32, "sha256")
    const envKey = crypto.hkdfSync(
      "sha256",
      masterKey,
      Buffer.from(envId),
      Buffer.from("criptenv-vault-v1"),
      32,
    )
    const iv = Buffer.from("123456789012")
    const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(envKey), iv)
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from("plain-secret", "utf8")),
      cipher.final(),
    ])
    const authTag = cipher.getAuthTag()

    mockPostJson.mockResolvedValue({
      result: {
        expires_in: 3600,
        permissions: ["read:secrets"],
        project_id: "project-id",
        session_token: "session-token",
      },
      statusCode: 200,
    })
    mockGetJson.mockResolvedValue({
      result: {
        blobs: [
          {
            auth_tag: authTag.toString("base64"),
            checksum: "checksum",
            ciphertext: ciphertext.toString("base64"),
            id: "blob-id",
            iv: iv.toString("base64"),
            key_id: "database-url",
            version: 1,
          },
        ],
        environment: "production",
        environment_id: envId,
        vault_config: {
          kdf: "PBKDF2-SHA256",
          iterations: 100000,
          proof_salt: proofSalt.toString("base64"),
          salt: salt.toString("base64"),
          verifier_auth_tag: "unused",
          verifier_ciphertext: "unused",
          verifier_iv: "unused",
          version: 1,
        },
        version: 7,
      },
      statusCode: 200,
    })

    await run(
      {
        apiUrl: "https://api.example.com/api/v1",
        environment: "production",
        prefix: "SECRET_",
        project: "project-id",
        token: "ci_token",
        vaultPassword,
        versionOutput: "vault-version",
      },
      () => ({ getJson: mockGetJson, postJson: mockPostJson }) as any,
      [0, 0, 0],
    )

    expect(core.setSecret).toHaveBeenCalledWith("plain-secret")
    expect(core.exportVariable).toHaveBeenCalledWith("SECRET_DATABASE_URL", "plain-secret")
    expect(core.setFailed).not.toHaveBeenCalled()
  })
})
