"use client"

import { Lock } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { SecretRow, type DecryptedSecret } from "@/components/shared/secret-row"

interface SecretsTableProps {
  secrets: DecryptedSecret[]
  environmentName: string
  copiedKey?: string | null
  onCopy: (secret: DecryptedSecret) => void
  onEdit: (secret: DecryptedSecret) => void
  onDelete: (secret: DecryptedSecret) => void
  onCreate: () => void
  onRotate?: (secret: DecryptedSecret) => void
  onSetExpiration?: (secret: DecryptedSecret) => void
}

export function SecretsTable({
  secrets,
  environmentName,
  copiedKey,
  onCopy,
  onEdit,
  onDelete,
  onCreate,
  onRotate,
  onSetExpiration,
}: SecretsTableProps) {
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
    <div className="divide-y divide-[var(--border)]">
      {secrets.map((secret) => (
        <SecretRow
          key={secret.key}
          secret={secret}
          environmentName={environmentName}
          copied={copiedKey === secret.key}
          onCopy={onCopy}
          onEdit={onEdit}
          onDelete={onDelete}
          onRotate={onRotate}
          onSetExpiration={onSetExpiration}
        />
      ))}
    </div>
  )
}
