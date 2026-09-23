import type { Metadata } from "next";
import Link from "next/link";
import { Home, LogIn, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "404 — Página não encontrada · CriptEnv",
  robots: { index: false, follow: false },
};

export default function NotFound() {
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

      <main className="relative w-full max-w-xl text-center animate-fade-in-up">
        <p
          aria-hidden="true"
          className="mb-2 select-none bg-[linear-gradient(180deg,var(--text-primary)_0%,transparent_95%)] bg-clip-text text-[clamp(120px,28vw,200px)] font-bold leading-[0.85] tracking-tighter text-transparent opacity-90"
        >
          404
        </p>

        <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background-subtle)] px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
          <SearchX className="h-3.5 w-3.5" aria-hidden="true" />
          Página não encontrada
        </span>

        <h1 className="mb-4 text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Essa página não existe{" "}
          <span className="bg-[linear-gradient(120deg,var(--text-primary)_30%,#ff4500)] bg-clip-text text-transparent">
            (ou nunca existiu)
          </span>
        </h1>

        <p className="mx-auto mb-8 max-w-[46ch] text-[15px] leading-relaxed text-[var(--text-secondary)]">
          O endereço que você acessou não corresponde a nenhuma rota do
          CriptEnv. Verifique a URL ou volte para uma página conhecida.
        </p>

        <div className="mx-auto mb-9 max-w-md overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background-subtle)] text-left font-mono text-[13px] leading-relaxed">
          <div className="flex items-center gap-1.5 border-b border-[var(--border)] px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" aria-hidden="true" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" aria-hidden="true" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" aria-hidden="true" />
            <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              criptenv
            </span>
          </div>
          <div className="space-y-1 px-4 py-3.5">
            <p className="text-[var(--text-secondary)]">
              <span className="select-none text-[#ff4500]">$</span> criptenv get{" "}
              <span className="text-[var(--text-primary)]">esta-pagina</span>
            </p>
            <p className="text-[var(--text-muted)]">
              error: secret not found{" "}
              <span className="text-[var(--text-muted)]/70">
                (code 404)
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <Button asChild size="lg" className="rounded-xl">
            <Link href="/">
              <Home className="h-4 w-4" aria-hidden="true" />
              Ir para o início
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg" className="rounded-xl">
            <Link href="/login">
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Entrar na conta
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
