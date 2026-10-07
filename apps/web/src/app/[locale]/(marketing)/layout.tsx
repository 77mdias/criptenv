import { MarketingHeader } from "@/components/layout/marketing-header";
import { FloatingBar } from "@/components/floating-bar/floating-bar";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-(--background) text-(--text-primary) overflow-x-hidden">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-md focus:bg-(--accent) focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-(--accent-foreground)"
      >
        Pular para o conteúdo
      </a>
      <MarketingHeader />
      <FloatingBar />
      <main id="conteudo">{children}</main>
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
                description:
                  "Gestão de secrets Zero-Knowledge com criptografia AES-GCM de 256 bits. CLI-first, criptografia client-side e pronto para equipes.",
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
