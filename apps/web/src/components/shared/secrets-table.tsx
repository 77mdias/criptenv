"use client"

import { useEffect, useMemo, useRef } from "react"
import { Lock, Trash2, X } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { SecretRow, type DecryptedSecret } from "@/components/shared/secret-row"
import { Button } from "@/components/ui/button"

interface SecretsTableProps {
  secrets: DecryptedSecret[]
  environmentName: string
  copiedKey?: string | null
  canManageSecrets?: boolean
  selectedKeys?: string[]
  onSelectChange?: (secret: DecryptedSecret, selected: boolean) => void
  onSelectAllChange?: (selected: boolean) => void
  onClearSelection?: () => void
  onBulkDelete?: () => void
  onCopy: (secret: DecryptedSecret) => void
  onEdit: (secret: DecryptedSecret) => void
  onDelete: (secret: DecryptedSecret) => void
  onCreate: () => void
  onRotate?: (secret: DecryptedSecret) => void
  onSetExpiration?: (secret: DecryptedSecret) => void
}

function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean
  indeterminate: boolean
  onChange: (checked: boolean) => void
}) {
  const checkboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      aria-label="Selecionar todas as secrets deste ambiente"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 rounded border-[var(--border)] bg-[var(--surface)] accent-[var(--text-primary)]"
    />
  )
}

export function SecretsTable({
  secrets,
  environmentName,
  copiedKey,
  canManageSecrets = true,
  selectedKeys = [],
  onSelectChange,
  onSelectAllChange,
  onClearSelection,
  onBulkDelete,
  onCopy,
  onEdit,
  onDelete,
  onCreate,
  onRotate,
  onSetExpiration,
}: SecretsTableProps) {
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys])
  const selectedCount = selectedKeys.length
  const selectionEnabled = canManageSecrets && Boolean(onSelectChange && onSelectAllChange)
  const allSelected = selectionEnabled && secrets.length > 0 && selectedCount === secrets.length
  const someSelected = selectionEnabled && selectedCount > 0 && selectedCount < secrets.length

  if (secrets.length === 0) {
    return (
      <EmptyState
        icon={Lock}
        title="Nenhum secret neste ambiente"
        description="Adicione ou importe secrets para começar."
        className="py-12"
        action={{
          label: "Criar Secret",
          onClick: onCreate,
        }}
      />
    )
  }

  return (
    <div>
      {selectionEnabled && (
        <div className="flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--background-subtle)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <label className="flex items-center gap-3 text-sm font-medium text-[var(--text-primary)]">
            <SelectAllCheckbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={(checked) => onSelectAllChange?.(checked)}
            />
            <span>
              {selectedCount > 0
                ? `${selectedCount} de ${secrets.length} selecionadas`
                : `Selecionar todas (${secrets.length})`}
            </span>
          </label>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {selectedCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                className="justify-center"
              >
                <X className="h-3.5 w-3.5" />
                Limpar seleção
              </Button>
            )}
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={selectedCount === 0}
              onClick={onBulkDelete}
              className="justify-center"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir selecionadas
            </Button>
          </div>
        </div>
      )}

      <div className="divide-y divide-[var(--border)]">
        {secrets.map((secret) => (
          <SecretRow
            key={secret.key}
            secret={secret}
            environmentName={environmentName}
            copied={copiedKey === secret.key}
            canManageSecrets={canManageSecrets}
            selectable={selectionEnabled}
            selected={selectedKeySet.has(secret.key)}
            onSelectChange={onSelectChange}
            onCopy={onCopy}
            onEdit={onEdit}
            onDelete={onDelete}
            onRotate={onRotate}
            onSetExpiration={onSetExpiration}
          />
        ))}
      </div>
    </div>
  )
}
