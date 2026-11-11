"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { useParams } from "next/navigation"
import { GitCompareArrows } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { VaultUnlockPanel } from "@/components/shared/vault-unlock-panel"
import { peekCached, projectsApi, vaultApi } from "@/lib/api"
import type { Project } from "@/lib/api"
import type { SecretMatrixResponse } from "@/lib/api/projects"
import { deriveProjectEnvironmentKey } from "@/lib/crypto"
import { compareKeys, compareValues, type ValueComparison } from "@/lib/projects/compare"
import { useCryptoStore } from "@/stores/crypto"
import { decryptVault } from "../secrets/vault-crypto"

const selectClass =
  "h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-3 text-sm text-(--text-primary)"

function KeyList({ title, keys, empty }: { title: string; keys: string[]; empty: string }) {
  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold text-(--text-primary)">
        {title} <span className="font-mono text-xs text-(--text-muted)">({keys.length})</span>
      </h2>
      {keys.length === 0 ? (
        <p className="text-xs text-(--text-tertiary)">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {keys.map((key) => (
            <li key={key} className="break-all font-mono text-xs text-(--text-secondary)">
              {key}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default function CompareEnvironmentsPage() {
  const projectId = useParams().id as string
  // Another project is another comparison: start over instead of keeping its environment ids.
  return <CompareEnvironments key={projectId} projectId={projectId} />
}

function CompareEnvironments({ projectId }: { projectId: string }) {
  const t = useTranslations("dashboard.comparePage")
  // Bumped whenever the environments change: a comparison that finishes later is dropped.
  const runRef = useRef(0)
  const [project, setProject] = useState<Project | null>(() => peekCached<Project>(`/api/v1/projects/${projectId}`))
  const [matrix, setMatrix] = useState<SecretMatrixResponse | null>(null)
  const [envA, setEnvA] = useState("")
  const [envB, setEnvB] = useState("")
  const [values, setValues] = useState<ValueComparison[] | null>(null)
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { projectId: unlockedProjectId, keyMaterial, unlockProject } = useCryptoStore()
  // A key unlocked for another project must never be tried here.
  const unlocked = unlockedProjectId === projectId && keyMaterial !== null

  useEffect(() => {
    let cancelled = false
    Promise.all([projectsApi.secretMatrix(projectId), projectsApi.get(projectId)])
      .then(([data, projectData]) => {
        if (cancelled) return
        setMatrix(data)
        setProject(projectData)
        setEnvA((current) => current || data.environments[0]?.id || "")
        setEnvB((current) => current || data.environments[1]?.id || data.environments[0]?.id || "")
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : t("loadError")))
    return () => {
      cancelled = true
    }
  }, [projectId, t])

  const keys = useMemo(() => (matrix ? compareKeys(matrix, envA, envB) : null), [matrix, envA, envB])
  const envName = (id: string) => matrix?.environments.find((env) => env.id === id)?.name ?? ""

  const choose = (side: "a" | "b", id: string) => {
    runRef.current += 1
    setComparing(false)
    setValues(null)
    if (side === "a") setEnvA(id)
    else setEnvB(id)
  }

  const runValueComparison = async () => {
    if (!unlocked || !keyMaterial) return
    const run = ++runRef.current
    setComparing(true)
    setError(null)
    try {
      const [pullA, pullB, keyA, keyB] = await Promise.all([
        vaultApi.pull(projectId, envA),
        vaultApi.pull(projectId, envB),
        deriveProjectEnvironmentKey(keyMaterial, envA),
        deriveProjectEnvironmentKey(keyMaterial, envB),
      ])
      const [secretsA, secretsB] = await Promise.all([decryptVault(pullA.blobs, keyA), decryptVault(pullB.blobs, keyB)])
      if (run === runRef.current) setValues(compareValues(secretsA, secretsB))
    } catch {
      if (run === runRef.current) setError(t("compareError"))
    } finally {
      if (run === runRef.current) setComparing(false)
    }
  }

  if (!matrix && !error) {
    return (
      <Card className="space-y-3 p-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-24 w-full" />
      </Card>
    )
  }

  if (matrix && matrix.environments.length < 2) {
    return (
      <Card className="p-0">
        <EmptyState icon={GitCompareArrows} title={t("needTwo.title")} description={t("needTwo.description")} />
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
        <p className="mt-1 text-sm text-(--text-tertiary)">{t("subtitle")}</p>
      </div>

      {error && (
        <Card className="border-red-500/50 p-4">
          <p role="alert" className="font-mono text-sm text-red-600">
            {error}
          </p>
        </Card>
      )}

      {matrix && keys && (
        <>
          <Card className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="block font-mono text-xs text-(--text-muted)">{t("envA")}</span>
              <select className={selectClass} value={envA} onChange={(e) => choose("a", e.target.value)}>
                {matrix.environments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="block font-mono text-xs text-(--text-muted)">{t("envB")}</span>
              <select className={selectClass} value={envB} onChange={(e) => choose("b", e.target.value)}>
                {matrix.environments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name}
                  </option>
                ))}
              </select>
            </label>
            {envA === envB && <p className="text-xs text-(--text-tertiary) sm:col-span-2">{t("sameEnv")}</p>}
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KeyList title={t("onlyIn", { env: envName(envA) })} keys={keys.onlyA} empty={t("none")} />
            <KeyList title={t("onlyIn", { env: envName(envB) })} keys={keys.onlyB} empty={t("none")} />
            <KeyList title={t("inBoth")} keys={keys.both} empty={t("none")} />
          </div>

          <Card className="space-y-4 p-4 md:p-6">
            <div>
              <h2 className="text-sm font-semibold text-(--text-primary)">{t("values.title")}</h2>
              <p className="mt-1 text-sm text-(--text-secondary)">{t("values.description")}</p>
            </div>
            {!unlocked ? (
              <VaultUnlockPanel
                vaultConfig={project?.vault_config}
                onUnlock={(material) => unlockProject(projectId, material.keyMaterial, material.vaultProof)}
              />
            ) : values === null ? (
              <Button onClick={runValueComparison} loading={comparing} disabled={envA === envB || keys.both.length === 0}>
                {t("values.run")}
              </Button>
            ) : values.length === 0 ? (
              <p className="text-sm text-(--text-tertiary)">{t("values.nothingInBoth")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-(--border) font-mono text-xs text-(--text-muted)">
                      <th className="py-2 pr-4 font-medium">{t("values.key")}</th>
                      <th className="py-2 pr-4 font-medium">{t("values.result")}</th>
                      <th className="py-2 pr-4 font-medium">{envName(envA)}</th>
                      <th className="py-2 font-medium">{envName(envB)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {values.map((row) => (
                      <tr key={row.key} className="border-b border-(--border) last:border-0">
                        <td className="break-all py-2 pr-4 font-mono text-xs">{row.key}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={row.same ? "success" : "warning"}>
                            {row.same ? t("values.same") : t("values.different")}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs text-(--text-tertiary)">{row.a}</td>
                        <td className="py-2 font-mono text-xs text-(--text-tertiary)">{row.b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
