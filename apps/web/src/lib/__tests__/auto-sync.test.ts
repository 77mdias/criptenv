import { integrationsApi } from "@/lib/api"
import { ApiError } from "@/lib/api/client"
import type { Integration, IntegrationListResponse } from "@/lib/api"
import { autoSyncTargets, createAutoSyncRunner, removedKeys, runAutoSync } from "@/lib/auto-sync"

jest.mock("@/lib/api", () => ({
  integrationsApi: { list: jest.fn(), sync: jest.fn() },
}))

const mockedList = jest.mocked(integrationsApi.list)
const mockedSync = jest.mocked(integrationsApi.sync)

const ENV = "env-production"
const SECRETS = [{ key: "A", value: "1", kind: "secret" as const }, { key: "B", value: "2" }]

function integration(id: string, targets: Record<string, string>, provider = "vercel"): Integration {
  return {
    id,
    project_id: "p1",
    provider,
    name: `conn ${id}`,
    status: "active",
    last_sync_at: null,
    last_error: null,
    created_at: "2026-11-10T00:00:00Z",
    auto_sync_targets: targets,
    redeploy: true,
  }
}

function listing(integrations: Integration[], features = ["auto_sync"]): IntegrationListResponse {
  return { integrations, total: integrations.length, available_providers: [], features }
}

const ok = { success: true, message: null, synced_count: 2, secrets: null }

beforeEach(() => {
  mockedList.mockReset()
  mockedSync.mockReset().mockResolvedValue(ok)
})

describe("autoSyncTargets", () => {
  it("picks the connections bound to the environment, with their target", () => {
    const bound = integration("i1", { [ENV]: "preview" })
    const other = integration("i2", { "env-staging": "production" })
    expect(autoSyncTargets(listing([bound, other]), ENV)).toEqual([{ integration: bound, target: "preview" }])
  })

  it("is empty when the owner's plan lacks auto_sync, even with a stored binding", () => {
    expect(autoSyncTargets(listing([integration("i1", { [ENV]: "production" })], []), ENV)).toEqual([])
  })
})

describe("runAutoSync", () => {
  it("sends the environment to every connection bound to it", async () => {
    mockedList.mockResolvedValue(
      listing([
        integration("i1", { [ENV]: "preview" }),
        integration("i2", { [ENV]: "production" }, "render"),
        integration("i3", {}),
      ]),
    )

    const results = await runAutoSync("p1", ENV, SECRETS, [])

    expect(mockedSync.mock.calls).toEqual([
      ["p1", "i1", { direction: "push", environment: "preview", secrets: [{ key: "A", value: "1", kind: "secret" }, { key: "B", value: "2" }] }],
      ["p1", "i2", { direction: "push", environment: "production", secrets: [{ key: "A", value: "1", kind: "secret" }, { key: "B", value: "2" }] }],
    ])
    expect(results.map((r) => [r.integration.id, r.target, r.ok])).toEqual([
      ["i1", "preview", true],
      ["i2", "production", true],
    ])
  })

  it("sends nothing when the owner's plan lacks auto_sync", async () => {
    mockedList.mockResolvedValue(listing([integration("i1", { [ENV]: "production" })], []))
    expect(await runAutoSync("p1", ENV, SECRETS, [])).toEqual([])
    expect(mockedSync).not.toHaveBeenCalled()
  })

  it("sends nothing for an environment without a binding", async () => {
    mockedList.mockResolvedValue(listing([integration("i1", { "env-staging": "production" })]))
    expect(await runAutoSync("p1", ENV, SECRETS, [])).toEqual([])
    expect(mockedSync).not.toHaveBeenCalled()
  })

  it("passes removed keys as delete_keys, even when no secret is left", async () => {
    mockedList.mockResolvedValue(listing([integration("i1", { [ENV]: "production" })]))

    await runAutoSync("p1", ENV, [], ["GONE"])

    expect(mockedSync).toHaveBeenCalledWith("p1", "i1", {
      direction: "push",
      environment: "production",
      secrets: [],
      delete_keys: ["GONE"],
    })
  })

  it("reports a provider failure without throwing", async () => {
    mockedList.mockResolvedValue(listing([integration("i1", { [ENV]: "production" })]))
    mockedSync.mockResolvedValue({ success: false, message: "boom", synced_count: null, secrets: null })

    const [result] = await runAutoSync("p1", ENV, SECRETS, [])

    expect(result).toMatchObject({ ok: false, message: "boom", deployScheduled: false })
  })

  it("reports a 402 or a network error without throwing, and still sends to the others", async () => {
    mockedList.mockResolvedValue(
      listing([integration("i1", { [ENV]: "production" }), integration("i2", { [ENV]: "production" })]),
    )
    mockedSync
      .mockRejectedValueOnce(new ApiError("Plan feature required: auto_sync", 402, {}))
      .mockResolvedValueOnce(ok)

    const results = await runAutoSync("p1", ENV, SECRETS, ["X"])

    expect(results.map((r) => [r.ok, r.message])).toEqual([
      [false, "Plan feature required: auto_sync"],
      [true, null],
    ])
  })

  it("resolves to [] when listing the connections fails", async () => {
    mockedList.mockRejectedValue(new Error("offline"))
    expect(await runAutoSync("p1", ENV, SECRETS, [])).toEqual([])
  })

  it("flags deployScheduled from the response", async () => {
    mockedList.mockResolvedValue(listing([integration("i1", { [ENV]: "production" })]))
    mockedSync.mockResolvedValue({ ...ok, deploy_scheduled: true })

    const [result] = await runAutoSync("p1", ENV, SECRETS, [])

    expect(result.deployScheduled).toBe(true)
  })
})

describe("removedKeys", () => {
  it("lists the keys that were saved before and are gone now", () => {
    const before = [{ key: "A", value: "1" }, { key: "B", value: "2" }, { key: "C", value: "3" }]
    expect(removedKeys(before, [{ key: "B", value: "changed" }, { key: "D", value: "new" }])).toEqual(["A", "C"])
  })

  it("is empty when keys were only added or edited", () => {
    expect(removedKeys([{ key: "A", value: "1" }], [{ key: "A", value: "2" }, { key: "B", value: "3" }])).toEqual([])
  })
})

describe("createAutoSyncRunner", () => {
  const bound = () => listing([integration("i1", { [ENV]: "production" })])
  const failed = { success: false, message: "boom", synced_count: null, secrets: null }
  const sentBodies = () => mockedSync.mock.calls.map(([, , body]) => body)

  it("sends consecutive saves one at a time, in the order they were made", async () => {
    mockedList.mockResolvedValue(bound())
    const releases: Array<() => void> = []
    mockedSync.mockImplementation(() => new Promise((resolve) => releases.push(() => resolve(ok))))
    const run = createAutoSyncRunner("p1")

    const first = run(ENV, [{ key: "A", value: "old" }], [])
    const second = run(ENV, [{ key: "A", value: "new" }], [])
    await new Promise((resolve) => setTimeout(resolve, 0))

    // The newer save waits: an older push answering last would leave the old value at the host.
    expect(sentBodies().map((body) => body.secrets?.[0].value)).toEqual(["old"])
    releases[0]()
    await first
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(sentBodies().map((body) => body.secrets?.[0].value)).toEqual(["old", "new"])
    releases[1]()
    await second
  })

  it("keeps a removal the host did not get and sends it again with the next save", async () => {
    mockedList.mockResolvedValue(bound())
    mockedSync.mockResolvedValueOnce(failed).mockResolvedValue(ok)
    const run = createAutoSyncRunner("p1")

    const [lost] = await run(ENV, [{ key: "B", value: "2" }], ["A"])
    expect(lost).toMatchObject({ ok: false, deleteKeys: ["A"] })

    await run(ENV, [{ key: "B", value: "3" }], [])
    expect(sentBodies()[1].delete_keys).toEqual(["A"])

    // Delivered: nothing is owed any more.
    await run(ENV, [{ key: "B", value: "4" }], [])
    expect(sentBodies()[2]).not.toHaveProperty("delete_keys")
  })

  it("does not remove a key that was created again before the retry", async () => {
    mockedList.mockResolvedValue(bound())
    mockedSync.mockResolvedValueOnce(failed).mockResolvedValue(ok)
    const run = createAutoSyncRunner("p1")

    await run(ENV, [], ["A"])
    await run(ENV, [{ key: "A", value: "back" }], [])

    expect(sentBodies()[1]).not.toHaveProperty("delete_keys")
  })

  it("keeps what is owed apart per environment", async () => {
    mockedList.mockResolvedValue(
      listing([integration("i1", { [ENV]: "production", "env-staging": "preview" })]),
    )
    mockedSync.mockResolvedValueOnce(failed).mockResolvedValue(ok)
    const run = createAutoSyncRunner("p1")

    await run(ENV, [], ["A"])
    await run("env-staging", [{ key: "B", value: "1" }], [])

    expect(sentBodies()[1]).not.toHaveProperty("delete_keys")
  })

  it("keeps going after a run that threw", async () => {
    mockedList.mockResolvedValue(bound())
    mockedSync.mockImplementationOnce(() => {
      throw new Error("sync blew up")
    })
    const run = createAutoSyncRunner("p1")

    const [broken] = await run(ENV, SECRETS, [])
    const [fine] = await run(ENV, SECRETS, [])

    expect([broken.ok, fine.ok]).toEqual([false, true])
  })
})
