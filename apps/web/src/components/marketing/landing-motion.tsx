"use client"

import { useRef, useEffect, type ReactNode } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useGSAP } from "@gsap/react"

gsap.registerPlugin(ScrollTrigger, useGSAP)

interface LandingMotionProps {
  children: ReactNode
}

function LandingMotion({ children }: LandingMotionProps) {
  const scope = useRef<HTMLDivElement>(null)

  // Fallback: ensure content is visible after a short delay even if animations fail
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scope.current) {
        const targets = scope.current.querySelectorAll<HTMLElement>(
          "[data-motion='reveal'], [data-motion='hero']"
        )
        targets.forEach((el) => {
          const style = window.getComputedStyle(el)
          const opacity = parseFloat(style.opacity)
          if (opacity < 0.5) {
            el.style.opacity = "1"
            el.style.transform = "none"
            el.style.filter = "none"
          }
        })
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  useGSAP(
    () => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      const revealTargets = gsap.utils.toArray<HTMLElement>("[data-motion='reveal']")
      const heroTargets = gsap.utils.toArray<HTMLElement>("[data-motion='hero']")

      if (reducedMotion) {
        gsap.set([...heroTargets, ...revealTargets], {
          clearProps: "all",
          opacity: 1,
          y: 0,
        })
        return
      }

      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(heroTargets, {
          opacity: 0,
          y: 32,
          duration: 0.9,
          stagger: 0.1,
        })

      revealTargets.forEach((target) => {
        gsap.from(target, {
          opacity: 0,
          y: 36,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: target,
            start: "top 84%",
            once: true,
          },
        })
      })

      gsap.utils.toArray<HTMLElement>("[data-motion='line']").forEach((target) => {
        gsap.fromTo(
          target,
          { scaleX: 0, transformOrigin: "left center" },
          {
            scaleX: 1,
            duration: 0.9,
            ease: "power2.out",
            scrollTrigger: {
              trigger: target,
              start: "top 86%",
              once: true,
            },
          },
        )
      })
    },
    { scope },
  )

  return <div ref={scope}>{children}</div>
}

export { LandingMotion }
