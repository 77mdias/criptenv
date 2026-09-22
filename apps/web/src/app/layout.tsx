import type { Metadata } from "next";
import "./globals.css";
import { suppressThreeWarnings } from "@/lib/three-warning-suppress";

suppressThreeWarnings();

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://criptenv.77mdevseven.tech";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "CriptEnv — Gestão de secrets para desenvolvedores",
  description:
    "Gestão de secrets Zero-Knowledge com criptografia AES-GCM de 256 bits. CLI-first, criptografia client-side e pronto para equipes.",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "CriptEnv",
    title: "CriptEnv — Gestão de secrets para desenvolvedores",
    description:
      "Gestão de secrets Zero-Knowledge com criptografia AES-GCM de 256 bits. CLI-first, criptografia client-side e pronto para equipes.",
    locale: "pt_BR",
    images: [
      {
        url: "/images/og-cover.png",
        width: 1200,
        height: 630,
        alt: "CriptEnv — gestão de secrets Zero-Knowledge com criptografia client-side",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CriptEnv — Gestão de secrets para desenvolvedores",
    description:
      "Gestão de secrets Zero-Knowledge com criptografia AES-GCM de 256 bits. CLI-first, criptografia client-side e pronto para equipes.",
    images: ["/images/og-cover.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
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
        {children}
      </body>
    </html>
  );
}
