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
): Promise<AutoSyncResult[]> {
  let targets: ReturnType<typeof autoSyncTargets>
  try {
    // Listed on every save: the binding may have changed in another tab.
    targets = autoSyncTargets(await integrationsApi.list(projectId), environmentId)
  } catch {
    return []
  }

  return Promise.all(
    targets.map(async ({ integration, target }): Promise<AutoSyncResult> => {
      try {
        const response = await integrationsApi.sync(projectId, integration.id, {
          direction: "push",
          environment: target,
          secrets: secrets.map(({ key, value, kind }) => ({ key, value, ...(kind ? { kind } : {}) })),
          ...(removedKeys.length > 0 ? { delete_keys: removedKeys } : {}),
        })
        return {
          integration,
          target,
          ok: response.success,
          message: response.success ? null : response.message,
          deployScheduled: Boolean(response.deploy_scheduled),
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : null
        return { integration, target, ok: false, message, deployScheduled: false }
      }
    }),
  )
}
