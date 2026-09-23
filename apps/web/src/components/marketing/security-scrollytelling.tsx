"use client";

import dynamic from "next/dynamic";
import Image, { type StaticImageData } from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ElementType } from "react";
import {
  Eye,
  FileCheck2,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Server,
} from "lucide-react";

import aesImage from "../../../assets/images/AES.webp";
import auditImage from "../../../assets/images/Wer haben vergessen.jpeg";
import keyholeImage from "../../../assets/images/zero-knowledge-proofs-main-1600.jpg";
import masterKeysImage from "../../../assets/images/fad0f89c8d6a92fc48b19560eef69626.jpg";

const SecurityVaultScene = dynamic(
  () =>
    import("@/components/marketing/security-vault-scene").then(
      (mod) => mod.SecurityVaultScene,
    ),
  { ssr: false },
);

interface SecurityTopic {
  id: string;
  /** Catalogue key under `landing.security.topics`. */
  key: string;
  metric: string;
  image: StaticImageData;
  icon: ElementType;
  code: string[];
}

// Prose lives in `messages/<locale>/marketing.json` under `landing.security`;
// this module-scope literal only carries stable keys and technical values.
const securityTopics: SecurityTopic[] = [
  {
    id: "aes-gcm",
    key: "aesGcm",
    metric: "256",
    image: aesImage,
    icon: KeyRound,
    code: ["algorithm: AES-GCM", "keyLength: 256", "tagLength: 128"],
  },
  {
    id: "zero-knowledge",
    key: "zeroKnowledge",
    metric: "0",
    image: keyholeImage,
    icon: Eye,
    code: [
      "server.sees = ciphertext",
      "server.keys = null",
      "plainText: never",
    ],
  },
  {
    id: "client-side",
    key: "clientSide",
    metric: "local",
    image: masterKeysImage,
    icon: Fingerprint,
    code: [
      "PBKDF2 -> masterKey",
      "HKDF -> envKey",
      "localStorage.crypto = false",
    ],
  },
  {
    id: "open-source",
    key: "openSource",
    metric: "MIT",
    image: auditImage,
    icon: FileCheck2,
    code: ["license: MIT", "audit.log(redacted)", "verify: source-visible"],
  },
];

function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  // Server snapshot is false so hydration matches; the real value is read on
  // the client and updates reactively.
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function usePrefersReducedMotion() {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

function TopicImage({
  topic,
  priority = false,
}: {
  topic: SecurityTopic;
  priority?: boolean;
}) {
  const t = useTranslations("marketing.landing.security");

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/50 shadow-2xl shadow-black/40">
      <div className="relative aspect-16/10">
        <Image
          src={topic.image}
          alt={t(`topics.${topic.key}.imageAlt`)}
          fill
          priority={priority}
          className="object-cover"
          sizes="(min-width: 1024px) 42vw, 92vw"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/88 via-black/18 to-transparent" />
        <div className="absolute right-4 top-4 rounded-lg border border-white/15 bg-black/45 px-3 py-2 font-mono text-xs text-white/80 backdrop-blur-md">
          {topic.metric}{" "}
          <span className="text-white/45">
            {t(`topics.${topic.key}.metricLabel`)}
          </span>
        </div>
      </div>
      <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-white/10 bg-black/55 p-3 font-mono text-[11px] leading-relaxed text-white/74 backdrop-blur-md">
        {topic.code.map((line) => (
          <div key={line} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-lime-300" />
            <span>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileSecurityStory() {
  const t = useTranslations("marketing.landing.security");

  return (
    <div className="lg:hidden">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:px-8">
        <div data-motion="reveal" className="mb-12">
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-(--text-muted)">
            {t("label")}
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-(--text-primary)">
            {t("title")}
          </h2>
          <p className="mt-5 leading-relaxed text-(--text-tertiary)">
            {t("intro")}
          </p>
        </div>

        <div className="space-y-8">
          {securityTopics.map((topic, index) => (
            <article
              data-motion="reveal"
              key={topic.id}
              className="overflow-hidden rounded-xl border border-(--border) bg-(--surface)/80"
            >
              <TopicImage topic={topic} priority={index === 0} />
              <div className="p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--accent)/20 bg-(--accent)/10">
                    <topic.icon className="h-5 w-5 text-(--accent)" />
                  </div>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-(--text-muted)">
                      {t(`topics.${topic.key}.kicker`)}
                    </p>
                    <h3 className="text-2xl font-semibold text-(--text-primary)">
                      {t(`topics.${topic.key}.title`)}
                    </h3>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-(--text-secondary)">
                  {t(`topics.${topic.key}.description`)}
                </p>
                <ul className="mt-5 space-y-3">
                  {(t.raw(`topics.${topic.key}.details`) as string[]).map(
                    (detail) => (
                      <li
                        key={detail}
                        className="flex gap-3 text-sm text-(--text-tertiary)"
                      >
                        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-(--accent)" />
                        <span>{detail}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function DesktopSecurityStory({
  activeIndex,
  reducedMotion,
  isDesktop,
}: {
  activeIndex: number;
  reducedMotion: boolean;
  isDesktop: boolean;
}) {
  const t = useTranslations("marketing.landing.security");
  const activeTopic = securityTopics[activeIndex] ?? securityTopics[0];

  return (
    <div className="security-pin hidden min-h-screen items-center overflow-hidden lg:flex">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_36%,rgba(156,255,74,0.12),transparent_28%),radial-gradient(circle_at_38%_68%,rgba(125,211,252,0.12),transparent_34%),linear-gradient(135deg,#ffffff,#eef1ec_50%,#f8faf8)] dark:bg-[radial-gradient(circle_at_72%_36%,rgba(156,255,74,0.12),transparent_28%),radial-gradient(circle_at_38%_68%,rgba(125,211,252,0.08),transparent_34%),linear-gradient(135deg,var(--background),#050505_48%,var(--background))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-black/10 to-transparent dark:via-white/18" />

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-6 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative z-10">
          <div className="mb-10 flex items-center gap-4">
            <div className="relative h-36 w-px bg-black/10 dark:bg-white/10">
              <div className="security-progress-line absolute left-0 top-0 h-full w-px origin-top scale-y-0 bg-linear-to-b from-lime-300 via-sky-300 to-yellow-300" />
            </div>
            <div className="space-y-3">
              {securityTopics.map((topic, index) => (
                <div
                  key={topic.id}
                  className={`security-nav-dot flex items-center gap-3 text-left ${activeIndex === index ? "is-active" : ""}`}
                  aria-label={t("topicAria", {
                    topic: t(`topics.${topic.key}.title`),
                  })}
                  aria-current={activeIndex === index ? "step" : undefined}
                >
                  <span className="h-2.5 w-2.5 rounded-full border border-black/25 bg-black/10 transition-colors dark:border-white/30 dark:bg-white/10" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-black/38 dark:text-white/35">
                    {t(`topics.${topic.key}.title`)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-117.5">
            {securityTopics.map((topic, index) => (
              <article
                key={topic.id}
                data-security-panel
                className={`absolute inset-0 transition-all duration-500 ease-out ${
                  activeIndex === index
                    ? "translate-y-0 opacity-100 blur-0"
                    : "pointer-events-none translate-y-6 opacity-0 blur-sm"
                }`}
              >
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-black/10 bg-white/70 dark:border-white/12 dark:bg-white/8">
                    <topic.icon className="h-6 w-6 text-(--accent) dark:text-lime-300" />
                  </div>
                  <span className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-black/42 dark:text-white/42">
                    {t(`topics.${topic.key}.kicker`)}
                  </span>
                </div>
                <h2 className="max-w-xl text-5xl font-light leading-[0.95] tracking-tight text-(--text-primary) dark:text-white xl:text-6xl">
                  {t(`topics.${topic.key}.title`)}
                </h2>
                <p className="mt-8 max-w-xl text-base leading-relaxed text-(--text-secondary) dark:text-white/68">
                  {t(`topics.${topic.key}.description`)}
                </p>
                <div className="mt-8 grid gap-3">
                  {(t.raw(`topics.${topic.key}.details`) as string[]).map(
                    (detail) => (
                      <div
                        key={detail}
                        className="flex items-start gap-3 rounded-lg border border-black/10 bg-white/62 p-3 text-sm text-(--text-tertiary) dark:border-white/12 dark:bg-white/4.5 dark:text-white/62"
                      >
                        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-(--accent) dark:text-lime-300" />
                        <span>{detail}</span>
                      </div>
                    ),
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="relative z-10 min-h-155">
          <div className="absolute inset-0 rounded-[28px] border border-black/10 bg-white/35 shadow-2xl shadow-black/10 backdrop-blur-sm dark:border-white/8 dark:bg-white/2.5 dark:shadow-black/40" />
          <div className="absolute inset-8 overflow-hidden rounded-[22px] border border-white/10 bg-black/56">
            {isDesktop && !reducedMotion ? (
              <SecurityVaultScene activeIndex={activeIndex} />
            ) : null}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.18)_44%,rgba(0,0,0,0.82)_100%)]" />
          </div>

          <div className="absolute inset-x-14 bottom-12">
            <div className="relative min-h-75">
              {securityTopics.map((topic, index) => (
                <div
                  key={topic.id}
                  data-security-visual
                  className={`absolute inset-0 transition-all duration-500 ease-out ${
                    activeIndex === index
                      ? "translate-y-0 scale-100 opacity-100 blur-0"
                      : "pointer-events-none translate-y-6 scale-[0.98] opacity-0 blur-sm"
                  }`}
                >
                  <TopicImage topic={topic} priority={index === 0} />
                </div>
              ))}
            </div>
          </div>

          <div className="absolute right-12 top-12 rounded-xl border border-white/10 bg-black/45 p-4 text-right font-mono backdrop-blur-md">
            <Server className="ml-auto h-5 w-5 text-white/70" />
            <p className="mt-3 text-3xl font-semibold text-white">
              {activeTopic.metric}
            </p>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/42">
              {t(`topics.${activeTopic.key}.metricLabel`)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SecurityScrollytelling() {
  const t = useTranslations("marketing.landing.security");
  const scope = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const reducedMotion = usePrefersReducedMotion();
  const topicCount = securityTopics.length;
  const scrollDistance = useMemo(() => topicCount * 820, [topicCount]);

  // GSAP is imported at runtime (inside the effect) so this component can be
  // server-rendered: the library is never evaluated during SSR/Workers.
  useEffect(() => {
    const root = scope.current;
    if (!root || !isDesktop || reducedMotion) return;

    let cancelled = false;
    let kill: (() => void) | undefined;

    (async () => {
      const { default: gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const progressLine = root.querySelector<HTMLElement>(
        ".security-progress-line",
      );
      const pinTarget = root.querySelector<HTMLElement>(".security-pin");

      if (!pinTarget) return;

      if (progressLine) {
        gsap.set(progressLine, { scaleY: 0, transformOrigin: "top center" });
      }

      const syncActiveToProgress = (progress: number) => {
        const nextIndex = Math.min(
          topicCount - 1,
          Math.max(0, Math.round(progress * (topicCount - 1))),
        );
        setActiveIndex(nextIndex);
      };

      const scrollTrigger = ScrollTrigger.create({
        trigger: pinTarget,
        start: "top top",
        end: `+=${scrollDistance}`,
        pin: true,
        scrub: 0.45,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        snap: {
          snapTo: 1 / (topicCount - 1),
          duration: { min: 0.18, max: 0.42 },
          ease: "power2.out",
        },
        onUpdate: (self) => {
          if (progressLine) {
            gsap.set(progressLine, { scaleY: self.progress });
          }
          syncActiveToProgress(self.progress);
        },
      });

      kill = () => scrollTrigger.kill();
    })();

    return () => {
      cancelled = true;
      kill?.();
    };
  }, [isDesktop, reducedMotion, scrollDistance, topicCount]);

  return (
    <section
      id="security"
      ref={scope}
      className="relative scroll-mt-14 overflow-hidden bg-(--background)"
    >
      {reducedMotion ? (
        <div className="mx-auto hidden max-w-6xl px-8 py-24 lg:block">
          <div className="mb-12 max-w-3xl">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-(--text-muted)">
              {t("label")}
            </span>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-(--text-primary)">
              {t("title")}
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {securityTopics.map((topic, index) => (
              <article
                key={topic.id}
                className="rounded-xl border border-(--border) bg-(--surface)/80 p-5"
              >
                <TopicImage topic={topic} priority={index === 0} />
                <h3 className="mt-5 text-2xl font-semibold text-(--text-primary)">
                  {t(`topics.${topic.key}.title`)}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-(--text-secondary)">
                  {t(`topics.${topic.key}.description`)}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <DesktopSecurityStory
          activeIndex={activeIndex}
          reducedMotion={reducedMotion}
          isDesktop={isDesktop}
        />
      )}
      <MobileSecurityStory />
    </section>
  );
}
