import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { buildAlternates, OG_LOCALES } from "@/i18n/alternates";
import { loadMessages } from "@/i18n/messages";
import { routing, type Locale } from "@/i18n/routing";
import { suppressThreeWarnings } from "@/lib/three-warning-suppress";

import "@/app/globals.css";

suppressThreeWarnings();

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://criptenv.77mdevseven.tech";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common.meta" });
  const alternates = buildAlternates("/");

  return {
    metadataBase: new URL(SITE_URL),
    title: t("title"),
    description: t("description"),
    alternates,
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
    openGraph: {
      type: "website",
      url: SITE_URL,
      siteName: "CriptEnv",
      title: t("title"),
      description: t("description"),
      locale: OG_LOCALES[locale as Locale] ?? OG_LOCALES[routing.defaultLocale],
      images: [
        {
          url: "/images/og-cover.png",
          width: 1200,
          height: 630,
          alt: t("ogAlt"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: ["/images/og-cover.png"],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Required: without this, Server Components silently ignore the [locale]
  // segment and fall back to defaultLocale (verified against vinext 0.0.45).
  setRequestLocale(locale);

  const messages = await loadMessages(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <link
          rel="icon"
          type="image/png"
          href="/images/logocriptenv-aba-light.png"
          media="(prefers-color-scheme: light)"
        />
        <link
          rel="icon"
          type="image/png"
          href="/images/logocriptenv-aba.png"
          media="(prefers-color-scheme: dark)"
        />
      </head>
      <body
        className="min-h-screen bg-(--background) text-(--text-primary) antialiased"
        suppressHydrationWarning
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var stored = localStorage.getItem('criptenv-theme');
                var system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                var theme = stored === 'light' || stored === 'dark' ? stored : system;
                if (theme === 'dark') document.documentElement.classList.add('dark');
              } catch(e){}
            })()`,
          }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
