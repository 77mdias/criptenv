import Link from "next/link";
import {
  ArrowRight,
  Check,
  Code2,
  HeartHandshake,
  LockKeyhole,
  Server,
  ShieldCheck,
} from "lucide-react";

const contributionBenefits = [
  "Apoio via Pix para manter o projeto independente",
  "Nenhum plano pago obrigatorio para usar o produto",
  "Ajuda a financiar infraestrutura, docs e evolucao",
  "Mantem a proposta open source sustentavel",
];

const openSourceBenefits = [
  "Vault Zero-Knowledge para secrets de projetos",
  "CLI e dashboard web disponiveis hoje",
  "Team sync, audit trail e CI tokens",
  "Codigo MIT para revisar, hospedar e evoluir",
];

const trustItems = [
  {
    label: "MIT",
    description: "codigo aberto",
    icon: Code2,
  },
  {
    label: "0 plaintext",
    description: "servidor ve ciphertext",
    icon: LockKeyhole,
  },
  {
    label: "self-hostable",
    description: "controle da stack",
    icon: Server,
  },
  {
    label: "roadmap aberto",
    description: "sem promessa escondida",
    icon: ShieldCheck,
  },
];

const baseActionClass =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

const primaryActionClass = `${baseActionClass} bg-(--accent) text-xs font-bold uppercase tracking-wider text-(--accent-foreground) hover:bg-(--accent-hover) focus-visible:ring-[var(--accent)]`;

const secondaryActionClass = `${baseActionClass} border border-(--border) text-(--text-primary) hover:bg-(--background-subtle) focus-visible:ring-[var(--text-primary)]`;

function BenefitList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-3 text-[13px] leading-relaxed text-(--text-secondary)"
        >
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function PricingTrustSection() {
  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl border border-white/5 bg-[linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.035)_1px,transparent_1px)] opacity-60 dark:opacity-80"
        style={{ backgroundSize: "44px 44px" }}
      />
      <div className="pointer-events-none absolute -left-16 top-10 h-48 w-48 rounded-full bg-lime-300/8 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-2 h-56 w-56 rounded-full bg-sky-300/8 blur-3xl" />

      <div className="relative overflow-hidden rounded-2xl border border-(--border) bg-(--surface)/70 shadow-2xl shadow-black/5 backdrop-blur-md dark:shadow-black/30">
        <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
          <article className="relative overflow-hidden border-b border-(--border) p-5 sm:p-6 lg:border-b-0 lg:border-r lg:p-7">
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-lime-300/50 to-transparent" />
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-lime-300/20 bg-lime-300/10">
                <HeartHandshake className="h-5 w-5 text-lime-300" />
              </div>
              <span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-lime-200">
                apoio aberto
              </span>
            </div>

            <p className="font-mono text-xs font-bold uppercase tracking-widest text-(--text-muted)">
              Sustentado pela comunidade
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-(--text-primary) sm:text-3xl">
              Apoie o CriptEnv
            </h3>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-(--text-tertiary)">
              O produto segue gratuito e open source. Sua contribuicao ajuda a
              manter o projeto vivo, independente e mais confiavel para equipes
              que cuidam de secrets todos os dias.
            </p>

            <div className="my-5 flex items-end gap-3">
              <span className="text-4xl font-semibold tracking-tight text-(--text-primary)">
                R$ 5+
              </span>
              <span className="pb-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-(--text-muted)">
                via Pix
              </span>
            </div>

            <BenefitList items={contributionBenefits} />

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/contribute"
                className={`${primaryActionClass} w-full sm:w-auto`}
              >
                Contribute now
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/docs"
                className={`${secondaryActionClass} w-full sm:w-auto`}
              >
                Ver transparencia
              </Link>
            </div>
          </article>

          <article className="p-5 sm:p-6 lg:p-7">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-300/10">
              <ShieldCheck className="h-5 w-5 text-sky-300" />
            </div>

            <p className="font-mono text-xs font-bold uppercase tracking-widest text-(--text-muted)">
              Open Source
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-(--text-primary)">
              Free
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-(--text-tertiary)">
              Use o CLI, o dashboard e a base atual sem plano pago. Hosted
              plans podem chegar depois, mas o nucleo aberto continua sendo o
              ponto de partida.
            </p>

            <div className="my-5 rounded-xl border border-(--border) bg-(--background)/50 p-3 font-mono text-[11px] text-(--text-secondary)">
              <div className="flex items-center justify-between gap-3">
                <span>server.sees</span>
                <span className="text-lime-300">ciphertext</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span>license</span>
                <span className="text-sky-300">MIT</span>
              </div>
            </div>

            <BenefitList items={openSourceBenefits} />

            <Link
              href="/signup"
              className={`${secondaryActionClass} mt-6 w-full`}
            >
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        </div>

        <div className="border-t border-(--border) bg-(--background)/35 p-3 sm:p-4">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {trustItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-lg border border-(--border) bg-(--surface)/70 px-3 py-2.5"
              >
                <item.icon className="h-4 w-4 shrink-0 text-(--text-muted)" />
                <div>
                  <p className="font-mono text-xs font-semibold text-(--text-primary)">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-(--text-muted)">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-(--text-muted)">
            Sem lock-in comercial: planos hospedados podem evoluir no futuro,
            mas self-hosting e transparencia seguem como prioridades.
          </p>
        </div>
      </div>
    </div>
  );
}
