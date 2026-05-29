"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { SecretFormValue } from "@/components/shared/secret-form"
import type { DecryptedSecret } from "@/components/shared/secret-row"
import {
  applySecretCountMetadata,
  setEnvironmentSecretMetadata,
  syncSecretCountState,
  type SecretCountMetadata,
  type SecretCountState,
} from "@/components/shared/secret-counts"
import { deriveProjectEnvironmentKey, encrypt } from "@/lib/crypto"
import { environmentsApi, peekCached, projectsApi, rotationApi, vaultApi } from "@/lib/api"
import { useCryptoStore } from "@/stores/crypto"
import type {
  Environment,
  EnvironmentListResponse,
  Project,
  SecretExpiration,
  VaultBlob,
} from "@/lib/api"
import { decryptVault, encryptVault, sortSecrets } from "./vault-crypto"

interface UseProjectSecretsResult {
  state: {
    project: Project | null
    environments: Environment[]
    activeEnv: Environment | null
    secrets: DecryptedSecret[]
    secretsWithExpiration: DecryptedSecret[]
    secretCounts: Record<string, number>
    activeEnvName: string
    activeSecretCount: number
    vaultVersion: number
    loading: boolean
    vaultLoading: boolean
    saving: boolean
    error: string | null
    isProjectUnlocked: boolean
    formOpen: boolean
    editingSecret: DecryptedSecret | null
    importOpen: boolean
    exportOpen: boolean
    copiedKey: string | null
    expirationModalOpen: boolean
    expirationSecret: DecryptedSecret | null
  }
  actions: {
    setActiveEnv: (environment: Environment) => void
    openCreateForm: () => void
    openEditForm: (secret: DecryptedSecret) => void
    setFormOpen: (open: boolean) => void
    setImportOpen: (open: boolean) => void
    setExportOpen: (open: boolean) => void
    refreshVault: () => void
    unlockVault: (material: { keyMaterial: CryptoKey; vaultProof: string }) => void
    lockVault: () => void
    saveSecret: (secret: SecretFormValue) => Promise<void>
    deleteSecret: (secret: DecryptedSecret) => Promise<void>
    importSecrets: (importedSecrets: DecryptedSecret[]) => Promise<void>
    copySecret: (secret: DecryptedSecret) => Promise<void>
    rotateSecret: (secret: DecryptedSecret) => Promise<void>
    openExpirationModal: (secret: DecryptedSecret) => void
    closeExpirationModal: () => void
    saveExpiration: (days: number, policy: string, notifyDays: number) => Promise<void>
    deleteExpiration: () => Promise<void>
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function getEnvironmentName(environment: Environment | null): string {
  return environment?.display_name || environment?.name || "environment"
}

export function useProjectSecrets(projectId: string): UseProjectSecretsResult {
  const cachedEnvironments = peekCached<EnvironmentListResponse>(
    `/api/v1/projects/${projectId}/environments`
  )
  const cachedProject = peekCached<Project>(`/api/v1/projects/${projectId}`)
  const {
    projectId: unlockedProjectId,
    keyMaterial,
    vaultProof,
    isUnlocked,
    unlockProject,
    clearSession,
  } = useCryptoStore()

  const isProjectUnlocked = isUnlocked && unlockedProjectId === projectId && Boolean(keyMaterial && vaultProof)
  const copyTimersRef = useRef<number[]>([])

  const [project, setProject] = useState<Project | null>(cachedProject)
  const [environments, setEnvironments] = useState<Environment[]>(cachedEnvironments?.environments ?? [])
  const [activeEnv, setActiveEnvState] = useState<Environment | null>(
    cachedEnvironments?.environments[0] ?? null
  )
  const [secrets, setSecrets] = useState<DecryptedSecret[]>([])
  const [expirations, setExpirations] = useState<SecretExpiration[]>([])
  const [secretCountState, setSecretCountState] = useState<SecretCountState>(() =>
    syncSecretCountState(cachedEnvironments?.environments ?? [])
  )
  const [vaultVersion, setVaultVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [vaultLoading, setVaultLoading] = useState(
    Boolean(cachedEnvironments && cachedEnvironments.environments.length > 0)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpenState] = useState(false)
  const [editingSecret, setEditingSecret] = useState<DecryptedSecret | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [expirationModalOpen, setExpirationModalOpen] = useState(false)
  const [expirationSecret, setExpirationSecret] = useState<DecryptedSecret | null>(null)

  const refreshExpirations = useCallback(async () => {
    const data = await rotationApi.listExpiring(projectId, { days: 365, includeExpired: true })
    setExpirations(data.items)
  }, [projectId])

  const applyVaultPull = useCallback(
    async (environment: Environment, blobs: VaultBlob[], version: number) => {
      setVaultVersion(version)
      setSecretCountState((currentState) =>
        setEnvironmentSecretMetadata(currentState, environment.id, blobs.length, version)
      )

      if (!keyMaterial) {
        setSecrets([])
        return
      }

      const envKey = await deriveProjectEnvironmentKey(keyMaterial, environment.id)
      setSecrets(await decryptVault(blobs, envKey))
    },
    [keyMaterial]
  )

  const loadVault = useCallback(
    async (environment: Environment, shouldApply: () => boolean = () => true) => {
      setVaultLoading(true)
      setError(null)
      try {
        const data = await vaultApi.pull(projectId, environment.id)
        if (!shouldApply()) return
        await applyVaultPull(environment, data.blobs, data.version)
      } catch (err) {
        if (!shouldApply()) return
        setSecrets([])
        setError(getErrorMessage(err, "Erro ao carregar secrets"))
      } finally {
        if (shouldApply()) {
          setVaultLoading(false)
        }
      }
    },
    [applyVaultPull, projectId]
  )

  useEffect(() => {
    let cancelled = false

    const loadProject = async () => {
      try {
        const data = await projectsApi.get(projectId)
        if (!cancelled) setProject(data)
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, "Erro ao carregar projeto"))
      }
    }

    const loadRotationData = async () => {
      try {
        const data = await rotationApi.listExpiring(projectId, {
          days: 365,
          includeExpired: true,
        })
        if (!cancelled) setExpirations(data.items)
      } catch {
        if (!cancelled) setExpirations([])
      }
    }

    const loadEnvironments = async () => {
      try {
        const data = await environmentsApi.list(projectId)
        if (cancelled) return

        setEnvironments(data.environments)
        setVaultLoading(data.environments.length > 0)
        setSecretCountState((currentState) =>
          data.environments.length === 0
            ? { counts: {}, versions: {} }
            : syncSecretCountState(data.environments, currentState)
        )
        setActiveEnvState((current) => {
          const nextEnv = data.environments[0] ?? null
          return current?.id === nextEnv?.id ? current : nextEnv
        })

        if (data.environments.length > 0) {
          const versionResults = await Promise.allSettled(
            data.environments.map(async (environment): Promise<SecretCountMetadata> => {
              const metadata = await vaultApi.getVersion(projectId, environment.id)

              return {
                environmentId: environment.id,
                count: metadata.blob_count,
                version: metadata.version,
              }
            })
          )

          if (cancelled) return

          const metadataUpdates = versionResults.flatMap((result) =>
            result.status === "fulfilled" ? [result.value] : []
          )

          if (metadataUpdates.length > 0) {
            setSecretCountState((currentState) =>
              applySecretCountMetadata(currentState, metadataUpdates)
            )
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, "Erro ao carregar ambientes"))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadProject()
    void loadRotationData()
    void loadEnvironments()

    return () => {
      cancelled = true
    }
  }, [projectId])

  useEffect(() => {
    if (unlockedProjectId && unlockedProjectId !== projectId) {
      clearSession()
    }
  }, [clearSession, projectId, unlockedProjectId])

  useEffect(() => {
    if (!activeEnv) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      void loadVault(activeEnv, () => !cancelled)
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [activeEnv, loadVault])

  useEffect(() => {
    return () => {
      for (const timer of copyTimersRef.current) {
        window.clearTimeout(timer)
      }
    }
  }, [])

  const secretsWithExpiration = useMemo(() => {
    if (!activeEnv) return secrets

    const expirationByKey = new Map(
      expirations
        .filter((item) => item.environment_id === activeEnv.id)
        .map((item) => [item.secret_key, item])
    )

    return secrets.map((secret) => {
      const expiration = expirationByKey.get(secret.key)
      if (!expiration) return secret

      return {
        ...secret,
        expiresAt: expiration.expires_at,
        daysUntilExpiration: expiration.days_until_expiration,
        isExpired: Boolean(expiration.is_expired),
      }
    })
  }, [activeEnv, expirations, secrets])

  const activeEnvName = getEnvironmentName(activeEnv)
  const activeSecretCount = activeEnv
    ? (secretCountState.counts[activeEnv.id] ?? secrets.length)
    : secrets.length

  const pushSecrets = useCallback(
    async (nextSecrets: DecryptedSecret[]) => {
      if (!activeEnv || !keyMaterial || !vaultProof) return

      setSaving(true)
      setError(null)
      try {
        const envKey = await deriveProjectEnvironmentKey(keyMaterial, activeEnv.id)
        const blobs = await encryptVault(nextSecrets, envKey, vaultVersion + 1)
        const data = await vaultApi.push(projectId, activeEnv.id, {
          blobs,
          vault_proof: vaultProof,
          expected_version: vaultVersion,
        })
        await applyVaultPull(activeEnv, data.blobs, data.version)
      } catch (err) {
        setError(getErrorMessage(err, "Erro ao salvar secrets"))
      } finally {
        setSaving(false)
      }
    },
    [activeEnv, applyVaultPull, keyMaterial, projectId, vaultProof, vaultVersion]
  )

  const openCreateForm = useCallback(() => {
    setEditingSecret(null)
    setFormOpenState(true)
  }, [])

  const openEditForm = useCallback((secret: DecryptedSecret) => {
    setEditingSecret(secret)
    setFormOpenState(true)
  }, [])

  const setFormOpen = useCallback((open: boolean) => {
    setFormOpenState(open)
    if (!open) setEditingSecret(null)
  }, [])

  const saveSecret = useCallback(
    async (secret: SecretFormValue) => {
      const nextSecrets = sortSecrets([
        ...secrets.filter((item) => item.key !== secret.key),
        { key: secret.key, value: secret.value },
      ])

      await pushSecrets(nextSecrets)
      setFormOpenState(false)
      setEditingSecret(null)
    },
    [pushSecrets, secrets]
  )

  const deleteSecret = useCallback(
    async (secret: DecryptedSecret) => {
      await pushSecrets(secrets.filter((item) => item.key !== secret.key))
    },
    [pushSecrets, secrets]
  )

  const importSecrets = useCallback(
    async (importedSecrets: DecryptedSecret[]) => {
      const merged = new Map(secrets.map((secret) => [secret.key, secret]))
      for (const secret of importedSecrets) {
        merged.set(secret.key, secret)
      }
      await pushSecrets(Array.from(merged.values()))
    },
    [pushSecrets, secrets]
  )

  const copySecret = useCallback(async (secret: DecryptedSecret) => {
    for (const timer of copyTimersRef.current) {
      window.clearTimeout(timer)
    }

    await navigator.clipboard.writeText(secret.value)
    setCopiedKey(secret.key)

    copyTimersRef.current = [
      window.setTimeout(() => setCopiedKey(null), 3000),
      window.setTimeout(() => {
        navigator.clipboard.writeText("").catch(() => undefined)
      }, 30000),
    ]
  }, [])

  const rotateSecret = useCallback(
    async (secret: DecryptedSecret) => {
      if (!activeEnv || !keyMaterial || !vaultProof) return

      setSaving(true)
      setError(null)
      try {
        const newValue = crypto.randomUUID().replace(/-/g, "")
        const envKey = await deriveProjectEnvironmentKey(keyMaterial, activeEnv.id)
        const encrypted = await encrypt(newValue, envKey)
        await rotationApi.rotateSecret(projectId, activeEnv.id, secret.key, {
          new_value: newValue,
          iv: encrypted.iv,
          auth_tag: encrypted.authTag,
          reason: "Manual rotation via web dashboard",
        })
        const nextSecrets = secrets.map((item) =>
          item.key === secret.key ? { ...item, value: newValue } : item
        )
        await pushSecrets(nextSecrets)
      } catch (err) {
        setError(getErrorMessage(err, "Erro ao rotacionar secret"))
      } finally {
        setSaving(false)
      }
    },
    [activeEnv, keyMaterial, projectId, pushSecrets, secrets, vaultProof]
  )

  const openExpirationModal = useCallback((secret: DecryptedSecret) => {
    setExpirationSecret(secret)
    setExpirationModalOpen(true)
  }, [])

  const closeExpirationModal = useCallback(() => {
    setExpirationModalOpen(false)
    setExpirationSecret(null)
  }, [])

  const saveExpiration = useCallback(
    async (days: number, policy: string, notifyDays: number) => {
      if (!activeEnv || !expirationSecret) return
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + days)
      await rotationApi.setExpiration(projectId, activeEnv.id, expirationSecret.key, {
        secret_key: expirationSecret.key,
        expires_at: expiresAt.toISOString(),
        rotation_policy: policy,
        notify_days_before: notifyDays,
      })
      await refreshExpirations()
    },
    [activeEnv, expirationSecret, projectId, refreshExpirations]
  )

  const deleteExpiration = useCallback(async () => {
    if (!activeEnv || !expirationSecret) return
    await rotationApi.deleteExpiration(projectId, activeEnv.id, expirationSecret.key)
    await refreshExpirations()
  }, [activeEnv, expirationSecret, projectId, refreshExpirations])

  const refreshVault = useCallback(() => {
    if (activeEnv) {
      void loadVault(activeEnv)
    }
  }, [activeEnv, loadVault])

  const setActiveEnv = useCallback((environment: Environment) => {
    setVaultLoading(true)
    setActiveEnvState(environment)
  }, [])

  const unlockVault = useCallback(
    (material: { keyMaterial: CryptoKey; vaultProof: string }) => {
      unlockProject(projectId, material.keyMaterial, material.vaultProof)
    },
    [projectId, unlockProject]
  )

  const lockVault = useCallback(() => {
    setSecrets([])
    clearSession()
  }, [clearSession])

  return {
    state: {
      project,
      environments,
      activeEnv,
      secrets,
      secretsWithExpiration,
      secretCounts: secretCountState.counts,
      activeEnvName,
      activeSecretCount,
      vaultVersion,
      loading,
      vaultLoading,
      saving,
      error,
      isProjectUnlocked,
      formOpen,
      editingSecret,
      importOpen,
      exportOpen,
      copiedKey,
      expirationModalOpen,
      expirationSecret,
    },
    actions: {
      setActiveEnv,
      openCreateForm,
      openEditForm,
      setFormOpen,
      setImportOpen,
      setExportOpen,
      refreshVault,
      unlockVault,
      lockVault,
      saveSecret,
      deleteSecret,
      importSecrets,
      copySecret,
      rotateSecret,
      openExpirationModal,
      closeExpirationModal,
      saveExpiration,
      deleteExpiration,
    },
  }
}
