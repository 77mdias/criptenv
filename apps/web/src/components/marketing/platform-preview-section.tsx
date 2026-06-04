"use client";

import Image from "next/image";
import { useTheme } from "@/hooks/use-theme";

function ThemeImage({
  lightSrc,
  darkSrc,
  alt,
  className,
  width,
  height,
  priority = false,
}: {
  lightSrc: string;
  darkSrc: string;
  alt: string;
  className?: string;
  width: number;
  height: number;
  priority?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const src = resolvedTheme === "dark" ? darkSrc : lightSrc;

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}

export function PlatformPreviewSection() {
  return (
    <section
      id="preview"
      className="relative flex min-h-screen scroll-mt-14 items-center overflow-hidden bg-(--background-subtle) py-10 sm:py-14 lg:py-0"
    >
      {/* Background DB image - visible texture */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0">
          <ThemeImage
            lightSrc="/images/db-mocked-light.png"
            darkSrc="/images/db-mocked.png"
            alt=""
            width={1920}
            height={1080}
            priority
            className="h-full w-full object-cover object-center opacity-25 blur-[1px] saturate-110"
          />
        </div>
        <div className="absolute inset-0 bg-(--background-subtle)/65" />
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-(--background-subtle) to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-(--background-subtle) to-transparent" />
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 30%, rgba(34,197,94,0.10), transparent 50%), radial-gradient(circle at 70% 70%, rgba(34,197,94,0.08), transparent 50%)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 sm:px-8 lg:pl-24 lg:pr-8 xl:pl-28">
        {/* Creative headline — following landing page conventions */}
        <div data-motion="reveal" className="mb-6 text-center lg:mb-8">
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-(--text-muted)">
            O servidor só vê ciphertext.
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-(--text-primary) md:text-4xl lg:text-5xl">
            Você só vê{" "}
            <span className="text-(--accent)">
              resultados.
            </span>
          </h2>
        </div>

        <div data-motion="reveal" className="relative min-w-0">
          <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-emerald-500/15 via-emerald-400/5 to-emerald-500/10 blur-3xl dark:from-emerald-400/10 dark:via-emerald-300/5 dark:to-emerald-400/8" />

          {/* DESKTOP — Large, dominant */}
          <div
            className="relative mx-auto w-full max-w-[1100px] overflow-hidden rounded-2xl border border-(--border) bg-(--surface)/80 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.35)] backdrop-blur-sm dark:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.6)]"
            style={{
              transform:
                "perspective(1600px) rotateY(-1deg) rotateX(0.5deg)",
            }}
          >
            <div className="flex h-9 items-center gap-1.5 border-b border-(--border) bg-(--background-subtle)/85 px-4">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
              <span className="ml-auto font-mono text-[10px] font-semibold uppercase tracking-widest text-(--text-muted)">
                criptenv · dashboard
              </span>
            </div>
            <ThemeImage
              lightSrc="/images/capture-desk-light.png"
              darkSrc="/images/capture-desk-dark.png"
              alt="Dashboard do CriptEnv mostrando projetos, secrets, equipe e auditoria"
              width={1919}
              height={956}
              priority
              className="w-full"
            />
          </div>

          {/* MOBILE — smaller, overlapping front-left */}
          <div
            className="absolute -bottom-6 left-[5%] z-20 w-[22%] max-w-[200px] lg:w-[20%]"
            style={{
              transform:
                "perspective(1600px) rotateY(5deg) rotateX(-1deg)",
            }}
          >
            <div className="overflow-hidden rounded-[1.75rem] border-[5px] border-zinc-900 bg-zinc-900 shadow-2xl shadow-black/40 dark:border-zinc-800">
              <div className="relative bg-zinc-900 px-3 pb-0.5 pt-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-semibold text-white">9:41</span>
                  <div className="absolute left-1/2 top-0 h-3.5 w-16 -translate-x-1/2 rounded-b-lg bg-zinc-900" />
                  <div className="flex items-center gap-0.5">
                    <svg className="h-2 w-2 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                    <svg className="h-2 w-2 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
                    <svg className="h-2.5 w-3.5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M17 4h-3V2h-4v2H7v18h10V4zm-2 16H9v-1h6v1zm0-2H9v-1h6v1zm0-2H9v-1h6v1zM7 6h10v10H7V6z"/></svg>
                  </div>
                </div>
              </div>
              <ThemeImage
                lightSrc="/images/criptenv-capturemobile.jpeg"
                darkSrc="/images/capture-mobile-dark.png"
                alt="Interface mobile do CriptEnv"
                width={938}
                height={1600}
                className="w-full"
              />
              <div className="flex justify-center bg-zinc-900 py-1">
                <div className="h-0.5 w-20 rounded-full bg-white/80" />
              </div>
            </div>
          </div>

          {/* Floating badge */}
          <div
            className="absolute right-0 top-[1%] z-30 hidden sm:block"
            style={{ animation: "float-badge 6s ease-in-out infinite" }}
          >
            <div className="rounded-full border border-emerald-500/25 bg-(--surface)/90 px-3.5 py-2 shadow-xl shadow-emerald-500/5 backdrop-blur-md dark:border-emerald-400/25 dark:bg-(--surface-elevated)/90">
              <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Server saw 0 plaintext
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom grid pattern */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-30"
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            maskImage:
              "radial-gradient(ellipse 80% 100% at 50% 100%, black 0%, transparent 70%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 100% at 50% 100%, black 0%, transparent 70%)",
          }}
        />
      </div>
    </section>
  );
}
