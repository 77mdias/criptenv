import type { ReactNode } from "react";
import { AlertTriangle, Ban, FileText, Info } from "lucide-react";

/**
 * Shared building blocks for the legal pages (/termos-de-uso and
 * /politica-de-privacidade). Server Components only — no client JS.
 */

export function LegalDocument({
  badge,
  title,
  intro,
  version,
  children,
}: {
  badge: string;
  title: string;
  intro: ReactNode;
  version: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-24 pt-24 sm:px-6 sm:pt-28 md:px-8">
      <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background-subtle)] px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        {badge}
      </p>

      <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
        {title}
      </h1>

      <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-[var(--text-secondary)]">
        {intro}
      </div>

      <p className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--background-subtle)] px-4 py-3 font-mono text-xs leading-relaxed text-[var(--text-tertiary)]">
        {version}
      </p>

      <div className="mt-10 space-y-10">{children}</div>
    </section>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-4 border-b border-[var(--border)] pb-3 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function LegalSub({ title }: { title: string }) {
  return (
    <h3 className="pt-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
      {title}
    </h3>
  );
}

export function LegalP({ children }: { children: ReactNode }) {
  return (
    <p className="text-[15px] leading-relaxed text-[var(--text-secondary)]">
      {children}
    </p>
  );
}

export function LegalUl({ children }: { children: ReactNode }) {
  return (
    <ul className="space-y-2 pl-1 text-[15px] leading-relaxed text-[var(--text-secondary)]">
      {children}
    </ul>
  );
}

export function LegalLi({ children }: { children: ReactNode }) {
  return (
    <li className="relative pl-5 before:absolute before:left-0 before:top-[0.65em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-[var(--accent)] before:content-['']">
      {children}
    </li>
  );
}

export function LegalAlert({
  variant = "warning",
  title,
  children,
}: {
  variant?: "warning" | "danger" | "info";
  title: string;
  children: ReactNode;
}) {
  const styles = {
    warning:
      "border-amber-500/30 bg-amber-500/[0.06] text-[var(--text-secondary)]",
    danger: "border-red-500/30 bg-red-500/[0.06] text-[var(--text-secondary)]",
    info: "border-sky-500/30 bg-sky-500/[0.06] text-[var(--text-secondary)]",
  } as const;

  const icons = {
    warning: (
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
    ),
    danger: <Ban className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />,
    info: <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" aria-hidden="true" />,
  } as const;

  return (
    <aside
      role="note"
      className={`rounded-xl border p-5 ${styles[variant]}`}
    >
      <div className="flex gap-3">
        {icons[variant]}
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--text-primary)]">
            {title}
          </p>
          <div className="space-y-3 text-[14.5px] leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </aside>
  );
}
