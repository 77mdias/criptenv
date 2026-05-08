import * as core from "@actions/core"
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
        versionOutput: "version",
      },
      () => ({ getJson: mockGetJson, postJson: mockPostJson }) as any,
      [0, 0, 0],
    )

    expect(core.setFailed).toHaveBeenCalledWith(
      "CriptEnv action failed: Login failed: 401",
    )
  })
})
