import { getTranslations } from "next-intl/server";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { FloatingBar } from "@/components/floating-bar/floating-bar";
import { SupportChat } from "@/components/support/support-chat";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("common");
  return (
    <div className="min-h-screen bg-(--background) text-(--text-primary) overflow-x-hidden">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-md focus:bg-(--accent) focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-(--accent-foreground)"
      >
        {t("a11y.skipToContent")}
      </a>
      <MarketingHeader />
      <FloatingBar />
      <main id="conteudo">{children}</main>
      <SupportChat />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "SoftwareApplication",
                name: "CriptEnv",
                applicationCategory: "DeveloperApplication",
                operatingSystem: "Web, macOS, Linux, Windows",
                description: t("meta.description"),
                url: "https://criptenv.77mdevseven.tech",
                offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              },
              {
                "@type": "Organization",
                name: "CriptEnv",
                url: "https://criptenv.77mdevseven.tech",
                logo: "https://criptenv.77mdevseven.tech/images/logocriptenv.png",
              },
            ],
          }),
        }}
      />
    </div>
  );
}
