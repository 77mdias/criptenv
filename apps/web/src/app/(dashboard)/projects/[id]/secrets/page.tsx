"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Plus, Lock, Copy, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { environmentsApi, vaultApi } from "@/lib/api"
import type { Environment, VaultBlob } from "@/lib/api"

export default function SecretsPage() {
  const params = useParams()
  const projectId = params.id as string

  const [environments, setEnvironments] = useState<Environment[]>([])
  const [activeEnv, setActiveEnv] = useState<Environment | null>(null)
  const [vaultBlobs, setVaultBlobs] = useState<VaultBlob[]>([])
  const [vaultVersion, setVaultVersion] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [vaultLoading, setVaultLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newSecretOpen, setNewSecretOpen] = useState(false)
  const [newSecretKey, setNewSecretKey] = useState("")
  const [newSecretValue, setNewSecretValue] = useState("")
  const [creating, setCreating] = useState(false)

  // Fetch environments on mount
  useEffect(() => {
    async function fetchEnvironments() {
      try {
        setLoading(true)
        const data = await environmentsApi.list(projectId)
        setEnvironments(data.environments)
        if (data.environments.length > 0) {
          setActiveEnv(data.environments[0])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar ambientes")
      } finally {
        setLoading(false)
      }
    }
    fetchEnvironments()
  }, [projectId])

  // Fetch vault when active environment changes
  useEffect(() => {
    if (!activeEnv) return

    async function fetchVault() {
      try {
        setVaultLoading(true)
        const data = await vaultApi.pull(projectId, activeEnv!.name)
        setVaultBlobs(data.blobs)
        setVaultVersion(data.version)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar secrets")
        setVaultBlobs([])
      } finally {
        setVaultLoading(false)
      }
    }
    fetchVault()
  }, [projectId, activeEnv])

  const handleCreateSecret = async () => {
    if (!activeEnv || !newSecretKey.trim() || !newSecretValue.trim()) return
    try {
      setCreating(true)
      const data = await vaultApi.push(projectId, activeEnv.name, {
        blobs: [
          {
            key_id: newSecretKey,
            iv: "",
            ciphertext: newSecretValue,
            auth_tag: "",
          },
        ],
      })
      setVaultBlobs(data.blobs)
      setVaultVersion(data.version)
      setNewSecretOpen(false)
      setNewSecretKey("")
      setNewSecretValue("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar secret")
    } finally {
      setCreating(false)
    }
  }

  const handleCopyKey = (keyId: string) => {
    navigator.clipboard.writeText(keyId)
  }

  if (error && environments.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Secrets</h1>
            <p className="text-red-600 text-sm font-mono mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Secrets</h1>
          <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
            {loading
              ? "Carregando..."
              : `${environments.length} ambientes · ${vaultBlobs.length} secrets · v${vaultVersion}`}
          </p>
        </div>
        <div className="flex gap-2">
          {activeEnv && (
            <Button
              icon={Plus}
              size="sm"
              onClick={() => setNewSecretOpen(!newSecretOpen)}
            >
              Novo Secret
            </Button>
          )}
        </div>
      </div>

      {/* New Secret Form */}
      {newSecretOpen && activeEnv && (
        <Card>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Adicionar novo secret
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
                  Chave
                </label>
                <input
                  type="text"
                  className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
                  placeholder="DATABASE_URL"
                  value={newSecretKey}
                  onChange={(e) => setNewSecretKey(e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
                  Valor
                </label>
                <input
                  type="password"
                  className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
                  placeholder="Valor secreto"
                  value={newSecretValue}
                  onChange={(e) => setNewSecretValue(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setNewSecretOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                loading={creating}
                onClick={handleCreateSecret}
                disabled={!newSecretKey.trim() || !newSecretValue.trim()}
              >
                Salvar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Environment Tabs */}
      {loading ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Card>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <Skeleton className="h-4 w-4" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-6" />
                  <Skeleton className="h-6 w-6" />
                  <Skeleton className="h-6 w-6" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : environments.length === 0 ? (
        <EmptyState
          icon={Lock}
          title="Nenhum ambiente encontrado"
          description="Crie um ambiente para este projeto para começar a armazenar secrets."
        />
      ) : (
        <>
          <div className="flex gap-1 border-b border-[var(--border)]">
            {environments.map((env) => (
              <button
                key={env.id}
                onClick={() => setActiveEnv(env)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeEnv?.id === env.id
                    ? "border-[var(--accent)] text-[var(--text-primary)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {env.display_name || env.name}
                {activeEnv?.id === env.id && (
                  <span className="ml-2 text-xs text-[var(--text-muted)] font-mono">
                    ({vaultBlobs.length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Secrets Table */}
          <Card className="p-0 overflow-hidden">
            {vaultLoading ? (
              <div className="space-y-0">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-[var(--border)] last:border-0">
                    <Skeleton className="h-4 w-4" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-6 w-6" />
                    <Skeleton className="h-6 w-6" />
                    <Skeleton className="h-6 w-6" />
                  </div>
                ))}
              </div>
            ) : vaultBlobs.length === 0 ? (
              <EmptyState
                icon={Lock}
                title="Nenhum secret neste ambiente"
                description="Adicione seu primeiro secret clicando no botão 'Novo Secret' acima."
                className="py-12"
              />
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {vaultBlobs.map((blob) => (
                  <div
                    key={blob.key_id}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--background-subtle)] transition-colors group"
                  >
                    <Lock className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                          {blob.key_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xs text-[var(--text-muted)]">
                          {blob.ciphertext.slice(0, 20)}...
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Copy"
                        onClick={() => handleCopyKey(blob.key_id)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
