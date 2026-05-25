"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowLeft,
  HeartHandshake,
  Loader2,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ContributionQRPanel } from "@/components/marketing/contribution-qr-panel";
import {
  contributionsApi,
  type ContributionPixResponse,
  type ContributionStatusResponse,
} from "@/lib/api/contributions";
import {
  contributionSchema,
  type ContributionInput,
} from "@/lib/validators/schemas";

type ContributionFlowStatus =
  | "idle"
  | "creating"
  | "pending"
  | "paid"
  | "expired"
  | "error";

const PIX_UI_WINDOW_MS = 120_000;
const STORAGE_KEY = "criptenv_contribution_state";

function isExpired(expiresAt?: string | null) {
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
}

function buildVisiblePixDeadline(
  createdAt: number | null,
  providerExpiresAt?: string | null,
) {
  if (createdAt === null) return providerExpiresAt || null;

  const uiDeadlineMs = createdAt + PIX_UI_WINDOW_MS;
  const providerDeadlineMs = providerExpiresAt
    ? new Date(providerExpiresAt).getTime()
    : Number.NaN;
  const visibleDeadlineMs = Number.isFinite(providerDeadlineMs)
    ? Math.min(uiDeadlineMs, providerDeadlineMs)
    : uiDeadlineMs;

  return new Date(visibleDeadlineMs).toISOString();
}

function mapProviderStatus(
  status: string,
  expiresAt?: string | null,
): ContributionFlowStatus {
  if (status === "PAID") return "paid";
  if (
    status === "EXPIRED" ||
    status === "CANCELLED" ||
    status === "FAILED" ||
    status === "REFUNDED"
  ) {
    return "expired";
  }
  if (isExpired(expiresAt)) return "expired";
  return "pending";
}

function toApiPayload(data: ContributionInput) {
  return {
    amount: data.amount,
    ...(data.payer_name ? { payer_name: data.payer_name } : {}),
    ...(data.payer_email ? { payer_email: data.payer_email } : {}),
  };
}

function IdlePanel() {
  return (
    <Card className="min-h-105 rounded-xl border-(--border) bg-(--surface)/80 p-8">
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-(--accent)/20 bg-(--accent)/10">
          <QrCode className="h-8 w-8 text-(--accent)" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-(--text-primary)">
            Pix instantâneo
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-(--text-tertiary)">
            Sua contribuição ajuda a manter o CriptEnv open source, auditável e
            disponível para quem precisa proteger secrets sem depender de
            plataformas fechadas.
          </p>
        </div>
        <div className="grid gap-3">
          {[
            "Pagamento processado via Mercado Pago",
            "Webhook confirma o status automaticamente",
            "Nenhum dado de vault ou secret passa por este fluxo",
          ].map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 text-sm text-(--text-secondary)"
            >
              <ShieldCheck className="h-4 w-4 shrink-0 text-green-500" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function restorePendingState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved?.contribution?.contribution_id || !saved.createdAt) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const uiDeadlineMs = saved.createdAt + PIX_UI_WINDOW_MS;
    if (Date.now() >= uiDeadlineMs) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return saved as {
      contribution: ContributionPixResponse;
      createdAt: number;
      statusResponse?: ContributionStatusResponse;
    };
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export default function ContributePage() {
  const restored = restorePendingState();

  const [flowStatus, setFlowStatus] = useState<ContributionFlowStatus>(
    restored ? "pending" : "idle",
  );
  const [contribution, setContribution] =
    useState<ContributionPixResponse | null>(restored?.contribution ?? null);
  const [statusResponse, setStatusResponse] =
    useState<ContributionStatusResponse | null>(
      restored?.statusResponse ?? null,
    );
  const [error, setError] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<number | null>(
    restored?.createdAt ?? null,
  );
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  // Persist pending contribution to sessionStorage
  useEffect(() => {
    if (contribution && createdAt !== null && flowStatus === "pending") {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ contribution, createdAt, statusResponse }),
      );
    } else if (
      flowStatus === "idle" ||
      flowStatus === "paid" ||
      flowStatus === "expired" ||
      flowStatus === "error"
    ) {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [contribution, createdAt, flowStatus, statusResponse]);

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
  });

  const displayedProviderStatus =
    statusResponse?.status || contribution?.status || "PENDING";
  const displayedExpiresAt =
    statusResponse?.expires_at || contribution?.expires_at || null;
  const displayedAmount = Number(
    statusResponse?.amount || contribution?.amount || 0,
  );
  const visiblePixExpiresAt = buildVisiblePixDeadline(
    createdAt,
    displayedExpiresAt,
  );
  const effectiveFlowStatus =
    flowStatus === "pending"
      ? mapProviderStatus(displayedProviderStatus, visiblePixExpiresAt)
      : flowStatus;

  const resetFlow = useCallback(() => {
    setFlowStatus("idle");
    setContribution(null);
    setStatusResponse(null);
    setError(null);
    setCreatedAt(null);
    setLastSyncAt(null);
    sessionStorage.removeItem(STORAGE_KEY);
    reset({
      amount: undefined,
      payer_name: undefined,
      payer_email: undefined,
    });
  }, [reset]);

  const refreshStatus = useCallback(
    async (forceSync = false) => {
      if (!contribution || flowStatus !== "pending") return null;

      try {
        const now = new Date().getTime();
        const shouldSync =
          forceSync ||
          (createdAt !== null &&
            now - createdAt >= 10_000 &&
            (lastSyncAt === null || now - lastSyncAt >= 30_000));

        const nextStatus = shouldSync
          ? await contributionsApi.syncContributionStatus(
              contribution.contribution_id,
            )
          : await contributionsApi.getContributionStatus(
              contribution.contribution_id,
            );

        if (shouldSync) {
          setLastSyncAt(now);
        }

        setStatusResponse(nextStatus);
        const nextFlowStatus = mapProviderStatus(
          nextStatus.status,
          nextStatus.expires_at,
        );
        setFlowStatus((current) =>
          current === "expired" && nextFlowStatus === "pending"
            ? current
            : nextFlowStatus,
        );
        return nextFlowStatus;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Não foi possível atualizar o status do pagamento";
        setError(message);
        setFlowStatus("error");
        return "error";
      }
    },
    [contribution, createdAt, flowStatus, lastSyncAt],
  );

  useEffect(() => {
    if (!contribution || effectiveFlowStatus !== "pending") return;

    const interval = window.setInterval(() => {
      void refreshStatus();
    }, 5_000);

    return () => window.clearInterval(interval);
  }, [contribution, effectiveFlowStatus, refreshStatus]);

  useEffect(() => {
    if (
      !contribution ||
      flowStatus !== "pending" ||
      displayedProviderStatus === "PAID" ||
      !visiblePixExpiresAt
    ) {
      return;
    }

    const msUntilVisibleExpiration =
      new Date(visiblePixExpiresAt).getTime() - Date.now();

    const timeout = window.setTimeout(() => {
      setFlowStatus((current) =>
        current === "pending" ? "expired" : current,
      );
      void refreshStatus(true);
    }, Math.max(0, msUntilVisibleExpiration));

    return () => window.clearTimeout(timeout);
  }, [
    contribution,
    displayedProviderStatus,
    flowStatus,
    refreshStatus,
    visiblePixExpiresAt,
  ]);

  const onSubmit = async (data: ContributionInput) => {
    setError(null);
    setStatusResponse(null);
    setFlowStatus("creating");

    try {
      const created = await contributionsApi.createPixContribution(
        toApiPayload(data),
      );
      setContribution(created);
      setCreatedAt(new Date().getTime());
      setLastSyncAt(null);
      setFlowStatus(mapProviderStatus(created.status, created.expires_at));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Não foi possível gerar o Pix";
      setError(message);
      setFlowStatus("error");
    }
  };

  const statusPanel = useMemo(() => {
    if (effectiveFlowStatus === "creating") {
      return (
        <Card className="flex min-h-105 items-center justify-center rounded-xl border-(--border) bg-(--surface)/80 p-8">
          <div className="text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-(--accent)" />
            <p className="mt-4 text-sm text-(--text-tertiary)">
              Gerando Pix...
            </p>
          </div>
        </Card>
      );
    }

    if (effectiveFlowStatus === "idle" || !contribution) {
      return <IdlePanel />;
    }

    const panelStatus =
      effectiveFlowStatus === "paid"
        ? "PAID"
        : effectiveFlowStatus === "expired"
          ? "EXPIRED"
          : effectiveFlowStatus === "error"
            ? "FAILED"
            : displayedProviderStatus;

    return (
      <Card className="min-h-105 rounded-xl border-(--border) bg-(--surface)/80 p-6">
        <ContributionQRPanel
          qrCodeBase64={contribution.pix_qr_code_base64}
          copyPasteCode={contribution.pix_copy_paste}
          startedAt={createdAt}
          expiresAt={visiblePixExpiresAt || contribution.expires_at}
          status={panelStatus}
          amount={displayedAmount}
          onRetry={resetFlow}
        />
      </Card>
    );
  }, [
    contribution,
    createdAt,
    displayedAmount,
    displayedProviderStatus,
    effectiveFlowStatus,
    resetFlow,
    visiblePixExpiresAt,
  ]);

  return (
    <main className="relative min-h-screen overflow-x-clip overflow-y-hidden bg-(--background) px-4 pb-20 pt-24 sm:px-6 sm:pt-28 md:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,var(--glow-soft),transparent_32%),linear-gradient(to_bottom,transparent_70%,var(--background-subtle))]" />

      <div className="relative mx-auto w-full max-w-6xl">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 text-sm font-medium text-(--text-tertiary) transition-colors hover:text-(--text-primary)"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-10">
          <div className="min-w-0">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-(--accent)/20 bg-(--accent)/10">
              <HeartHandshake className="h-7 w-7 text-(--accent)" />
            </div>
            <h1 className="mt-8 max-w-3xl text-4xl font-light leading-[0.98] tracking-tight text-(--text-primary) sm:text-5xl lg:text-6xl">
              Contribua com o{" "}
              <span className="font-semibold text-(--accent)">CriptEnv</span>
            </h1>
            <p className="mt-6 max-w-xl text-base font-light leading-relaxed text-(--text-tertiary)">
              Apoie uma alternativa open source para gerenciamento de secrets
              com arquitetura zero-knowledge. O pagamento é feito por Pix e
              acompanhado nesta página.
            </p>
          </div>

          <Card className="min-w-0 rounded-xl border-(--border) bg-(--surface)/80 p-5 backdrop-blur-sm sm:p-8">
            <h2 className="text-xl font-semibold tracking-tight text-(--text-primary)">
              Gerar contribuição
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-(--text-tertiary)">
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
                suffix={
                  <span className="font-mono text-xs text-(--text-muted)">
                    BRL
                  </span>
                }
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
              <Button
                type="submit"
                fullWidth
                loading={effectiveFlowStatus === "creating"}
              >
                Gerar Pix
              </Button>
            </form>
          </Card>
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          <div className="min-w-0 rounded-xl border border-(--border) bg-(--background-subtle) p-6">
            <p className="font-mono text-xs uppercase text-(--text-muted)">
              open source
            </p>
            <p className="mt-3 text-sm leading-relaxed text-(--text-tertiary)">
              O CriptEnv segue MIT License. Contribuições ajudam a manter
              infraestrutura, auditoria, documentação e evolução do produto sem
              comprometer o princípio zero-knowledge.
            </p>
          </div>
          {statusPanel}
        </section>
      </div>
    </main>
  );
}
