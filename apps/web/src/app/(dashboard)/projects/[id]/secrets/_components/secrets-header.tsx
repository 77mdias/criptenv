import { Download, Plus, RefreshCw, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SecretsHeaderProps {
  activeEnvName: string
  activeSecretCount: number
  vaultVersion: number
  isProjectUnlocked: boolean
  onImport: () => void
  onExport: () => void
  onRefresh: () => void
  onCreate: () => void
}

export function SecretsHeader({
  activeEnvName,
  activeSecretCount,
  vaultVersion,
  isProjectUnlocked,
  onImport,
  onExport,
  onRefresh,
  onCreate,
}: SecretsHeaderProps) {
  return (
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
            <Button variant="secondary" size="sm" icon={Upload} onClick={onImport}>
              Importar
            </Button>
            <Button variant="secondary" size="sm" icon={Download} onClick={onExport}>
              Exportar
            </Button>
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRefresh}>
              Atualizar
            </Button>
            <Button size="sm" icon={Plus} onClick={onCreate}>
              Novo Secret
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
