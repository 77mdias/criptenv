"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_90%_60%_at_50%_35%,#000_25%,transparent_75%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-56 left-1/2 h-[480px] w-[720px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,69,0,0.2)_0%,transparent_65%)]"
      />

      <main className="relative w-full max-w-lg text-center animate-fade-in-up">
        <div className="glass-card px-8 py-12 sm:px-12">
          <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#ff4500]/35 bg-[#ff4500]/10 px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ff4500]">
            <span className="relative flex h-[7px] w-[7px]">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff4500] opacity-60" />
              <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-[#ff4500]" />
            </span>
            Erro inesperado
          </span>

          <div
            aria-hidden="true"
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#ff4500]/25 bg-[#ff4500]/10 text-[#ff4500]"
          >
            <AlertTriangle className="h-8 w-8" strokeWidth={1.8} />
          </div>

          <h1 className="mb-4 text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Algo deu errado{" "}
            <span className="bg-[linear-gradient(120deg,var(--text-primary)_30%,#ff4500)] bg-clip-text text-transparent">
              do nosso lado
            </span>
          </h1>

          <p className="mx-auto mb-2 max-w-[42ch] text-[15px] leading-relaxed text-[var(--text-secondary)]">
            Encontramos uma falha inesperada ao renderizar esta página. Nossa
            equipe já foi notificada.
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
            <Button asChild variant="secondary" size="lg" className="rounded-xl">
              <Link href="/">
                <Home className="h-4 w-4" aria-hidden="true" />
                Ir para o início
              </Link>
            </Button>
          </div>

          <p className="mt-9 flex items-center justify-center gap-2 font-mono text-[11.5px] text-[var(--text-muted)]">
            <ShieldCheck className="h-[13px] w-[13px] text-green-700" aria-hidden="true" />
            Seus secrets continuam seguros — cifrados com AES-256-GCM no seu dispositivo.
          </p>
        </div>
      </main>
    </div>
  );
}
