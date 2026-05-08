"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle, ArrowLeft, HeartHandshake, Loader2, QrCode, ShieldCheck } from "lucide-react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ContributionQRPanel } from "@/components/marketing/contribution-qr-panel"
import {
  contributionsApi,
  type ContributionPixResponse,
  type ContributionStatusResponse,
} from "@/lib/api/contributions"
import { contributionSchema, type ContributionInput } from "@/lib/validators/schemas"

type ContributionFlowStatus = "idle" | "creating" | "pending" | "paid" | "expired" | "error"

function isExpired(expiresAt?: string | null) {
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now())
}

function mapProviderStatus(status: string, expiresAt?: string | null): ContributionFlowStatus {
  if (status === "PAID") return "paid"
  if (status === "EXPIRED" || status === "CANCELLED" || status === "FAILED" || status === "REFUNDED") {
    return "expired"
  }
  if (isExpired(expiresAt)) return "expired"
  return "pending"
}

function toApiPayload(data: ContributionInput) {
  return {
    amount: data.amount,
    ...(data.payer_name ? { payer_name: data.payer_name } : {}),
    ...(data.payer_email ? { payer_email: data.payer_email } : {}),
  }
}

function IdlePanel() {
  return (
    <Card className="min-h-[420px] rounded-xl border-[var(--border)] bg-[var(--surface)]/80 p-8">
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/10">
          <QrCode className="h-8 w-8 text-[var(--accent)]" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Pix instantâneo
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-tertiary)]">
            Sua contribuição ajuda a manter o CriptEnv open source, auditável e disponível para quem precisa proteger secrets sem depender de plataformas fechadas.
          </p>
        </div>
        <div className="grid gap-3">
          {[
            "Pagamento processado via Mercado Pago",
            "Webhook confirma o status automaticamente",
            "Nenhum dado de vault ou secret passa por este fluxo",
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
              <ShieldCheck className="h-4 w-4 shrink-0 text-green-500" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

export default function ContributePage() {
  const [flowStatus, setFlowStatus] = useState<ContributionFlowStatus>("idle")
  const [contribution, setContribution] = useState<ContributionPixResponse | null>(null)
  const [statusResponse, setStatusResponse] = useState<ContributionStatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createdAt, setCreatedAt] = useState<number | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContributionInput>({
    resolver: zodResolver(contributionSchema),
    defaultValues: {
      amount: undefined,
      payer_name: undefined,
      payer_email: undefined,
    },
  })

  const displayedProviderStatus = statusResponse?.status || contribution?.status || "PENDING"
  const displayedExpiresAt = statusResponse?.expires_at || contribution?.expires_at || null
  const displayedAmount = Number(statusResponse?.amount || contribution?.amount || 0)
  const effectiveFlowStatus =
    flowStatus === "pending"
      ? mapProviderStatus(displayedProviderStatus, displayedExpiresAt)
      : flowStatus

  const resetFlow = useCallback(() => {
    setFlowStatus("idle")
    setContribution(null)
    setStatusResponse(null)
    setError(null)
    setCreatedAt(null)
    setLastSyncAt(null)
    reset({
      amount: undefined,
      payer_name: undefined,
      payer_email: undefined,
    })
  }, [reset])

  const refreshStatus = useCallback(
    async (forceSync = false) => {
      if (!contribution || flowStatus !== "pending") return

      try {
        const now = new Date().getTime()
        const shouldSync =
          forceSync ||
          (createdAt !== null &&
            now - createdAt >= 10_000 &&
            (lastSyncAt === null || now - lastSyncAt >= 30_000))

        const nextStatus = shouldSync
          ? await contributionsApi.syncContributionStatus(contribution.contribution_id)
          : await contributionsApi.getContributionStatus(contribution.contribution_id)

        if (shouldSync) {
          setLastSyncAt(now)
        }

        setStatusResponse(nextStatus)
        setFlowStatus(mapProviderStatus(nextStatus.status, nextStatus.expires_at))
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Não foi possível atualizar o status do pagamento"
        setError(message)
        setFlowStatus("error")
      }
    },
    [contribution, createdAt, flowStatus, lastSyncAt]
  )

  useEffect(() => {
    if (!contribution || effectiveFlowStatus !== "pending") return

    const interval = window.setInterval(() => {
      void refreshStatus()
    }, 5_000)

    return () => window.clearInterval(interval)
  }, [contribution, effectiveFlowStatus, refreshStatus])

  const onSubmit = async (data: ContributionInput) => {
    setError(null)
    setStatusResponse(null)
    setFlowStatus("creating")

    try {
      const created = await contributionsApi.createPixContribution(toApiPayload(data))
      setContribution(created)
      setCreatedAt(new Date().getTime())
      setLastSyncAt(null)
      setFlowStatus(mapProviderStatus(created.status, created.expires_at))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Não foi possível gerar o Pix"
      setError(message)
      setFlowStatus("error")
    }
  }

  const statusPanel = useMemo(() => {
    if (effectiveFlowStatus === "creating") {
      return (
        <Card className="flex min-h-[420px] items-center justify-center rounded-xl border-[var(--border)] bg-[var(--surface)]/80 p-8">
          <div className="text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-[var(--accent)]" />
            <p className="mt-4 text-sm text-[var(--text-tertiary)]">Gerando Pix...</p>
          </div>
        </Card>
      )
    }

    if (effectiveFlowStatus === "idle" || !contribution) {
      return <IdlePanel />
    }

    const panelStatus =
      effectiveFlowStatus === "paid"
        ? "PAID"
        : effectiveFlowStatus === "expired"
        ? "EXPIRED"
        : effectiveFlowStatus === "error"
        ? "FAILED"
        : displayedProviderStatus

    return (
      <Card className="min-h-[420px] rounded-xl border-[var(--border)] bg-[var(--surface)]/80 p-6">
        <ContributionQRPanel
          qrCodeBase64={contribution.pix_qr_code_base64}
          copyPasteCode={contribution.pix_copy_paste}
          expiresAt={displayedExpiresAt || contribution.expires_at}
          status={panelStatus}
          amount={displayedAmount}
          onRetry={resetFlow}
        />
      </Card>
    )
  }, [contribution, displayedAmount, displayedExpiresAt, displayedProviderStatus, effectiveFlowStatus, resetFlow])

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--background)] px-6 pb-20 pt-28 sm:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,var(--glow-soft),transparent_32%),linear-gradient(to_bottom,transparent_70%,var(--background-subtle))]" />

      <div className="relative mx-auto w-full max-w-6xl">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 text-sm font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        <section className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/10">
              <HeartHandshake className="h-7 w-7 text-[var(--accent)]" />
            </div>
            <h1 className="mt-8 max-w-3xl text-5xl font-light leading-[0.98] tracking-tight text-[var(--text-primary)] sm:text-6xl">
              Contribua com o <span className="font-semibold text-[var(--accent)]">CriptEnv</span>
            </h1>
            <p className="mt-6 max-w-xl text-base font-light leading-relaxed text-[var(--text-tertiary)]">
              Apoie uma alternativa open source para gerenciamento de secrets com arquitetura zero-knowledge. O pagamento é feito por Pix e acompanhado nesta página.
            </p>
          </div>

          <Card className="rounded-xl border-[var(--border)] bg-[var(--surface)]/80 p-6 backdrop-blur-sm sm:p-8">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              Gerar contribuição
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-tertiary)]">
              Escolha um valor a partir de R$ 5,00. Nome e email são opcionais.
            </p>

            {error && (
              <div className="mt-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
              <Input
                label="Valor"
                type="number"
                step="0.01"
                min="5"
                placeholder="25,00"
                suffix={<span className="font-mono text-xs text-[var(--text-muted)]">BRL</span>}
                error={errors.amount?.message}
                {...register("amount", { valueAsNumber: true })}
              />
              <Input
                label="Nome"
                type="text"
                placeholder="Seu nome"
                error={errors.payer_name?.message}
                {...register("payer_name")}
              />
              <Input
                label="Email"
                type="email"
                placeholder="voce@email.com"
                error={errors.payer_email?.message}
                {...register("payer_email")}
              />
              <Button type="submit" fullWidth loading={effectiveFlowStatus === "creating"}>
                Gerar Pix
              </Button>
            </form>
          </Card>
        </section>

        <section className="mt-10 grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background-subtle)] p-6">
            <p className="font-mono text-xs uppercase text-[var(--text-muted)]">open source</p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-tertiary)]">
              O CriptEnv segue MIT License. Contribuições ajudam a manter infraestrutura, auditoria, documentação e evolução do produto sem comprometer o princípio zero-knowledge.
            </p>
          </div>
          {statusPanel}
        </section>
      </div>
    </main>
  )
}
