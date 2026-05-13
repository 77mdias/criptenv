"use client"

import { useState } from "react"
import { Clipboard, Eye, EyeOff, KeyRound, Pencil, Trash2, RotateCcw, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatRelativeTime } from "@/lib/utils"
import { ExpirationBadge } from "./expiration-badge"

export interface DecryptedSecret {
  key: string
  value: string
  updatedAt?: string | null
  expiresAt?: string | null
  daysUntilExpiration?: number | null
  isExpired?: boolean
}

interface SecretRowProps {
  secret: DecryptedSecret
  environmentName: string
  copied?: boolean
  onCopy: (secret: DecryptedSecret) => void
  onEdit: (secret: DecryptedSecret) => void
  onDelete: (secret: DecryptedSecret) => void
  onRotate?: (secret: DecryptedSecret) => void
  onSetExpiration?: (secret: DecryptedSecret) => void
}

export function SecretRow({
  secret,
  environmentName,
  copied = false,
  onCopy,
  onEdit,
  onDelete,
  onRotate,
  onSetExpiration,
}: SecretRowProps) {
  const [revealed, setRevealed] = useState(false)
  const masked = "••••••••••••••••"

  return (
    <div className="grid grid-cols-1 gap-3 px-4 py-4 transition-colors hover:bg-[var(--background-subtle)] md:grid-cols-[40px_1.2fr_1.8fr_auto] md:items-center md:px-6">
      <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-[var(--background-muted)] text-[var(--text-tertiary)] md:flex">
        <KeyRound className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
          {secret.key}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="px-2 py-0 text-[10px]">
            {environmentName}
          </Badge>
          {secret.updatedAt && (
            <span className="font-mono text-xs text-[var(--text-muted)]">
              {formatRelativeTime(secret.updatedAt)}
            </span>
          )}
          {/* M3.5.7: Expiration badge */}
          {(secret.daysUntilExpiration != null || secret.isExpired) && (
            <ExpirationBadge
              daysUntilExpiration={secret.daysUntilExpiration}
              isExpired={secret.isExpired}
              expiresAt={secret.expiresAt ?? undefined}
            />
          )}
        </div>
      </div>

      <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background-subtle)] px-3 py-2">
        <p className="truncate font-mono text-xs text-[var(--text-secondary)]">
          {revealed ? secret.value : masked}
        </p>
      </div>

      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={revealed ? "Ocultar secret" : "Revelar secret"}
          onClick={() => setRevealed((current) => !current)}
        >
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Copiar valor"
          onClick={() => onCopy(secret)}
        >
          <Clipboard className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Editar secret"
          onClick={() => onEdit(secret)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {onRotate && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Rotacionar secret"
            onClick={() => onRotate(secret)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
        {onSetExpiration && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Configurar expiração"
            onClick={() => onSetExpiration(secret)}
          >
            <Clock className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-600"
          aria-label="Remover secret"
          onClick={() => onDelete(secret)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        {copied && (
          <span className="ml-2 font-mono text-xs text-green-700">copiado</span>
        )}
      </div>
    </div>
  )
}
