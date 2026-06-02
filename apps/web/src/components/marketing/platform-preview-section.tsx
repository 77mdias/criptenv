"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Database, Smartphone } from "lucide-react";

function SectionHeading({
  label,
  title,
  align = "left",
}: {
  label: string;
  title: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div
      className={
        align === "center"
          ? "mx-auto mb-16 max-w-2xl text-center"
          : "mb-16 max-w-2xl"
      }
    >
      <span className="font-mono text-xs font-bold uppercase tracking-widest text-(--text-muted)">
        {label}
      </span>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-(--text-primary) md:text-4xl">
        {title}
      </h2>
    </div>
  );
}

export function PlatformPreviewSection() {
  return (
    <section
      id="preview"
      className="scroll-mt-14 px-6 py-20 sm:px-8 sm:py-24 lg:flex lg:min-h-screen lg:items-center lg:py-0 bg-(--background)"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div data-motion="reveal" className="flex flex-col lg:flex-row lg:items-end justify-between mb-16">
          <SectionHeading
            label="Preview"
            title={
              <>
                A prova está no banco.
                <br />
                <span className="text-(--accent)">A experiência na palma da mão.</span>
              </>
            }
          />
          <p className="max-w-md text-sm leading-relaxed text-(--text-tertiary) lg:mb-16 lg:text-right">
            Da robustez criptográfica no backend à interface fluida para sua equipe. 
            CriptEnv foi desenhado para ser transparente para o dev e impenetrável para ataques.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-8 items-center">
          {/* Card 1: Database Proof */}
          <div data-motion="reveal" className="group perspective-1000">
            <Card className="relative overflow-hidden rounded-xl border-(--border) bg-(--surface)/80 backdrop-blur-sm transition-all duration-700 ease-out transform-gpu lg:rotate-y-[-4deg] lg:rotate-x-[2deg] hover:rotate-y-0 hover:rotate-x-0 hover:scale-[1.02] hover:shadow-(--glow-soft) border-white/5 dark:border-white/10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(156,255,74,0.1),transparent_50%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              
              <div className="p-6 sm:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--accent)/20 bg-(--accent)/10">
                      <Database className="h-5 w-5 text-(--accent)" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-(--text-primary)">Zero-Knowledge Real</h3>
                      <p className="text-xs text-(--text-muted)">Visualização direta do Database</p>
                    </div>
                  </div>
                  <div className="hidden sm:flex space-x-1.5">
                     <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                     <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                     <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
                  </div>
                </div>

                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-(--border) bg-black shadow-2xl">
                  <Image
                    src="/images/db-mocked.png"
                    alt="Mockup do banco de dados mostrando payload criptografado"
                    fill
                    className="object-cover object-left-top opacity-90 transition-transform duration-700 ease-out group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 60vw"
                  />
                  {/* Subtle overlay gradients for depth */}
                  <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-black/60 pointer-events-none" />
                  <div className="absolute bottom-4 left-4 right-4 rounded border border-white/10 bg-black/60 p-3 backdrop-blur-md">
                     <p className="font-mono text-xs text-green-300">
                        <span className="text-white/50">&gt;</span> encrypted_payload: <span className="opacity-70 text-green-200 break-all">8fA/qXNdJu8bM2KL1...</span>
                     </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Card 2: Mobile UI */}
          <div data-motion="reveal" className="group perspective-1000 flex justify-center">
            <div className="relative overflow-hidden rounded-[2.5rem] border-[10px] border-zinc-900 bg-zinc-900 shadow-2xl backdrop-blur-sm transition-all duration-700 ease-out transform-gpu lg:rotate-y-[6deg] lg:rotate-x-[2deg] hover:rotate-y-0 hover:rotate-x-0 hover:scale-[1.03] hover:shadow-(--glow-soft) dark:border-zinc-800 w-full max-w-[280px] aspect-[938/1600]">
              
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(156,255,74,0.15),transparent_60%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100 z-10 pointer-events-none" />
              
              {/* Fake Notch */}
              <div className="absolute top-0 inset-x-0 h-5 bg-zinc-900 z-20 rounded-b-xl w-28 mx-auto" /> 
              
              <Image
                src="/images/criptenv-capturemobile.jpeg"
                alt="Interface mobile do dashboard do CriptEnv"
                fill
                className="object-cover object-top opacity-95 transition-transform duration-700 ease-out group-hover:scale-105"
                sizes="(max-width: 768px) 80vw, 30vw"
              />
              
              <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-black/80 pointer-events-none z-10" />
              
              <div className="absolute bottom-6 left-5 right-5 z-20">
                 <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--accent)/20 bg-(--accent)/10 backdrop-blur-md">
                      <Smartphone className="h-4 w-4 text-(--accent)" />
                    </div>
                    <h4 className="text-sm font-semibold text-white">Acesso Total</h4>
                 </div>
                 <p className="text-xs text-white/70 leading-relaxed drop-shadow-md">
                    Gerencie acessos, projetos e chaves de onde estiver.
                 </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
