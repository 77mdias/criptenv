"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import gsap from "gsap";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/*  Theme — reads .dark class from <html> directly                     */
/*  This avoids the Zustand SSR hydration mismatch where               */
/*  resolvedTheme initializes as "light" even when dark is set         */
/*  by the inline <script> in layout.tsx before React hydrates.        */
/* ------------------------------------------------------------------ */

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return false; // SSR always renders light; inline script fixes it before paint
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PricingPlan {
  name: string;
  description: string;
  price: string;
  suffix?: string;
  features: string[];
  cta: string;
  featured?: boolean;
  badge?: string;
  href?: string;
}

interface PricingCardCarouselProps {
  cards: PricingPlan[];
  autoPlayInterval?: number;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Card stack positions                                               */
/* ------------------------------------------------------------------ */

interface CardState {
  rotateY: number;
  z: number;
  y: number;
  opacity: number;
  scale: number;
  zIndex: number;
  filter: string;
}

const CARD_STATES: CardState[] = [
  // Front — fully visible
  {
    rotateY: 0,
    z: 0,
    y: 0,
    opacity: 1,
    scale: 1,
    zIndex: 3,
    filter: "blur(0px)",
  },
  // Middle — peeking behind, high visibility
  {
    rotateY: -6,
    z: -30,
    y: -8,
    opacity: 0.88,
    scale: 0.98,
    zIndex: 2,
    filter: "blur(0.3px)",
  },
  // Back — visible
  {
    rotateY: -10,
    z: -55,
    y: -16,
    opacity: 0.72,
    scale: 0.96,
    zIndex: 1,
    filter: "blur(0.6px)",
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const STATE_DURATION_ENTER = 0.9;
const EASE_OUT = "power3.out";

function orderedIndices(active: number, len: number): [number, number, number] {
  return [active % len, (active + 1) % len, (active + 2) % len];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PricingCardCarousel({
  cards,
  autoPlayInterval = 4000,
  className,
}: PricingCardCarouselProps) {
  const len = cards.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const isDark = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const activeIndexRef = useRef(0);
  const isAnimating = useRef(false);
  const autoPlayTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefersReducedMotion = useRef(false);

  /* ---- Position all cards for a given base index ---- */
  const positionCards = useCallback(
    (base: number) => {
      const [f, m, b] = orderedIndices(base, len);
      const stateMap: Record<number, CardState> = {
        [f]: CARD_STATES[0],
        [m]: CARD_STATES[1],
        [b]: CARD_STATES[2],
      };
      Object.entries(stateMap).forEach(([i, s]) => {
        const el = cardRefs.current[Number(i)];
        if (!el) return;
        gsap.set(el, {
          rotateY: s.rotateY,
          z: s.z,
          y: s.y,
          opacity: s.opacity,
          scale: s.scale,
          zIndex: s.zIndex,
          filter: s.filter,
          transformPerspective: 1000,
          transformStyle: "preserve-3d",
        });
      });
    },
    [len],
  );

  /* ---- Transition to a new active index ---- */
  const transitionTo = useCallback(
    (nextActive: number) => {
      const normalizedNext = ((nextActive % len) + len) % len;
      if (isAnimating.current || normalizedNext === activeIndexRef.current)
        return;
      isAnimating.current = true;

      const [frontIdx, midIdx, backIdx] = orderedIndices(normalizedNext, len);
      const stateMap: Record<number, CardState> = {
        [frontIdx]: CARD_STATES[0],
        [midIdx]: CARD_STATES[1],
        [backIdx]: CARD_STATES[2],
      };
      const visibleEls = Object.keys(stateMap)
        .map((index) => cardRefs.current[Number(index)])
        .filter(Boolean) as HTMLDivElement[];

      if (visibleEls.length < Math.min(len, CARD_STATES.length)) {
        isAnimating.current = false;
        return;
      }

      gsap.killTweensOf(visibleEls);

      const tl = gsap.timeline({
        onComplete: () => {
          activeIndexRef.current = normalizedNext;
          setActiveIndex(normalizedNext);
          positionCards(normalizedNext);
          isAnimating.current = false;
        },
      });

      Object.entries(stateMap).forEach(([index, state]) => {
        const el = cardRefs.current[Number(index)];
        if (!el) return;
        tl.to(
          el,
          {
            rotateY: state.rotateY,
            opacity: state.opacity,
            z: state.z,
            y: state.y,
            scale: state.scale,
            zIndex: state.zIndex,
            filter: state.filter,
            duration: prefersReducedMotion.current ? 0 : STATE_DURATION_ENTER,
            ease: EASE_OUT,
          },
          0,
        );
      });
    },
    [len, positionCards],
  );

  /* ---- Navigation ---- */
  const goNext = useCallback(() => {
    transitionTo(activeIndexRef.current + 1);
  }, [transitionTo]);

  const goPrev = useCallback(() => {
    transitionTo(activeIndexRef.current - 1);
  }, [transitionTo]);

  const goTo = useCallback(
    (target: number) => {
      if (target === activeIndexRef.current || isAnimating.current) return;
      transitionTo(target);
    },
    [transitionTo],
  );

  /* ---- Auto-play ---- */
  const stopAutoPlay = useCallback(() => {
    if (autoPlayTimer.current) {
      clearInterval(autoPlayTimer.current);
      autoPlayTimer.current = null;
    }
  }, []);

  const startAutoPlay = useCallback(() => {
    if (prefersReducedMotion.current || len < 2 || autoPlayInterval <= 0)
      return;
    stopAutoPlay();
    autoPlayTimer.current = setInterval(() => {
      transitionTo(activeIndexRef.current + 1);
    }, autoPlayInterval);
  }, [autoPlayInterval, len, stopAutoPlay, transitionTo]);

  /* ---- Initial mount ---- */
  useEffect(() => {
    activeIndexRef.current = activeIndex;
    positionCards(activeIndex);
    startAutoPlay();
    return () => stopAutoPlay();
  }, [activeIndex, positionCards, startAutoPlay, stopAutoPlay]);

  /* ---- Keyboard navigation ---- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  /* ---- Reduced motion: disable auto-play ---- */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      prefersReducedMotion.current = mq.matches;
      if (mq.matches) {
        stopAutoPlay();
      } else {
        startAutoPlay();
      }
    };
    syncPreference();
    mq.addEventListener("change", syncPreference);
    return () => mq.removeEventListener("change", syncPreference);
  }, [startAutoPlay, stopAutoPlay]);

  /* ---- Touch / swipe ---- */
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    stopAutoPlay();
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0) {
        goNext();
      } else {
        goPrev();
      }
    }
    startAutoPlay();
  };

  /* ---- Flashlight hover effect ---- */
  const handleMouseMove = (
    e: React.MouseEvent<HTMLDivElement>,
    cardEl: HTMLDivElement,
  ) => {
    const rect = cardEl.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    cardEl.style.setProperty("--mouse-x", `${x}%`);
    cardEl.style.setProperty("--mouse-y", `${y}%`);
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative select-none", className)}
      onMouseEnter={stopAutoPlay}
      onMouseLeave={startAutoPlay}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="region"
      aria-label="Pricing plans carousel"
      aria-roledescription="carousel"
    >
      {/* ---- Ambient glow ---- */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-105 w-130 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.12] blur-[100px]"
        style={{ background: "var(--accent)" }}
      />

      {/* ---- 3-D card stage ---- */}
      <div
        className="relative mx-auto h-110 w-full max-w-[calc(100vw-2rem)] sm:max-w-sm sm:h-115"
        style={{ perspective: "1000px", perspectiveOrigin: "50% 45%" }}
      >
        {cards.map((card, index) => {
          const isFront = index === activeIndex;
          return (
            <div
              key={card.name}
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
              aria-hidden={!isFront}
              aria-label={`Pricing plan: ${card.name}`}
              className={cn(
                "absolute inset-x-0 top-0 mx-auto w-full max-w-[calc(100vw-2rem)] sm:max-w-sm cursor-default",
                isFront && "pointer-events-auto",
                !isFront && "pointer-events-none",
              )}
              style={{
                transformStyle: "preserve-3d",
                backfaceVisibility: "hidden",
              }}
              onMouseMove={
                isFront ? (e) => handleMouseMove(e, e.currentTarget) : undefined
              }
            >
              {/* Flashlight overlay (front card only) */}
              {isFront && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-10 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background:
                      "radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.06) 0%, transparent 60%)",
                  }}
                />
              )}

              {/* Card body */}
              <div
                className={cn(
                  "group relative flex min-h-94 flex-col rounded-xl border p-6 backdrop-blur-md transition-shadow duration-300",
                  card.featured
                    ? isDark
                      ? "border-(--accent)/50 bg-[#161618] shadow-lg shadow-[var(--glow-soft)]"
                      : "border-(--accent)/35 bg-white shadow-xl shadow-black/10"
                    : isDark
                      ? "border-white/10 bg-[#111113]"
                      : "border-(--border) bg-white shadow-lg shadow-black/5",
                )}
              >
                {/* Featured badge */}
                {card.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-(--accent) px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-(--accent-foreground)">
                    {card.badge || "Featured"}
                  </div>
                )}

                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-(--text-primary)">
                      {card.name}
                    </h3>
                    <p className="mt-1 text-sm text-(--text-tertiary)">
                      {card.description}
                    </p>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/logocriptenv.png"
                    alt="CriptEnv"
                    width={50}
                    height={50}
                    className={cn(
                      "shrink-0",
                      isDark ? "brightness-0 invert opacity-70" : "opacity-50",
                    )}
                  />
                </div>

                {/* Price */}
                <div className="mb-6 mt-6">
                  <span className="text-4xl font-semibold tracking-tight text-(--text-primary)">
                    {card.price}
                  </span>
                  {card.suffix && (
                    <span className="text-sm text-(--text-muted)">
                      {card.suffix}
                    </span>
                  )}
                </div>

                {/* Features */}
                <ul className="mb-8 space-y-3">
                  {card.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm text-(--text-secondary)"
                    >
                      <Check className="h-4 w-4 shrink-0 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link href={card.href || "/signup"} className="mt-auto block">
                  <Button
                    variant={card.featured ? "primary" : "secondary"}
                    fullWidth
                    className={
                      card.featured
                        ? "bg-(--accent) font-bold text-(--accent-foreground) hover:bg-(--accent-hover)"
                        : "border-(--border) text-(--text-primary) hover:bg-(--background-subtle)"
                    }
                  >
                    {card.cta}
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Navigation controls ---- */}
      <div className="relative z-10 mt-6 flex items-center justify-center gap-5">
        <button
          onClick={() => {
            stopAutoPlay();
            goPrev();
            startAutoPlay();
          }}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
            isDark
              ? "border-(--border) bg-[#141416] text-(--text-secondary) hover:bg-[#1a1a1c] hover:text-(--text-primary)"
              : "border-(--border) bg-white text-(--text-secondary) shadow-sm hover:bg-gray-50 hover:text-(--text-primary)",
          )}
          aria-label="Previous plan"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Pagination dots */}
        <div className="flex items-center gap-2">
          {cards.map((card, i) => (
            <button
              key={card.name}
              onClick={() => {
                stopAutoPlay();
                goTo(i);
                startAutoPlay();
              }}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === activeIndex
                  ? "w-6 bg-(--text-primary)"
                  : "w-2 bg-(--text-muted)/40 hover:bg-(--text-muted)/70",
              )}
              aria-label={`Go to ${card.name}`}
              aria-current={i === activeIndex ? "true" : undefined}
            />
          ))}
        </div>

        <button
          onClick={() => {
            stopAutoPlay();
            goNext();
            startAutoPlay();
          }}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
            isDark
              ? "border-(--border) bg-[#141416] text-(--text-secondary) hover:bg-[#1a1a1c] hover:text-(--text-primary)"
              : "border-(--border) bg-white text-(--text-secondary) shadow-sm hover:bg-gray-50 hover:text-(--text-primary)",
          )}
          aria-label="Next plan"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
