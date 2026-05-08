"use client"

import { useState, useEffect, useCallback } from "react"
import { Copy, Check, Timer, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ContributionQRPanelProps {
  qrCodeBase64: string
  copyPasteCode: string
  expiresAt: string
  status: string
  amount: number
  onRetry: () => void
}

function formatTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return "00:00"
  const minutes = Math.floor(diff / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case "PAID":
      return "success"
    case "PENDING":
    case "IN_PROCESS":
      return "warning"
    case "EXPIRED":
    case "CANCELLED":
    case "FAILED":
      return "danger"
    default:
      return "default"
  }
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "Aguardando pagamento",
    IN_PROCESS: "Processando",
    PAID: "Pagamento confirmado",
    EXPIRED: "Expirado",
    CANCELLED: "Cancelado",
    FAILED: "Falhou",
    REFUNDED: "Reembolsado",
  }
  return labels[status] || status
}

export function ContributionQRPanel({
  qrCodeBase64,
  copyPasteCode,
  expiresAt,
  status,
  amount,
  onRetry,
}: ContributionQRPanelProps) {
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState(() => formatTimeLeft(expiresAt))

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(formatTimeLeft(expiresAt))
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(copyPasteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback ignored
    }
  }, [copyPasteCode])

  const isExpired = status === "EXPIRED" || timeLeft === "00:00"
  const isPaid = status === "PAID"
  const isTerminal = ["PAID", "EXPIRED", "CANCELLED", "FAILED", "REFUNDED"].includes(status)

  if (isPaid) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-50 dark:bg-green-500/10">
          <Check className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-[var(--text-primary)]">
            Pagamento confirmado!
          </h3>
          <p className="mt-2 text-sm text-[var(--text-tertiary)]">
            Obrigado por contribuir com <strong className="text-[var(--text-secondary)]">R$ {amount.toFixed(2)}</strong>.<br />
            Seu apoio mantém o CriptEnv vivo e open source.
          </p>
        </div>
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Fazer outra contribuição
        </Button>
      </div>
    )
  }

  if (isExpired || status === "CANCELLED" || status === "FAILED") {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
          <Timer className="h-10 w-10 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-[var(--text-primary)]">
            {isExpired ? "QR Code expirado" : "Pagamento não realizado"}
          </h3>
          <p className="mt-2 text-sm text-[var(--text-tertiary)]">
            {isExpired
              ? "O tempo para pagamento com Pix expirou."
              : "Não foi possível processar este pagamento."}
          </p>
        </div>
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Status */}
      <div className="flex items-center justify-between">
        <Badge variant={statusBadgeVariant(status)}>{statusLabel(status)}</Badge>
        {!isTerminal && (
          <span className="flex items-center gap-1.5 font-mono text-xs text-[var(--text-muted)]">
            <Timer className="h-3.5 w-3.5" />
            Expira em {timeLeft}
          </span>
        )}
      </div>

      {/* QR Code */}
      <div className="mx-auto w-fit">
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${qrCodeBase64}`}
            alt="QR Code Pix"
            width={200}
            height={200}
            className="block"
          />
        </div>
      </div>

      {/* Copy-paste code */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-[var(--text-muted)]">
          Ou copie o código Pix
        </span>
        <div className="relative">
          <div
            className={cn(
              "break-all rounded-lg border border-[var(--border)] bg-black/[0.03] p-3 pr-12 font-mono text-xs text-[var(--text-secondary)] dark:bg-white/[0.04]"
            )}
          >
            {copyPasteCode}
          </div>
          <button
            onClick={handleCopy}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--background-muted)] hover:text-[var(--text-primary)]"
            aria-label={copied ? "Copiado" : "Copiar código Pix"}
            title={copied ? "Copiado" : "Copiar código Pix"}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--background-subtle)] p-3">
        <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">
          Abra o app do seu banco, escolha pagamento via Pix e escaneie o QR code
          ou cole o código acima.
        </p>
      </div>
    </div>
  )
}
