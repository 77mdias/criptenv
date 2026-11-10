import type { DecryptedSecret } from "@/components/shared/secret-row"
import { integrationsApi } from "@/lib/api"
import type { Integration, IntegrationListResponse } from "@/lib/api"

export interface AutoSyncResult {
  integration: Integration
  target: string
  ok: boolean
  /** The provider's or the API's error when `ok` is false. */
  message: string | null
  deployScheduled: boolean
  /** Keys this send asked the provider to remove; still there when `ok` is false. */
  deleteKeys: string[]
}

/** Connections that receive this environment. Empty when the owner's plan lacks "auto_sync". */
export function autoSyncTargets(
  list: IntegrationListResponse,
  environmentId: string,
): { integration: Integration; target: string }[] {
  if (!list.features.includes("auto_sync")) return []
  return list.integrations.flatMap((integration) => {
    const target = integration.auto_sync_targets[environmentId]
    return target ? [{ integration, target }] : []
  })
}

/** Keys that were in the vault before a save and are gone after it: the ones to remove at the provider. */
export function removedKeys(previous: DecryptedSecret[], next: DecryptedSecret[]): string[] {
  const kept = new Set(next.map((secret) => secret.key))
  return previous.filter((secret) => !kept.has(secret.key)).map((secret) => secret.key)
}

/**
 * Sends the environment to every connection bound to it, after the vault was saved.
 * Never rejects: the vault write already happened, so a failure here is only reported.
 */
export async function runAutoSync(
  projectId: string,
  environmentId: string,
  secrets: DecryptedSecret[],
  removedKeys: string[],
  /** Removals an earlier failed send still owes a connection. */
  owedDeletes: (integrationId: string) => string[] = () => [],
): Promise<AutoSyncResult[]> {
  let targets: ReturnType<typeof autoSyncTargets>
  try {
    // Listed on every save: the binding may have changed in another tab.
    targets = autoSyncTargets(await integrationsApi.list(projectId), environmentId)
  } catch {
    return []
  }

  const present = new Set(secrets.map((secret) => secret.key))
  return Promise.all(
    targets.map(async ({ integration, target }): Promise<AutoSyncResult> => {
      // A key that exists again is not removed, even if an earlier removal of it is still owed.
      const deleteKeys = [...new Set([...owedDeletes(integration.id), ...removedKeys])].filter(
        (key) => !present.has(key),
      )
      try {
        const response = await integrationsApi.sync(projectId, integration.id, {
          direction: "push",
          environment: target,
          secrets: secrets.map(({ key, value, kind }) => ({ key, value, ...(kind ? { kind } : {}) })),
          ...(deleteKeys.length > 0 ? { delete_keys: deleteKeys } : {}),
        })
        return {
          integration,
          target,
          ok: response.success,
          message: response.success ? null : response.message,
          deployScheduled: Boolean(response.deploy_scheduled),
          deleteKeys,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : null
        return { integration, target, ok: false, message, deployScheduled: false, deleteKeys }
      }
    }),
  )
}

/**
 * The automatic send of one project, for the lifetime of a page:
 * - one send at a time, in the order of the saves (an older push answering last would leave an
 *   older value at the host, or remove a key the next save created again);
 * - a removal the host did not get is kept and sent again with the next save or resend, so a
 *   variable deleted in CriptEnv does not stay live there after a failure.
 */
export function createAutoSyncRunner(projectId: string) {
  let tail: Promise<unknown> = Promise.resolve()
  const owed = new Map<string, string[]>()
  const slot = (environmentId: string, integrationId: string) => `${environmentId}:${integrationId}`

  return function run(
    environmentId: string,
    secrets: DecryptedSecret[],
    removedKeys: string[],
  ): Promise<AutoSyncResult[]> {
    const next = tail.then(async () => {
      const results = await runAutoSync(
        projectId,
        environmentId,
        secrets,
        removedKeys,
        (integrationId) => owed.get(slot(environmentId, integrationId)) ?? [],
      )
      for (const result of results) {
        const key = slot(environmentId, result.integration.id)
        if (result.ok || result.deleteKeys.length === 0) owed.delete(key)
        else owed.set(key, result.deleteKeys)
      }
      return results
    })
    tail = next.catch(() => undefined)
    return next
  }
}
