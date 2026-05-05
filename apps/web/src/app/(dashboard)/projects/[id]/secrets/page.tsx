"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { Download, KeyRound, Lock, Plus, RefreshCw, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { EnvSelector } from "@/components/shared/env-selector"
import { ExportModal } from "@/components/shared/export-modal"
import { ImportModal } from "@/components/shared/import-modal"
import { SecretForm, type SecretFormValue } from "@/components/shared/secret-form"
import { SecretsTable } from "@/components/shared/secrets-table"
import {
  applySecretCountMetadata,
  setEnvironmentSecretMetadata,
  syncSecretCountState,
  type SecretCountMetadata,
  type SecretCountState,
} from "@/components/shared/secret-counts"
import { VaultUnlockPanel } from "@/components/shared/vault-unlock-panel"
import { checksum, decrypt, deriveProjectEnvironmentKey, encrypt } from "@/lib/crypto"
import { environmentsApi, peekCached, projectsApi, rotationApi, vaultApi } from "@/lib/api"
import { useCryptoStore } from "@/stores/crypto"
import type {
  Environment,
  EnvironmentListResponse,
  Project,
  SecretExpiration,
  VaultBlob,
  VaultBlobPush,
} from "@/lib/api"
import type { DecryptedSecret } from "@/components/shared/secret-row"

async function decryptVault(blobs: VaultBlob[], key: CryptoKey): Promise<DecryptedSecret[]> {
  const secrets = await Promise.all(
    blobs.map(async (blob) => ({
      key: blob.key_id,
      value: await decrypt(blob.ciphertext, key, blob.iv, blob.auth_tag),
      updatedAt: blob.updated_at || blob.created_at,
    }))
  )

  return secrets.sort((a, b) => a.key.localeCompare(b.key))
}

async function encryptVault(
  secrets: DecryptedSecret[],
  key: CryptoKey,
  version: number
): Promise<VaultBlobPush[]> {
  return Promise.all(
    secrets
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(async (secret) => {
        const encrypted = await encrypt(secret.value, key)
        const digest = await checksum(
          `${secret.key}:${encrypted.iv}:${encrypted.ciphertext}:${encrypted.authTag}`
        )

        return {
          key_id: secret.key,
          iv: encrypted.iv,
          ciphertext: encrypted.ciphertext,
          auth_tag: encrypted.authTag,
          checksum: digest,
          version,
        }
      })
  )
}

export default function SecretsPage() {
  const params = useParams()
  const projectId = params.id as string
  const {
    projectId: unlockedProjectId,
    keyMaterial,
    vaultProof,
    isUnlocked,
    unlockProject,
    clearSession,
  } = useCryptoStore()
  const isProjectUnlocked = isUnlocked && unlockedProjectId === projectId && Boolean(keyMaterial && vaultProof)
  const cachedEnvironments = peekCached<EnvironmentListResponse>(
    `/api/v1/projects/${projectId}/environments`
  )
  const cachedProject = peekCached<Project>(`/api/v1/projects/${projectId}`)

  const [project, setProject] = useState<Project | null>(cachedProject)
  const [environments, setEnvironments] = useState<Environment[]>(cachedEnvironments?.environments ?? [])
  const [activeEnv, setActiveEnv] = useState<Environment | null>(
    cachedEnvironments?.environments[0] ?? null
  )
  const [vaultBlobs, setVaultBlobs] = useState<VaultBlob[]>([])
  const [secrets, setSecrets] = useState<DecryptedSecret[]>([])
  const [expirations, setExpirations] = useState<SecretExpiration[]>([])
  const [secretCountState, setSecretCountState] = useState<SecretCountState>(() =>
    syncSecretCountState(cachedEnvironments?.environments ?? [])
  )
  const secretCounts = secretCountState.counts
  const [vaultVersion, setVaultVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [vaultLoading, setVaultLoading] = useState(
    Boolean(cachedEnvironments && cachedEnvironments.environments.length > 0)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingSecret, setEditingSecret] = useState<DecryptedSecret | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    projectsApi
      .get(projectId)
      .then((data) => {
        if (!cancelled) setProject(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar projeto")
        }
      })

    const loadExpirations = async () => {
      try {
        const data = await rotationApi.listExpiring(projectId, {
          days: 365,
          includeExpired: true,
        })
        if (!cancelled) {
          setExpirations(data.items)
        }
      } catch {
        if (!cancelled) {
          setExpirations([])
        }
      }
    }

    void loadExpirations()

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
        setActiveEnv((current) => {
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
          setError(err instanceof Error ? err.message : "Erro ao carregar ambientes")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

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

  const loadVault = useCallback(
    async (environment: Environment) => {
      setVaultLoading(true)
      setError(null)
      try {
        const data = await vaultApi.pull(projectId, environment.id)
        setVaultBlobs(data.blobs)
        setVaultVersion(data.version)
        setSecretCountState((currentState) =>
          setEnvironmentSecretMetadata(currentState, environment.id, data.blobs.length, data.version)
        )
        if (keyMaterial) {
          const envKey = await deriveProjectEnvironmentKey(keyMaterial, environment.id)
          setSecrets(await decryptVault(data.blobs, envKey))
        } else {
          setSecrets([])
        }
      } catch (err) {
        setVaultBlobs([])
        setSecrets([])
        setError(err instanceof Error ? err.message : "Erro ao carregar secrets")
      } finally {
        setVaultLoading(false)
      }
    },
    [keyMaterial, projectId]
  )

  useEffect(() => {
    if (!activeEnv) return

    let cancelled = false

    vaultApi
      .pull(projectId, activeEnv.id)
      .then(async (data) => {
        const envKey = keyMaterial ? await deriveProjectEnvironmentKey(keyMaterial, activeEnv.id) : null
        const nextSecrets = envKey ? await decryptVault(data.blobs, envKey) : []
        if (cancelled) return
        setVaultBlobs(data.blobs)
        setVaultVersion(data.version)
        setSecretCountState((currentState) =>
          setEnvironmentSecretMetadata(currentState, activeEnv.id, data.blobs.length, data.version)
        )
        setSecrets(nextSecrets)
      })
      .catch((err) => {
        if (!cancelled) {
          setVaultBlobs([])
          setSecrets([])
          setError(err instanceof Error ? err.message : "Erro ao carregar secrets")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setVaultLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeEnv, keyMaterial, projectId])

  useEffect(() => {
    const openNewSecret = () => {
      setEditingSecret(null)
      setFormOpen(true)
    }
    window.addEventListener("criptenv:new-secret", openNewSecret)
    return () => window.removeEventListener("criptenv:new-secret", openNewSecret)
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!keyMaterial || !activeEnv) {
      return
    }

    deriveProjectEnvironmentKey(keyMaterial, activeEnv.id)
      .then((envKey) => decryptVault(vaultBlobs, envKey))
      .then((nextSecrets) => {
        if (!cancelled) {
          setSecrets(nextSecrets)
          setError(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSecrets([])
          setError("Não foi possível descriptografar este vault com a chave atual.")
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeEnv, keyMaterial, vaultBlobs])

  const activeEnvName = activeEnv?.display_name || activeEnv?.name || "environment"
  const activeSecretCount = activeEnv ? (secretCounts[activeEnv.id] ?? secrets.length) : secrets.length

  const pushSecrets = async (nextSecrets: DecryptedSecret[]) => {
    if (!activeEnv || !keyMaterial || !vaultProof) return

    setSaving(true)
    setError(null)
    try {
      const envKey = await deriveProjectEnvironmentKey(keyMaterial, activeEnv.id)
      const blobs = await encryptVault(nextSecrets, envKey, vaultVersion + 1)
      const data = await vaultApi.push(projectId, activeEnv.id, { blobs, vault_proof: vaultProof })
      setVaultBlobs(data.blobs)
      setVaultVersion(data.version)
      setSecretCountState((currentState) =>
        setEnvironmentSecretMetadata(currentState, activeEnv.id, data.blobs.length, data.version)
      )
      setSecrets(await decryptVault(data.blobs, envKey))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar secrets")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSecret = async (secret: SecretFormValue) => {
    const nextSecrets = [
      ...secrets.filter((item) => item.key !== secret.key),
      { key: secret.key, value: secret.value },
    ].sort((a, b) => a.key.localeCompare(b.key))

    await pushSecrets(nextSecrets)
    setFormOpen(false)
    setEditingSecret(null)
  }

  const handleDeleteSecret = async (secret: DecryptedSecret) => {
    if (!window.confirm(`Remover ${secret.key}?`)) return
    await pushSecrets(secrets.filter((item) => item.key !== secret.key))
  }

  const handleImport = async (importedSecrets: DecryptedSecret[]) => {
    const merged = new Map(secrets.map((secret) => [secret.key, secret]))
    for (const secret of importedSecrets) {
      merged.set(secret.key, secret)
    }
    await pushSecrets(Array.from(merged.values()))
  }

  const handleCopy = async (secret: DecryptedSecret) => {
    await navigator.clipboard.writeText(secret.value)
    setCopiedKey(secret.key)
    window.setTimeout(() => setCopiedKey(null), 3000)
    window.setTimeout(() => {
      navigator.clipboard.writeText("").catch(() => undefined)
    }, 30000)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Card className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </Card>
      </div>
    )
  }

  if (environments.length === 0) {
    return (
      <EmptyState
        icon={Lock}
        title="Nenhum ambiente encontrado"
        description="Crie um ambiente para este projeto para começar a armazenar secrets."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Secrets</h1>
          <p className="mt-1 font-mono text-sm text-[var(--text-tertiary)]">
            {activeEnvName} · {activeSecretCount} secrets · vault v{vaultVersion}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
      {isProjectUnlocked && (
            <>
              <Button variant="secondary" size="sm" icon={Upload} onClick={() => setImportOpen(true)}>
                Importar
              </Button>
              <Button variant="secondary" size="sm" icon={Download} onClick={() => setExportOpen(true)}>
                Exportar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={RefreshCw}
                onClick={() => activeEnv && loadVault(activeEnv)}
              >
                Atualizar
              </Button>
              <Button
                size="sm"
                icon={Plus}
                onClick={() => {
                  setEditingSecret(null)
                  setFormOpen(true)
                }}
              >
                Novo Secret
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-red-500/50 p-4">
          <p className="font-mono text-sm text-red-600">{error}</p>
        </Card>
      )}

      <EnvSelector
        environments={environments}
        activeEnvironmentId={activeEnv?.id ?? null}
        secretCounts={secretCounts}
        onSelect={(environment) => {
          setVaultLoading(true)
          setActiveEnv(environment)
        }}
      />

      {!isProjectUnlocked ? (
        <VaultUnlockPanel
          vaultConfig={project?.vault_config}
          onUnlock={(material) => unlockProject(projectId, material.keyMaterial, material.vaultProof)}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div className="flex items-center gap-2 font-mono text-xs text-[var(--text-muted)]">
              <KeyRound className="h-3.5 w-3.5" />
              Vault desbloqueado apenas nesta sessão
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSecrets([])
                clearSession()
              }}
            >
              Bloquear
            </Button>
          </div>
          {vaultLoading || saving ? (
            <div className="space-y-0">
              {[1, 2, 3].map((item) => (
                <div key={item} className="border-b border-[var(--border)] px-6 py-4 last:border-0">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-2 h-3 w-64" />
                </div>
              ))}
            </div>
          ) : (
            <SecretsTable
              secrets={secretsWithExpiration}
              environmentName={activeEnvName}
              copiedKey={copiedKey}
              onCopy={handleCopy}
              onEdit={(secret) => {
                setEditingSecret(secret)
                setFormOpen(true)
              }}
              onDelete={handleDeleteSecret}
              onCreate={() => {
                setEditingSecret(null)
                setFormOpen(true)
              }}
            />
          )}
        </Card>
      )}

      <SecretForm
        open={formOpen}
        title={editingSecret ? "Editar Secret" : "Novo Secret"}
        initialValue={editingSecret}
        loading={saving}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditingSecret(null)
        }}
        onSubmit={handleSaveSecret}
      />
      <ImportModal open={importOpen} onOpenChange={setImportOpen} onImport={handleImport} />
      <ExportModal open={exportOpen} onOpenChange={setExportOpen} secrets={secrets} />
    </div>
  )
}
