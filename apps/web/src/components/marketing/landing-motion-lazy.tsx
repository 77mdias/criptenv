"use client"

import dynamic from "next/dynamic"

// GSAP registers plugins (and schedules timers) at import time, which is a
// disallowed operation in the Workers global scope during SSR. Like
// hero-scene-lazy, the motion wrapper lives behind a client-only dynamic
// import so it is never evaluated on the server.
const LandingMotion = dynamic(
  () =>
    import("@/components/marketing/landing-motion").then(
      (mod) => mod.LandingMotion,
    ),
  {
    ssr: false,
    loading: () => <div className="contents" />,
  },
)

export function LandingMotionLazy({ children }: { children: React.ReactNode }) {
  return <LandingMotion>{children}</LandingMotion>
}
