import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CriptEnv — Secret Management for Developers",
  description:
    "Zero-Knowledge secret management with AES-GCM 256-bit encryption. CLI-first, team-ready.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head />
      <body className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] antialiased">
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
