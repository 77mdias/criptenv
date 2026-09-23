"use client";

import { useEffect } from "react";
import { KeyRound, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard-error]", error);
  }, [error]);

  return (
    <div className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[360px] w-[560px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,69,0,0.14)_0%,transparent_65%)]"
      />

      <main className="relative w-full max-w-lg text-center animate-fade-in-up">
        <div className="glass-card px-8 py-12 sm:px-12">
          <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#ff4500]/35 bg-[#ff4500]/10 px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ff4500]">
            <span className="relative flex h-[7px] w-[7px]">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff4500] opacity-60" />
              <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-[#ff4500]" />
            </span>
            Falha ao carregar
          </span>

          <div
            aria-hidden="true"
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#ff4500]/25 bg-[#ff4500]/10 text-[#ff4500]"
          >
            <KeyRound className="h-8 w-8" strokeWidth={1.8} />
          </div>

          <h1 className="mb-4 text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Não foi possível carregar{" "}
            <span className="bg-[linear-gradient(120deg,var(--text-primary)_30%,#ff4500)] bg-clip-text text-transparent">
              esta seção
            </span>
          </h1>

          <p className="mx-auto mb-2 max-w-[42ch] text-[15px] leading-relaxed text-[var(--text-secondary)]">
            Ocorreu um erro inesperado, mas pode ficar tranquilo: seus secrets
            estão protegidos.
          </p>

          {error?.digest ? (
            <div className="mt-6 inline-flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background-subtle)] px-4 py-2.5 font-mono text-xs text-[var(--text-muted)]">
              <label className="text-[10px] uppercase tracking-[0.18em]">
                ID do erro
              </label>
              <code className="select-all tracking-wide text-[var(--text-secondary)]">
                {error.digest}
              </code>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <Button onClick={retry} icon={RotateCcw} size="lg" className="rounded-xl bg-[#ff4500] px-8 hover:bg-[#ff5c1f] focus-visible:ring-[#ff4500]">
              Tentar novamente
            </Button>
          </div>

          <p className="mt-9 flex items-center justify-center gap-2 font-mono text-[11.5px] text-[var(--text-muted)]">
            <ShieldCheck className="h-[13px] w-[13px] text-green-700" aria-hidden="true" />
            Arquitetura zero-knowledge — nada sai do seu dispositivo sem cifragem AES-256-GCM.
          </p>
        </div>
      </main>
    </div>
  );
}
