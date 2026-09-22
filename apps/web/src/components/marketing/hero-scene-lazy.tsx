"use client";

import dynamic from "next/dynamic";

// Three.js must never load during SSR (Workers global-scope constraint), so
// the scene lives behind a client-only dynamic import.
const HeroScene = dynamic(
  () =>
    import("@/components/marketing/hero-scene").then((mod) => mod.HeroScene),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_center,var(--glow-soft),transparent_62%)]" />
    ),
  },
);

export function HeroSceneLazy() {
  return <HeroScene />;
}
