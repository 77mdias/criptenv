import { ApiError } from "../client"
import { queryClient } from "../query-client"
import {
  createPersonalVaultItem,
  deletePersonalVaultItem,
  getPersonalVaultConfig,
  listPersonalVaultItems,
  updatePersonalVaultConfig,
  updatePersonalVaultItem,
} from "../personal-vault"

const envelope = { iv: "A".repeat(16), ciphertext: "B", auth_tag: "C".repeat(24) }
const config = {
  kdf: "PBKDF2-SHA256",
  iterations: 600_000,
  master_salt: "S".repeat(44),
  extra_salt: "T".repeat(44),
  master_wrapped_vault_key: envelope,
  recovery_wrapped_vault_key: envelope,
  extra_wrapped_protected_key: envelope,
  recovery_wrapped_protected_key: envelope,
}

function respond(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body }
}

function lastCall(fetchMock: jest.Mock) {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url, init, body: init.body ? JSON.parse(init.body as string) : undefined }
}

describe("personal vault api", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "http://localhost/")
    queryClient.clear() // the GET cache is module-wide; tests must not see each other's lists
  })

  it("returns null when the vault is not set up", async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(404, { detail: "Personal vault not set up" })) as typeof fetch
    await expect(getPersonalVaultConfig()).resolves.toBeNull()
  })

  it("rethrows other errors", async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(403, { detail: "nope" })) as typeof fetch
    await expect(getPersonalVaultConfig()).rejects.toBeInstanceOf(ApiError)
  })

  it("sends expected_version on updates and hits the right routes", async () => {
    const fetchMock = jest.fn().mockResolvedValue(respond(200, {}))
    global.fetch = fetchMock as typeof fetch

    await updatePersonalVaultConfig(config, 3)
    let call = lastCall(fetchMock)
    expect(call.url).toMatch(/\/api\/v1\/personal-vault\/config$/)
    expect(call.init.method).toBe("PUT")
    expect(call.body).toEqual({ ...config, expected_version: 3 })

    const item = { id: "item-1", protected: true, summary: envelope, body: envelope }
    await updatePersonalVaultItem("item-1", item, 2)
    call = lastCall(fetchMock)
    expect(call.url).toMatch(/\/api\/v1\/personal-vault\/items\/item-1$/)
    // The id travels in the URL only: the body never tries to move an item.
    expect(call.body).toEqual({ protected: true, summary: envelope, body: envelope, expected_version: 2 })

    await createPersonalVaultItem(item)
    expect(lastCall(fetchMock).init.method).toBe("POST")
    expect(lastCall(fetchMock).body).toEqual(item)

    fetchMock.mockResolvedValueOnce(respond(204, null))
    await deletePersonalVaultItem("item-1")
    expect(lastCall(fetchMock).init.method).toBe("DELETE")

    for (const [, init] of fetchMock.mock.calls as [string, RequestInit][]) {
      expect(new Headers(init.headers).has("Authorization")).toBe(false)
      expect(init.credentials).toBe("include")
    }
  })

  it("a version conflict drops cached items so the next list is fresh", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(respond(200, [{ id: "old" }]))
      .mockResolvedValueOnce(respond(409, { detail: "Version conflict" }))
      .mockResolvedValueOnce(respond(200, [{ id: "new" }]))
    global.fetch = fetchMock as typeof fetch

    await expect(listPersonalVaultItems()).resolves.toEqual([{ id: "old" }])
    await expect(
      updatePersonalVaultItem("old", { id: "old", protected: false, summary: envelope, body: envelope }, 1),
    ).rejects.toMatchObject({ status: 409 })
    await expect(listPersonalVaultItems()).resolves.toEqual([{ id: "new" }])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("a 404 on a mutation also drops cached items, so a deleted item disappears", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(respond(200, [{ id: "gone" }]))
      .mockResolvedValueOnce(respond(404, { detail: "Item not found" }))
      .mockResolvedValueOnce(respond(200, []))
    global.fetch = fetchMock as typeof fetch

    await expect(listPersonalVaultItems()).resolves.toEqual([{ id: "gone" }])
    await expect(deletePersonalVaultItem("gone")).rejects.toMatchObject({ status: 404 })
    await expect(listPersonalVaultItems()).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
