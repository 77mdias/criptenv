import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Brand } from "@/components/layout/brand";
import { StatusBadge } from "@/components/ui/status-badge";

async function Footer() {
  const t = await getTranslations("common.footer");

  return (
    <footer className="bg-[var(--background)] border-t border-[var(--border)] px-6 sm:px-8">
      <div className="mx-auto max-w-6xl py-12 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 justify-between items-center">
          <div>
            <Brand subtitle={t("tagline")} />
          </div>
          <div className="flex flex-col md:flex-row gap-6 md:justify-end items-start md:items-center text-sm font-medium text-[var(--text-secondary)]">
            <StatusBadge status="online" label={t("status")} />
            <nav className="flex flex-wrap gap-6">
              <Link
                href="/docs"
                prefetch={false}
                className="hover:text-[var(--text-primary)] transition"
              >
                {t("docs")}
              </Link>
              <Link
                href="/termos-de-uso"
                prefetch={false}
                className="hover:text-[var(--text-primary)] transition"
              >
                {t("terms")}
              </Link>
              <Link
                href="/politica-de-privacidade"
                prefetch={false}
                className="hover:text-[var(--text-primary)] transition"
              >
                {t("privacy")}
              </Link>
              <Link
                href="https://github.com/77mdias/criptenv"
                className="hover:text-[var(--text-primary)] transition"
              >
                {t("github")}
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}

export { Footer };
