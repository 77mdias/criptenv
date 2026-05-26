import type { VaultPushRequest } from "../client"

describe("vault api types", () => {
  it("accepts optimistic concurrency version on push payloads", () => {
    const payload = {
      blobs: [],
      vault_proof: "proof",
      expected_version: 7,
    } satisfies VaultPushRequest

    expect(payload.expected_version).toBe(7)
  })
})
