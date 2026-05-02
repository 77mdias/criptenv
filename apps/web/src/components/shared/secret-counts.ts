export interface SecretCountEnvironment {
  id: string
  secrets_count?: number
  secrets_version?: number
}

export type SecretCounts = Record<string, number>
export type SecretCountVersions = Record<string, number>

export interface SecretCountState {
  counts: SecretCounts
  versions: SecretCountVersions
}

export interface SecretCountMetadata {
  environmentId: string
  count: number
  version: number
}

export function syncSecretCounts(
  environments: SecretCountEnvironment[],
  currentCounts: SecretCounts = {}
): SecretCounts {
  return Object.fromEntries(
    environments.map((environment) => [
      environment.id,
      currentCounts[environment.id] ?? environment.secrets_count ?? 0,
    ])
  )
}

export function syncSecretCountVersions(
  environments: SecretCountEnvironment[],
  currentVersions: SecretCountVersions = {}
): SecretCountVersions {
  return Object.fromEntries(
    environments.map((environment) => {
      const currentVersion = currentVersions[environment.id]
      const nextVersion = environment.secrets_version ?? 0

      return [
        environment.id,
        currentVersion === undefined ? nextVersion : Math.max(currentVersion, nextVersion),
      ]
    })
  )
}

export function syncSecretCountState(
  environments: SecretCountEnvironment[],
  currentState: SecretCountState = { counts: {}, versions: {} }
): SecretCountState {
  return {
    counts: syncSecretCounts(environments, currentState.counts),
    versions: syncSecretCountVersions(environments, currentState.versions),
  }
}

export function setEnvironmentSecretCount(
  currentCounts: SecretCounts,
  environmentId: string,
  count: number
): SecretCounts {
  return {
    ...currentCounts,
    [environmentId]: count,
  }
}

export function applySecretCountMetadata(
  currentState: SecretCountState,
  updates: SecretCountMetadata[]
): SecretCountState {
  const counts = { ...currentState.counts }
  const versions = { ...currentState.versions }

  for (const update of updates) {
    const currentVersion = versions[update.environmentId] ?? -1

    if (update.version < currentVersion) {
      continue
    }

    counts[update.environmentId] = update.count
    versions[update.environmentId] = update.version
  }

  return { counts, versions }
}

export function setEnvironmentSecretMetadata(
  currentState: SecretCountState,
  environmentId: string,
  count: number,
  version: number
): SecretCountState {
  return applySecretCountMetadata(currentState, [{ environmentId, count, version }])
}
