import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  Check,
  Code2,
  HeartHandshake,
  LockKeyhole,
  Server,
  ShieldCheck,
} from "lucide-react";

// Prose lives in `messages/<locale>/marketing.json` under `landing.pricingTrust`;
// these module-scope literals only carry stable keys, never user-facing copy.
const contributionBenefitKeys = [
  "supportPix",
  "noPaidPlan",
  "fundsInfra",
  "sustainable",
] as const;

const openSourceBenefitKeys = [
  "vault",
  "cliAndDashboard",
  "teamSync",
  "mit",
] as const;

const trustItems = [
  {
    key: "mit",
    icon: Code2,
  },
  {
    key: "plaintext",
    icon: LockKeyhole,
  },
  {
    key: "selfHosted",
    icon: Server,
  },
  {
    key: "roadmap",
    icon: ShieldCheck,
  },
] as const;

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

export async function PricingTrustSection() {
  const t = await getTranslations("marketing.landing.pricingTrust");

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
                {t("contribute.badge")}
              </span>
            </div>

            <p className="font-mono text-xs font-bold uppercase tracking-widest text-(--text-muted)">
              {t("contribute.kicker")}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-(--text-primary) sm:text-3xl">
              {t("contribute.title")}
            </h3>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-(--text-tertiary)">
              {t("contribute.description")}
            </p>

            <div className="my-5 flex items-end gap-3">
              <span className="text-4xl font-semibold tracking-tight text-(--text-primary)">
                R$ 5+
              </span>
              <span className="pb-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-(--text-muted)">
                {t("contribute.priceNote")}
              </span>
            </div>

            <BenefitList
              items={contributionBenefitKeys.map((key) =>
                t(`contribute.benefits.${key}`),
              )}
            />

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/contribute"
                className={`${primaryActionClass} w-full sm:w-auto`}
              >
                {t("contribute.primary")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/docs"
                className={`${secondaryActionClass} w-full sm:w-auto`}
              >
                {t("contribute.secondary")}
              </Link>
            </div>
          </article>

          <article className="p-5 sm:p-6 lg:p-7">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-300/10">
              <ShieldCheck className="h-5 w-5 text-sky-300" />
            </div>

            <p className="font-mono text-xs font-bold uppercase tracking-widest text-(--text-muted)">
              {t("openSource.kicker")}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-(--text-primary)">
              {t("openSource.title")}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-(--text-tertiary)">
              {t("openSource.description")}
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

            <BenefitList
              items={openSourceBenefitKeys.map((key) =>
                t(`openSource.benefits.${key}`),
              )}
            />

            <Link
              href="/signup"
              className={`${secondaryActionClass} mt-6 w-full`}
            >
              {t("openSource.cta")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        </div>

        <div className="border-t border-(--border) bg-(--background)/35 p-3 sm:p-4">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {trustItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-3 rounded-lg border border-(--border) bg-(--surface)/70 px-3 py-2.5"
              >
                <item.icon className="h-4 w-4 shrink-0 text-(--text-muted)" />
                <div>
                  <p className="font-mono text-xs font-semibold text-(--text-primary)">
                    {t(`trust.${item.key}.label`)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-(--text-muted)">
                    {t(`trust.${item.key}.description`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-(--text-muted)">
            {t("footnote")}
          </p>
        </div>
      </div>
    </div>
  );
}
